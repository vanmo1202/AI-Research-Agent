const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
process.env.RESEARCH_DB_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "query-indexes-")),
  "db",
);
const db = require("../src/config/database");
test("Additive query indexes are idempotent and eliminate run-child table scans", async () => {
  await db.initializeDatabase();
  await db.initializeDatabase();
  for (const table of [
    "research_runs",
    "source_versions",
    "report_versions",
    "analysis_versions",
    "source_chunks_v2",
  ]) {
    const column = table === "research_runs" ? "request_id" : "run_id";
    const plan = await db.all(
      `EXPLAIN QUERY PLAN SELECT * FROM ${table} WHERE ${column}=? ORDER BY rowid`,
      ["id"],
    );
    assert.ok(
      plan.some((p) => p.detail.includes("USING INDEX")),
      JSON.stringify(plan),
    );
    assert.ok(
      !plan.some((p) => p.detail.includes("USE TEMP B-TREE")),
      JSON.stringify(plan),
    );
  }
  assert.equal(
    (
      await db.get(
        "SELECT COUNT(*) n FROM schema_migrations WHERE version='005-query-indexes'",
      )
    ).n,
    1,
  );
});
