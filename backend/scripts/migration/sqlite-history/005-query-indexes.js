// Additive indexes for run child lookups.
module.exports = async ({ transaction }) =>
  transaction(async (tx) => {
    if (
      await tx.get(
        "SELECT version FROM schema_migrations WHERE version='005-query-indexes'",
      )
    )
      return;
    for (const [name, table, columns] of [
      ["runs_request_lookup", "research_runs", "request_id"],
      ["reports_run_lookup", "report_versions", "run_id"],
      ["analysis_run_lookup", "analysis_versions", "run_id"],
      ["sources_run_lookup", "source_versions", "run_id"],
      ["chunks_run_lookup", "source_chunks_v2", "run_id"],
    ])
      await tx.run(
        `CREATE INDEX IF NOT EXISTS ${name} ON ${table}(${columns})`,
      );
    await tx.run("INSERT INTO schema_migrations VALUES(?,?)", [
      "005-query-indexes",
      new Date().toISOString(),
    ]);
  });
