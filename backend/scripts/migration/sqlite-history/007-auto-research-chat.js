module.exports = async ({ transaction }) =>
  transaction(async (tx) => {
    const version = "007-auto-research-chat";
    if (
      await tx.get("SELECT version FROM schema_migrations WHERE version=?", [
        version,
      ])
    )
      return;
    // Existing conversations stay offline until their owner explicitly opts in.
    await tx.run(
      "ALTER TABLE chat_sessions ADD COLUMN auto_research INTEGER NOT NULL DEFAULT 0 CHECK(auto_research IN (0,1))",
    );
    await tx.run(
      "ALTER TABLE chat_sessions ADD COLUMN internet_enabled INTEGER NOT NULL DEFAULT 0 CHECK(internet_enabled IN (0,1))",
    );
    await tx.run(
      "ALTER TABLE chat_messages ADD COLUMN research_json TEXT NOT NULL DEFAULT '{}'",
    );
    await tx.run(`CREATE TABLE chat_web_sources (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, chat_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL,
    turn_id TEXT NOT NULL, question TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL,
    content TEXT NOT NULL, content_hash TEXT NOT NULL, retrieved_at TEXT NOT NULL, provider TEXT NOT NULL,
    UNIQUE(chat_id,turn_id,url))`);
    await tx.run(
      "CREATE INDEX chat_web_owner ON chat_web_sources(owner_id,chat_id,retrieved_at)",
    );
    // Audit/budget rows deliberately survive session deletion; deletion cannot replenish a quota.
    for (const [table, key] of [
      [
        "chat_turn_usage",
        "chat_id TEXT NOT NULL, turn_id TEXT NOT NULL, PRIMARY KEY(chat_id,turn_id)",
      ],
      [
        "chat_daily_usage",
        "subject TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY(subject,day)",
      ],
    ]) {
      const [columns, primary] = key.split(", PRIMARY KEY");
      await tx.run(`CREATE TABLE ${table} (${columns},
      search_calls INTEGER NOT NULL DEFAULT 0, llm_calls INTEGER NOT NULL DEFAULT 0,
      input_bytes INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
      page_fetches INTEGER NOT NULL DEFAULT 0, PRIMARY KEY${primary})`);
    }
    await tx.run("INSERT INTO schema_migrations VALUES(?,?)", [
      version,
      new Date().toISOString(),
    ]);
  });
