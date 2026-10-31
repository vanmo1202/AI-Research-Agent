const db = require("../config/database");
const model = require("../models/run.model");
const requests = require("../models/request.model");
const { randomUUID } = require("node:crypto");
const {
  STAGES,
  invalid,
  options,
  key,
} = require("../validators/run.validator");
const terminal = ["completed", "partial", "failed", "cancelled"];
const error = (message, status = 404) =>
  Object.assign(new Error(message), { status });
async function requireRun(id) {
  const run = await model.find(id);
  if (!run) throw error("Run not found");
  return run;
}
async function create(requestId, body, idempotencyKey) {
  const opts = options(body);
  key(idempotencyKey);
  const request = await requests.findById(requestId);
  if (!request) throw error("Research request not found");
  return db.transaction(async (tx) => {
    const previous = await tx.get(
      "SELECT * FROM research_runs WHERE request_id=? AND idempotency_key=?",
      [requestId, idempotencyKey],
    );
    if (previous) {
      const snapshot = JSON.parse(previous.input_snapshot_json);
      if (Object.entries(opts).some(([k, v]) => snapshot[k] !== v))
        throw error("Idempotency key reused with different input", 409);
      return previous;
    }
    const id = randomUUID(),
      date = model.now();
    await tx.run(
      `INSERT INTO research_runs(id,request_id,input_snapshot_json,status,current_stage,created_at,updated_at,idempotency_key,orchestration) VALUES(?,?,?,'queued','planning',?,?,?,?)`,
      [
        id,
        requestId,
        JSON.stringify({ ...request, ...opts }),
        date,
        date,
        idempotencyKey,
        opts.orchestration,
      ],
    );
    await model.event(tx, id, "planning", "run.created", "Research run queued");
    await model.enqueue(tx, id, "planning", { round: 0 }, "planning:0");
    return tx.get("SELECT * FROM research_runs WHERE id=?", [id]);
  });
}
async function progress(requestId, id) {
  const run = await requireRun(id);
  if (run.request_id !== requestId) throw error("Run not found for request");
  const jobs = await model.jobs(id);
  const completedStages = [
    ...new Set(
      jobs.filter((j) => j.status === "succeeded").map((j) => j.stage),
    ),
  ];
  const analysis = await model.latestAnalysis(id);
  const evidence = analysis ? JSON.parse(analysis.evidence_json) : [];
  const sources = await db.get(
    "SELECT COUNT(*) count FROM source_versions WHERE run_id=?",
    [id],
  );
  return {
    requestId,
    runId: id,
    status: run.status,
    currentStage: run.current_stage,
    currentRound: run.current_round,
    completedStages,
    currentJob: publicJob(
      jobs.find((j) =>
        ["running", "queued", "retry_waiting"].includes(j.status),
      ),
    ),
    percent:
      run.status === "completed"
        ? 100
        : Math.min(99, Math.round((completedStages.length / 6) * 100)),
    sourceCount: sources.count,
    evidenceCount: evidence.length,
    answeredQuestions: new Set(evidence.map((e) => e.questionId)).size,
    recentEvents: await db.all(
      "SELECT * FROM run_events WHERE run_id=? ORDER BY id DESC LIMIT 30",
      [id],
    ),
    lastError: run.error_code
      ? { code: run.error_code, message: run.error_message }
      : null,
  };
}
function publicJob(job) {
  if (!job) return null;
  const { locked_by, input_json, ...safe } = job;
  return {
    ...safe,
    output: job.output_json ? JSON.parse(job.output_json) : null,
    error: job.error_json ? JSON.parse(job.error_json) : null,
  };
}
async function cancel(id) {
  await requireRun(id);
  return db.transaction(async (tx) => {
    const run = await tx.get("SELECT * FROM research_runs WHERE id=?", [id]);
    if (terminal.includes(run.status)) return run;
    await tx.run(
      "UPDATE research_runs SET status='cancelled',completed_at=?,updated_at=? WHERE id=?",
      [model.now(), model.now(), id],
    );
    await tx.run(
      "UPDATE stage_jobs SET status='cancelled',locked_by=NULL,locked_until=NULL,completed_at=? WHERE run_id=? AND status IN ('queued','running','retry_waiting')",
      [model.now(), id],
    );
    await model.event(
      tx,
      id,
      run.current_stage,
      "run.cancelled",
      "Research run cancelled",
    );
    return tx.get("SELECT * FROM research_runs WHERE id=?", [id]);
  });
}
async function retry(id, stage, idempotencyKey) {
  key(idempotencyKey);
  await requireRun(id);
  return db.transaction(async (tx) => {
    const previous = await tx.get(
      "SELECT * FROM stage_jobs WHERE run_id=? AND idempotency_key=?",
      [id, idempotencyKey],
    );
    if (previous) {
      if (stage && previous.stage !== stage)
        throw error("Idempotency key reused for another stage", 409);
      return previous;
    }
    const run = await tx.get("SELECT * FROM research_runs WHERE id=?", [id]);
    if (!["failed", "partial"].includes(run.status))
      throw error("Only failed or partial runs can be retried", 409);
    const last = await tx.get(
      "SELECT * FROM stage_jobs WHERE run_id=? ORDER BY rowid DESC LIMIT 1",
      [id],
    );
    stage = stage || last.stage;
    if (!STAGES.includes(stage)) throw invalid("Invalid stage");
    const previousStage = STAGES[STAGES.indexOf(stage) - 1];
    if (
      previousStage &&
      !(await tx.get(
        "SELECT id FROM stage_jobs WHERE run_id=? AND stage=? AND status='succeeded'",
        [id, previousStage],
      ))
    )
      throw error("Previous stage must succeed first", 409);
    const job = await model.enqueue(
      tx,
      id,
      stage,
      { round: run.current_round, retry: true },
      idempotencyKey,
    );
    await tx.run(
      "UPDATE research_runs SET status='queued',current_stage=?,completed_at=NULL,error_code=NULL,error_message=NULL,updated_at=? WHERE id=?",
      [stage, model.now(), id],
    );
    return job;
  });
}
async function dispatch(id, stage, idempotencyKey) {
  key(idempotencyKey);
  if (!STAGES.includes(stage)) throw invalid("Invalid stage");
  const run = await requireRun(id);
  const previous = await db.get(
    "SELECT * FROM stage_jobs WHERE run_id=? AND idempotency_key=?",
    [id, idempotencyKey],
  );
  if (previous) {
    if (previous.stage !== stage)
      throw error("Idempotency key reused for another stage", 409);
    await db.run(
      "UPDATE dispatch_outbox SET status='released' WHERE job_id=? AND status='pending'",
      [previous.id],
    );
    return previous;
  }
  // Backend is authoritative: orchestrators may only address the already scheduled stage.
  const current = await db.get(
    "SELECT * FROM stage_jobs WHERE run_id=? AND stage=? ORDER BY rowid DESC LIMIT 1",
    [id, stage],
  );
  if (!current || stage !== run.current_stage)
    throw error("Stage is not scheduled for this run", 409);
  if (current.idempotency_key !== idempotencyKey)
    throw error("Use the canonical stage idempotency key", 409);
  return current;
}
module.exports = {
  create,
  progress,
  cancel,
  retry,
  dispatch,
  requireRun,
  publicJob,
  terminal,
};
