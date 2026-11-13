// Rebuild the small FK graph together, child-first on removal; never disable FK enforcement.
// Every copy, trigger/index restore and FTS rebuild is inside the same rollbackable transaction.
module.exports = async ({ transaction }) => transaction(async tx => {
  const version = '006-document-chats';
  if (await tx.get('SELECT version FROM schema_migrations WHERE version=?', [version])) return;
  const tables = ['chat_sessions', 'chat_messages', 'agent_memories', 'memory_evidence_links'];
  const pattern = /\b(chat_sessions|chat_messages|agent_memories|memory_evidence_links)\b/g;
  const objects = (await tx.all("SELECT type,name,sql FROM sqlite_master WHERE type IN ('index','trigger') AND sql IS NOT NULL"))
    .filter(o => new RegExp(pattern.source).test(o.sql));
  for (const o of objects.filter(o => o.type === 'trigger')) await tx.run(`DROP TRIGGER "${o.name}"`);
  for (const table of tables) {
    let { sql } = await tx.get("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", [table]);
    if (['chat_sessions', 'agent_memories'].includes(table))
      sql = sql.replace(/request_id TEXT NOT NULL/i, 'request_id TEXT');
    sql = sql.replace(pattern, name => `${name}_document_next`);
    await tx.run(sql);
    const columns = (await tx.all(`PRAGMA table_info("${table}")`)).map(c => `"${c.name}"`).join(',');
    await tx.run(`INSERT INTO ${table}_document_next(rowid,${columns}) SELECT rowid,${columns} FROM ${table}`);
  }
  for (const table of [...tables].reverse()) await tx.run(`DROP TABLE ${table}`);
  for (const table of tables) await tx.run(`ALTER TABLE ${table}_document_next RENAME TO ${table}`);
  for (const o of objects) await tx.run(o.sql);
  // NULL is deliberately a distinct document-only context. Prevent duplicate extractive candidates.
  await tx.run('CREATE UNIQUE INDEX memories_document_hash ON agent_memories(owner_id,content_hash) WHERE request_id IS NULL');
  await tx.run("INSERT INTO agent_memories_fts(agent_memories_fts) VALUES('rebuild')");
  for (const table of tables) {
    if ((await tx.all(`PRAGMA foreign_key_check("${table}")`)).length)
      throw new Error('Knowledge migration foreign key check failed');
  }
  await tx.run('INSERT INTO schema_migrations VALUES(?,?)', [version, new Date().toISOString()]);
});
