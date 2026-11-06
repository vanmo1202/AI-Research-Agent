const { test } = require("node:test");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { spawnSync } = require("node:child_process");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "auth-transfer-"));
process.env.RESEARCH_DB_PATH = path.join(directory, "legacy.db");
const db = require("../src/config/database");
test("Offline transfer backs up first, preserves data, and rolls back on duplicate documents", async () => {
  await db.initializeDatabase();
  const now = new Date().toISOString();
  await db.run(
    "INSERT INTO users(id,email,name,password_hash,created_at,updated_at) VALUES('target','owner@example.test','Owner','unused',?,?)",
    [now, now],
  );
  await db.run(
    "INSERT INTO requests(id,topic,goal) VALUES('legacy','Preserved topic','Goal')",
  );
  const transfer = (email) =>
    spawnSync(
      process.execPath,
      [
        path.join(__dirname, "../scripts/transfer-legacy.js"),
        email,
        "--transfer-all-workspace",
      ],
      { env: process.env, encoding: "utf8" },
    );
  const invalid = transfer("unknown@example.test");
  assert.equal(invalid.status, 1);
  assert.equal(
    fs.readdirSync(directory).some((p) => p.includes(".backup-")),
    false,
  );
  const ok = transfer("owner@example.test");
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(
    (await db.get("SELECT owner_id FROM requests WHERE id='legacy'")).owner_id,
    "target",
  );
  assert.equal(
    (await db.get("SELECT topic FROM requests WHERE id='legacy'")).topic,
    "Preserved topic",
  );
  const backups = fs
    .readdirSync(directory)
    .filter((p) => p.includes(".backup-"));
  assert.equal(backups.length, 1);
  assert.equal(fs.statSync(path.join(directory, backups[0])).mode & 0o077, 0);
  await db.run(
    "INSERT INTO requests(id,topic,goal) VALUES('rollback','Preserved','Goal')",
  );
  for (const [id, owner] of [
    ["owned", "target"],
    ["old", "workspace"],
  ])
    await db.run(
      "INSERT INTO documents(id,owner_id,filename,storage_name,sha256,byte_size,status,created_at,updated_at) VALUES(?,?,'preserved.pdf',?,'same-sha',1,'ready',?,?)",
      [id, owner, id, now, now],
    );
  const failed = transfer("owner@example.test");
  assert.equal(failed.status, 1);
  assert.equal(
    (await db.get("SELECT owner_id FROM requests WHERE id='rollback'"))
      .owner_id,
    "workspace",
  );
  assert.equal(
    (await db.get("SELECT owner_id FROM documents WHERE id='old'")).owner_id,
    "workspace",
  );
  assert.equal(
    fs.readdirSync(directory).filter((p) => p.includes(".backup-")).length,
    2,
  );
  // A legacy chat pointing at another user's research must abort the entire transfer.
  await db.run("UPDATE documents SET sha256='distinct' WHERE id='old'");
  await db.run(
    "INSERT INTO users(id,email,name,password_hash,created_at,updated_at) VALUES('other','other@example.test','Other','unused',?,?)",
    [now, now],
  );
  await db.run(
    "INSERT INTO requests(id,topic,goal,owner_id) VALUES('other-research','Other','Goal','other')",
  );
  await db.run(
    "INSERT INTO chat_sessions(id,owner_id,request_id,title,scope,document_ids_json,created_at) VALUES('inconsistent','workspace','other-research','Legacy','research','[]',?)",
    [now],
  );
  const mismatch = transfer("owner@example.test");
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /Ownership relationship mismatch/);
  assert.equal(
    (await db.get("SELECT owner_id FROM chat_sessions WHERE id='inconsistent'"))
      .owner_id,
    "workspace",
  );
  assert.equal(
    (await db.get("SELECT owner_id FROM requests WHERE id='rollback'"))
      .owner_id,
    "workspace",
  );
});
