const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
process.env.RESEARCH_DB_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-migration-")),
  "legacy.db",
);
const db = require("../src/config/database");
test("additive knowledge migration preserves pre-existing legacy rows and is idempotent", async () => {
  await db.run(
    "CREATE TABLE requests(id TEXT PRIMARY KEY,topic TEXT NOT NULL,goal TEXT NOT NULL,scope TEXT,output_length TEXT,status TEXT,created_at TEXT,updated_at TEXT)",
  );
  await db.run(
    "INSERT INTO requests VALUES('old-id','Existing research','Preserve data','','medium','planned','before','before')",
  );
  await db.initializeDatabase();
  const before = await db.get("SELECT * FROM requests WHERE id='old-id'");
  await db.initializeDatabase();
  assert.deepEqual(
    await db.get("SELECT * FROM requests WHERE id='old-id'"),
    before,
  );
  assert.equal(
    (
      await db.get(
        "SELECT COUNT(*) n FROM schema_migrations WHERE version='003-knowledge'",
      )
    ).n,
    1,
  );
  assert.equal((await db.all("PRAGMA foreign_key_check")).length, 0);
  await db.transaction(async (tx) => {
    await tx.run(
      "INSERT INTO documents(id,owner_id,filename,storage_name,sha256,byte_size,status,created_at,updated_at) VALUES('doc','workspace','a.pdf','a','hash',10,'ready','now','now')",
    );
    await tx.run(
      "INSERT INTO document_pages VALUES('doc',1,'indexed original')",
    );
    await tx.run(
      "INSERT INTO document_chunks VALUES('chunk','doc',1,0,'indexed original','h')",
    );
  });
  assert.equal(
    (
      await db.all(
        "SELECT rowid FROM document_chunks_fts WHERE document_chunks_fts MATCH 'original'",
      )
    ).length,
    1,
  );
  await db.run(
    "UPDATE document_chunks SET content='replacement content' WHERE id='chunk'",
  );
  assert.equal(
    (
      await db.all(
        "SELECT rowid FROM document_chunks_fts WHERE document_chunks_fts MATCH 'original'",
      )
    ).length,
    0,
  );
  assert.equal(
    (
      await db.all(
        "SELECT rowid FROM document_chunks_fts WHERE document_chunks_fts MATCH 'replacement'",
      )
    ).length,
    1,
  );
  await db.run("DELETE FROM document_pages WHERE document_id='doc'");
  assert.equal(
    (
      await db.all(
        "SELECT rowid FROM document_chunks_fts WHERE document_chunks_fts MATCH 'replacement'",
      )
    ).length,
    0,
  );
});
