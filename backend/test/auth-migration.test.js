const { test } = require("node:test");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
process.env.RESEARCH_DB_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "auth-migration-")),
  "legacy.db",
);
const db = require("../src/config/database"),
  migrate = require("../src/migrations/004-user-auth");
test("004 migration rolls back schema and data on injected failure, then preserves legacy rows", async () => {
  await db.run(
    "CREATE TABLE schema_migrations(version TEXT PRIMARY KEY,applied_at TEXT)",
  );
  await db.run(
    "CREATE TABLE requests(id TEXT PRIMARY KEY,topic TEXT,created_at TEXT)",
  );
  await db.run("INSERT INTO requests VALUES('legacy','untouched','before')");
  await assert.rejects(
    migrate({
      transaction: (work) =>
        db.transaction((tx) =>
          work({
            ...tx,
            run: async (sql, params) => {
              const result = await tx.run(sql, params);
              if (sql.startsWith("ALTER TABLE"))
                throw Error("injected failure");
              return result;
            },
          }),
        ),
    }),
    /injected failure/,
  );
  assert.equal(
    await db.get("SELECT name FROM sqlite_master WHERE name='users'"),
    undefined,
  );
  assert.equal(
    (await db.all("PRAGMA table_info(requests)")).some(
      (c) => c.name === "owner_id",
    ),
    false,
  );
  assert.equal(
    (await db.get("SELECT topic FROM requests WHERE id='legacy'")).topic,
    "untouched",
  );
  await migrate(db);
  await migrate(db);
  assert.equal(
    (await db.get("SELECT owner_id FROM requests WHERE id='legacy'")).owner_id,
    "workspace",
  );
  assert.equal((await db.get("SELECT COUNT(*) n FROM users")).n, 0);
});
