const db = require("../config/database");
const { randomUUID } = require("node:crypto");
const now = () => new Date().toISOString();
const find = (id) => db.get("SELECT * FROM research_runs WHERE id=?", [id]);
const jobs = (id) =>
  db.all("SELECT * FROM stage_jobs WHERE run_id=? ORDER BY rowid", [id]);
const latestAnalysis = (id) =>
  db.get(
    "SELECT * FROM analysis_versions WHERE run_id=? ORDER BY rowid DESC LIMIT 1",
    [id],
  );
async function event(tx, runId, stage, type, message, metadata = {}) {
  await tx.run(
    "INSERT INTO run_events(run_id,stage,event_type,message,metadata_json,created_at) VALUES(?,?,?,?,?,?)",
    [runId, stage, type, message, JSON.stringify(metadata), now()],
  );
}
async function enqueue(tx, runId, stage, input, key) {
  const previous = await tx.get(
    "SELECT * FROM stage_jobs WHERE run_id=? AND idempotency_key=?",
    [runId, key],
  );
  if (previous) return previous;
  const id = randomUUID(),
    date = now();
  await tx.run(
    `INSERT INTO stage_jobs(id,run_id,stage,status,idempotency_key,input_json,created_at,available_at) VALUES(?,?,?,'queued',?,?,?,?)`,
    [id, runId, stage, key, JSON.stringify(input), date, date],
  );
  await tx.run(
    `INSERT INTO dispatch_outbox(id,run_id,job_id,event_type,payload_json,status,created_at) VALUES(?,?,?,'job.queued',?,'pending',?)`,
    [
      randomUUID(),
      runId,
      id,
      JSON.stringify({ runId, jobId: id, stage }),
      date,
    ],
  );
  await event(tx, runId, stage, "job.queued", `Queued ${stage}`, { jobId: id });
  return tx.get("SELECT * FROM stage_jobs WHERE id=?", [id]);
}
module.exports = { find, jobs, latestAnalysis, event, enqueue, now };
