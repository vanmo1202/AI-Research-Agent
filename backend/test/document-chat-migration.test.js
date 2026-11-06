const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
process.env.RESEARCH_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(),'document-chat-migration-')), 'legacy.db');
const db = require('../src/config/database');
const migrate = require('../src/migrations/006-document-chats');
test('006 migration preserves populated legacy FK graph/FTS and rolls back even after dropping a parent table', async () => {
  const cache = require.cache[require.resolve('../src/migrations/006-document-chats')];
  cache.exports = async () => {};
  try { await db.initializeDatabase(); } finally { cache.exports = migrate; }
  await db.run("INSERT INTO requests(id,topic,goal) VALUES('research','Preserved','Evidence')");
  await db.run("INSERT INTO chat_sessions(id,owner_id,request_id,title,scope,document_ids_json,created_at) VALUES('chat','workspace','research','Legacy chat','research','[]','before')");
  await db.run("INSERT INTO chat_messages(id,chat_id,role,content,turn_id,status,created_at) VALUES('message','chat','assistant','Preserved message','token','complete','before')");
  await db.run("INSERT INTO agent_memories(id,owner_id,request_id,message_id,kind,content,content_hash,status,created_at,updated_at) VALUES('memory','workspace','research','message','research','preserved knowledge','hash','verified','before','before')");
  await db.run("INSERT INTO memory_evidence_links(memory_id,kind,reference_id,source_id,version_hash,quote) VALUES('memory','source','chunk','source','version','preserved knowledge')");
  const tables = ['chat_sessions','chat_messages','agent_memories','memory_evidence_links'];
  const snapshot = async () => Promise.all(tables.map(table => db.all(`SELECT rowid,* FROM ${table}`)));
  const before = await snapshot();
  await assert.rejects(migrate({ transaction: work => db.transaction(tx => work({ ...tx, run: async (sql, params) => {
    const result = await tx.run(sql, params);
    if (sql === 'DROP TABLE chat_messages') throw Error('injected after destructive step');
    return result;
  }})) }), /injected after destructive step/);
  assert.deepEqual(await snapshot(), before);
  assert.equal((await db.all("SELECT name FROM sqlite_master WHERE name LIKE '%document_next%'")).length,0);
  assert.equal((await db.get("SELECT COUNT(*) n FROM agent_memories_fts WHERE agent_memories_fts MATCH 'preserved'")).n,1);
  assert.equal((await db.all("PRAGMA table_info(chat_sessions)")).find(c=>c.name==='request_id').notnull,1);
  await migrate(db); await migrate(db);
  assert.deepEqual(await snapshot(),before);
  assert.equal((await db.all("PRAGMA table_info(chat_sessions)")).find(c=>c.name==='request_id').notnull,0);
  assert.equal((await db.all("PRAGMA table_info(agent_memories)")).find(c=>c.name==='request_id').notnull,0);
  assert.equal((await db.all('PRAGMA foreign_key_check')).length,0);
  assert.equal((await db.get("SELECT COUNT(*) n FROM agent_memories_fts WHERE agent_memories_fts MATCH 'preserved'")).n,1);
  await db.run("DELETE FROM chat_sessions WHERE id='chat'");
  assert.equal((await db.get("SELECT COUNT(*) n FROM chat_messages WHERE id='message'")).n,0);
  assert.equal((await db.get("SELECT message_id FROM agent_memories WHERE id='memory'")).message_id,null);
});
