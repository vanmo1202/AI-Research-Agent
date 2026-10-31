// Additive, versioned migration. All identifiers below are static SQL.
module.exports = async function migrate(database) {
  await database.transaction(async (tx) => {
    await tx.run(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
    if (
      await tx.get("SELECT version FROM schema_migrations WHERE version = ?", [
        "002-flow-v2",
      ])
    )
      return;
    const statements = [
      `CREATE TABLE research_runs (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES requests(id), input_snapshot_json TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('queued','running','completed','partial','failed','cancelled')),
 current_stage TEXT, current_round INTEGER NOT NULL DEFAULT 0, last_successful_stage TEXT,
 created_at TEXT NOT NULL, started_at TEXT, completed_at TEXT, updated_at TEXT NOT NULL,
 error_code TEXT, error_message TEXT, idempotency_key TEXT NOT NULL, orchestration TEXT NOT NULL DEFAULT 'backend',
 llm_calls INTEGER NOT NULL DEFAULT 0, search_calls INTEGER NOT NULL DEFAULT 0,
 UNIQUE(request_id,idempotency_key))`,
      `CREATE TABLE stage_jobs (
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES research_runs(id), stage TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','retry_waiting','failed','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3,
 idempotency_key TEXT NOT NULL, locked_by TEXT, locked_until TEXT, heartbeat_at TEXT,
 input_json TEXT NOT NULL, output_json TEXT, error_json TEXT, created_at TEXT NOT NULL,
 started_at TEXT, completed_at TEXT, available_at TEXT NOT NULL, generation INTEGER NOT NULL DEFAULT 0,
 UNIQUE(run_id,idempotency_key))`,
      `CREATE UNIQUE INDEX one_active_job_per_run ON stage_jobs(run_id) WHERE status IN ('queued','running','retry_waiting')`,
      `CREATE INDEX jobs_claim ON stage_jobs(status,available_at,locked_until)`,
      `CREATE TABLE source_versions (
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES research_runs(id), query TEXT NOT NULL, title TEXT, url TEXT NOT NULL,
 normalized_url TEXT NOT NULL, provider TEXT, original_content TEXT NOT NULL, display_content_vi TEXT,
 content_hash TEXT NOT NULL, language TEXT, translation_status TEXT, collected_at TEXT NOT NULL,
 UNIQUE(run_id,normalized_url))`,
      `CREATE TABLE source_chunks_v2 (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES research_runs(id),
 source_version_id TEXT NOT NULL REFERENCES source_versions(id), chunk_index INTEGER NOT NULL, content TEXT NOT NULL,
 UNIQUE(source_version_id,chunk_index))`,
      `CREATE TABLE analysis_versions (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES research_runs(id),
 job_id TEXT NOT NULL UNIQUE REFERENCES stage_jobs(id), source_snapshot_hash TEXT NOT NULL,
 evidence_json TEXT NOT NULL, coverage_status TEXT NOT NULL, gaps_json TEXT NOT NULL, created_at TEXT NOT NULL)`,
      `CREATE TABLE report_versions (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES research_runs(id),
 job_id TEXT NOT NULL UNIQUE REFERENCES stage_jobs(id), analysis_version_id TEXT NOT NULL REFERENCES analysis_versions(id),
 content TEXT NOT NULL, references_json TEXT NOT NULL, citation_validation_json TEXT NOT NULL,
 status TEXT NOT NULL, created_at TEXT NOT NULL)`,
      `CREATE TABLE run_events (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES research_runs(id),
 stage TEXT, event_type TEXT NOT NULL, message TEXT NOT NULL, metadata_json TEXT NOT NULL, created_at TEXT NOT NULL)`,
      `CREATE TABLE dispatch_outbox (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES research_runs(id),
 job_id TEXT NOT NULL UNIQUE REFERENCES stage_jobs(id), event_type TEXT NOT NULL, payload_json TEXT NOT NULL,
 status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, sent_at TEXT)`,
      `CREATE INDEX runs_request ON research_runs(request_id,created_at)`,
      `CREATE INDEX events_run ON run_events(run_id,id)`,
    ];
    for (const sql of statements) await tx.run(sql);
    await tx.run("INSERT INTO schema_migrations VALUES (?, ?)", [
      "002-flow-v2",
      new Date().toISOString(),
    ]);
  });
};
