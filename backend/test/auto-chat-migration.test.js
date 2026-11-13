const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
process.env.RESEARCH_DB_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "auto-chat-migration-")),
  "old.db",
);
const db = require("./legacy/sqlite-database.cjs"),
  migrate = require("../scripts/migration/sqlite-history/007-auto-research-chat");
test("007 additive migration preserves private legacy conversations and rolls back schema/counters on failure", async () => {
  const cached =
    require.cache[require.resolve("../scripts/migration/sqlite-history/007-auto-research-chat")];
  cached.exports = async () => {};
  try {
    await db.initializeDatabase();
  } finally {
    cached.exports = migrate;
  }
  await db.run(
    "INSERT INTO chat_sessions(id,owner_id,request_id,title,scope,document_ids_json,created_at) VALUES('old','alice',NULL,'Old PDF chat','documents','[]','before')",
  );
  await db.run(
    "INSERT INTO chat_messages(id,chat_id,role,content,turn_id,status,created_at) VALUES('message','old','assistant','Old preserved answer','before','complete','before')",
  );
  await assert.rejects(
    migrate({
      transaction: (work) =>
        db.transaction((tx) =>
          work({
            ...tx,
            run: async (sql, params) => {
              const result = await tx.run(sql, params);
              if (sql.includes("CREATE TABLE chat_daily_usage"))
                throw Error("injected budget table failure");
              return result;
            },
          }),
        ),
    }),
    /injected budget table failure/,
  );
  assert.equal(
    (await db.all("PRAGMA table_info(chat_sessions)")).some(
      (c) => c.name === "auto_research",
    ),
    false,
  );
  assert.equal(
    await db.get(
      "SELECT name FROM sqlite_master WHERE name='chat_web_sources'",
    ),
    undefined,
  );
  assert.equal(
    (await db.get("SELECT content FROM chat_messages WHERE id='message'"))
      .content,
    "Old preserved answer",
  );
  await migrate(db);
  await migrate(db);
  const s = await db.get("SELECT * FROM chat_sessions WHERE id='old'");
  assert.equal(s.auto_research, 0);
  assert.equal(s.internet_enabled, 0);
  assert.equal(
    (await db.get("SELECT research_json FROM chat_messages WHERE id='message'"))
      .research_json,
    "{}",
  );
  assert.equal((await db.all("PRAGMA foreign_key_check")).length, 0);
});
