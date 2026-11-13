const db = require("../config/database");
const model = require("../models/run.model");
const { STAGES } = require("../validators/run.validator");
const provider = require("../providers/research.provider");
const { randomUUID } = require("node:crypto");
const LEASE_MS = 30000;
async function claim(owner) {
  return db.transaction(async (tx) => {
    const expired = await tx.all(
      "SELECT j.* FROM stage_jobs j JOIN research_runs r ON r.id=j.run_id WHERE j.status='running' AND j.locked_until<=$1 AND r.status='running'",
      [model.now()],
    );
    for (const j of expired) {
      const exhausted = j.attempts >= j.max_attempts;
      await tx.run(
        "UPDATE stage_jobs SET status=$1,locked_by=NULL,locked_until=NULL,error_json=$2 WHERE id=$3",
        [
          exhausted ? "failed" : "queued",
          JSON.stringify({
            code: "LEASE_EXPIRED",
            message: "Worker lease expired",
          }),
          j.id,
        ],
      );
      await model.event(
        tx,
        j.run_id,
        j.stage,
        exhausted ? "job.failed" : "job.recovered",
        "Worker lease expired",
        { jobId: j.id },
      );
      if (exhausted)
        await tx.run(
          "UPDATE research_runs SET status='failed',error_code='LEASE_EXPIRED',error_message='Worker recovery attempts exhausted',completed_at=$1,updated_at=$2 WHERE id=$3",
          [model.now(), model.now(), j.run_id],
        );
    }
    const job = await tx.get(
      `SELECT j.* FROM stage_jobs j JOIN research_runs r ON r.id=j.run_id WHERE j.status IN ('queued','retry_waiting') AND j.available_at<=$1 AND r.status IN ('queued','running') AND (r.orchestration='backend' OR EXISTS (SELECT 1 FROM dispatch_outbox o WHERE o.job_id=j.id AND o.status IN ('released','sent'))) ORDER BY j.legacy_position LIMIT 1`,
      [model.now()],
    );
    if (!job) return null;
    const date = model.now(),
      until = new Date(Date.now() + LEASE_MS).toISOString();
    await tx.run(
      "UPDATE stage_jobs SET status='running',attempts=attempts+1,generation=generation+1,locked_by=$1,locked_until=$2,heartbeat_at=$3,started_at=COALESCE(started_at,$4) WHERE id=$5",
      [owner, until, date, date, job.id],
    );
    await tx.run(
      "UPDATE research_runs SET status='running',current_stage=$1,started_at=COALESCE(started_at,$2),updated_at=$3 WHERE id=$4",
      [job.stage, date, date, job.run_id],
    );
    await tx.run(
      "UPDATE dispatch_outbox SET status='sent',attempts=attempts+1,sent_at=$1 WHERE job_id=$2",
      [date, job.id],
    );
    await model.event(
      tx,
      job.run_id,
      job.stage,
      "job.running",
      `Running ${job.stage}`,
      { jobId: job.id, attempt: job.attempts + 1 },
    );
    return tx.get("SELECT * FROM stage_jobs WHERE id=$1", [job.id]);
  });
}
async function owns(tx, job, owner) {
  return tx.get(
    "SELECT j.id FROM stage_jobs j JOIN research_runs r ON r.id=j.run_id WHERE j.id=$1 AND j.status='running' AND j.locked_by=$2 AND j.generation=$3 AND j.locked_until>$4 AND r.status='running'",
    [job.id, owner, job.generation, model.now()],
  );
}
async function heartbeat(job, owner) {
  const r = await db.run(
    "UPDATE stage_jobs SET locked_until=$1,heartbeat_at=$2 WHERE id=$3 AND locked_by=$4 AND generation=$5 AND status='running' AND locked_until>$6",
    [
      new Date(Date.now() + LEASE_MS).toISOString(),
      model.now(),
      job.id,
      owner,
      job.generation,
      model.now(),
    ],
  );
  return r.changes === 1;
}
async function context(job, signal, customProvider) {
  const run = await model.find(job.run_id),
    input = JSON.parse(run.input_snapshot_json);
  const planJob = await db.get(
    "SELECT output_json FROM stage_jobs WHERE run_id=$1 AND stage='planning' AND status='succeeded' ORDER BY legacy_position DESC LIMIT 1",
    [run.id],
  );
  const evaluation = await db.get(
    "SELECT output_json FROM stage_jobs WHERE run_id=$1 AND stage='evaluating' AND status='succeeded' ORDER BY legacy_position DESC LIMIT 1",
    [run.id],
  );
  const ctx = {
    job,
    run,
    input,
    signal,
    provider: customProvider || provider,
    plan: planJob ? JSON.parse(planJob.output_json).plan : null,
    previousEvaluation: evaluation ? JSON.parse(evaluation.output_json) : null,
    sources: await db.all(
      "SELECT * FROM source_versions WHERE run_id=$1 ORDER BY id",
      [run.id],
    ),
    chunks: await db.all(
      "SELECT c.*,s.provider FROM source_chunks_v2 c JOIN source_versions s ON s.id=c.source_version_id WHERE c.run_id=$1",
      [run.id],
    ),
    analysis: await model.latestAnalysis(run.id),
    report: await db.get(
      "SELECT * FROM report_versions WHERE run_id=$1 ORDER BY legacy_position DESC LIMIT 1",
      [run.id],
    ),
    check() {
      if (signal.aborted) throw provider.fail("JOB_ABORTED", true);
    },
  };
  // Historical rows remain immutable; only eligible sources enter new stages.
  ctx.sources = require('../services/source-relevance.service').eligibleSources(input, ctx.sources);
  const eligible = new Set(ctx.sources.map(s => s.id));
  ctx.chunks = ctx.chunks.filter(c => eligible.has(c.source_version_id));
  return ctx;
}
async function commit(job, owner, ctx, output) {
  return db.transaction(async (tx) => {
    if (!(await owns(tx, job, owner))) return false;
    const date = model.now();
    if (job.stage === "collecting") {
      for (const s of output.sources) {
        await tx.run(
          `INSERT INTO source_versions(id,run_id,query,title,url,normalized_url,provider,original_content,display_content_vi,content_hash,language,translation_status,collected_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING`,
          [
            s.id,
            job.run_id,
            s.query,
            s.title,
            s.url,
            s.normalized_url,
            s.provider,
            s.original_content,
            s.display_content_vi,
            s.content_hash,
            s.language,
            s.translation_status,
            s.collected_at,
          ],
        );
        const saved = await tx.get(
          "SELECT id FROM source_versions WHERE run_id=$1 AND normalized_url=$2",
          [job.run_id, s.normalized_url],
        );
        for (let i = 0; i < s.original_content.length; i += 900)
          await tx.run(
            "INSERT INTO source_chunks_v2(id,run_id,source_version_id,chunk_index,content) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
            [
              randomUUID(),
              job.run_id,
              saved.id,
              Math.floor(i / 900),
              s.original_content.slice(i, i + 1000),
            ],
          );
      }
      output = {
        sourceCount: ctx.sources.length + output.sources.length,
        warnings: output.warnings,
        provenance:output.sources.map(s=>({id:s.id,...s.provenance})),
      };
    }
    if (job.stage === "analyzing" || job.stage === "evaluating") {
      const evaluating = job.stage === "evaluating";
      const evidence = evaluating
        ? JSON.parse(ctx.analysis.evidence_json)
        : output.evidence;
      // Validate every persisted item against immutable chunks in this run.
      for (const e of evidence) {
        const chunk = await tx.get(
          "SELECT * FROM source_chunks_v2 WHERE id=$1 AND run_id=$2 AND source_version_id=$3",
          [e.chunkId, job.run_id, e.sourceVersionId],
        );
        if (
          !chunk ||
          e.runId !== job.run_id ||
          !e.originalQuote ||
          e.originalQuote.length > 400 ||
          !chunk.content.includes(e.originalQuote)
        )
          throw provider.fail("INVALID_EVIDENCE_PROVENANCE");
      }
      await tx.run(
        "INSERT INTO analysis_versions(id,run_id,job_id,source_snapshot_hash,evidence_json,coverage_status,gaps_json,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          randomUUID(),
          job.run_id,
          job.id,
          evaluating
            ? ctx.analysis.source_snapshot_hash
            : output.sourceSnapshotHash,
          JSON.stringify(evidence),
          evaluating ? output.coverage : "unavailable",
          JSON.stringify(evaluating ? output.gaps : []),
          date,
        ],
      );
    }
    if (job.stage === "composing") {
      await tx.run(
        "UPDATE report_versions SET status='historical' WHERE run_id=$1",
        [job.run_id],
      );
      await tx.run(
        "INSERT INTO report_versions(id,run_id,job_id,analysis_version_id,content,references_json,citation_validation_json,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,'verifying',$8)",
        [
          randomUUID(),
          job.run_id,
          job.id,
          output.analysisVersionId,
          output.content,
          JSON.stringify(output.references),
          "{}",
          date,
        ],
      );
    }
    if (job.stage === "verifying")
      await tx.run(
        "UPDATE report_versions SET citation_validation_json=$1,status=$2 WHERE id=$3 AND run_id=$4",
        [JSON.stringify(output), output.status, ctx.report.id, job.run_id],
      );
    output.qualityStatus=job.stage==='collecting'?(output.sourceCount?'accepted':'insufficient'):job.stage==='analyzing'?(output.evidence.length?'traceable':'insufficient'):job.stage==='evaluating'?output.coverage:job.stage==='composing'?(output.partial?'insufficient':'pending_verification'):job.stage==='verifying'?(output.valid?'verified':'insufficient'):'planned';
    await tx.run(
      "UPDATE stage_jobs SET status='succeeded',output_json=$1,error_json=NULL,locked_by=NULL,locked_until=NULL,completed_at=$2 WHERE id=$3",
      [JSON.stringify(output), date, job.id],
    );
    await tx.run(
      "UPDATE research_runs SET last_successful_stage=$1,updated_at=$2,error_code=NULL,error_message=NULL WHERE id=$3",
      [job.stage, date, job.run_id],
    );
    await model.event(
      tx,
      job.run_id,
      job.stage,
      "job.succeeded",
      `Finished ${job.stage}`,
      { jobId: job.id, warnings: output.warnings || [] },
    );
    if (job.stage === "verifying") {
      await tx.run(
        "UPDATE research_runs SET status=$1,completed_at=$2,updated_at=$3,error_code=$5,error_message=$6 WHERE id=$4",
        [output.status, date, date, job.run_id,output.status==='partial'?(output.reasonCodes?.[0] || 'INSUFFICIENT_EVIDENCE'):null,output.status==='partial'?'Research ended with evidence or citation verification gaps.':null],
      );
      await model.event(
        tx,
        job.run_id,
        job.stage,
        `run.${output.status}`,
        output.valid
          ? "Citation validation finished"
          : "Citation validation found errors",
      );
    } else {
      const more =
        job.stage === "evaluating" && output.action === "search_more";
      const next = more ? "collecting" : STAGES[STAGES.indexOf(job.stage) + 1],
        round = ctx.run.current_round + (more ? 1 : 0);
      await tx.run(
        "UPDATE research_runs SET current_stage=$1,current_round=$2 WHERE id=$3",
        [next, round, job.run_id],
      );
      await model.enqueue(
        tx,
        job.run_id,
        next,
        { round },
        `${next}:${round}:${job.id}`,
      );
    }
    return true;
  });
}
async function reject(job, owner, error) {
  return db.transaction(async (tx) => {
    if (!(await owns(tx, job, owner))) return;
    const retry = error.retryable === true && !/^(PROVIDER_|SEARCH_|BUDGET_|MOCK_)/.test(error.code || '') && job.attempts < job.max_attempts;
    const code = /^[A-Z_0-9]{1,64}$/.test(error.code || "")
      ? error.code
      : "STAGE_FAILED";
    const safe = {
      code,
      message: `Stage ${job.stage} failed; check provider configuration or retry.`,
    };
    await tx.run(
      "UPDATE stage_jobs SET status=$1,error_json=$2,available_at=$3,locked_by=NULL,locked_until=NULL,completed_at=$4 WHERE id=$5",
      [
        retry ? "retry_waiting" : "failed",
        JSON.stringify(safe),
        new Date(Date.now() + 1000 * 2 ** job.attempts).toISOString(),
        retry ? null : model.now(),
        job.id,
      ],
    );
    await tx.run(
      "UPDATE research_runs SET status=$1,error_code=$2,error_message=$3,updated_at=$4,completed_at=$5 WHERE id=$6",
      [
        retry ? "running" : "failed",
        code,
        safe.message,
        model.now(),
        retry ? null : model.now(),
        job.run_id,
      ],
    );
    await model.event(
      tx,
      job.run_id,
      job.stage,
      retry ? "job.retry_waiting" : "job.failed",
      safe.message,
      { jobId: job.id, code },
    );
  });
}
async function runOnce({
  owner = randomUUID(),
  customProvider,
  handlers,
  signal,
} = {}) {
  const job = await claim(owner);
  if (!job) return false;
  const abort = new AbortController();
  const combined = signal
    ? AbortSignal.any([signal, abort.signal])
    : abort.signal;
  const timeout = setTimeout(() => abort.abort(), 8 * 60 * 1000);
  let beating = false;
  const timer = setInterval(async () => {
    if (beating) return;
    beating = true;
    try {
      if (!(await heartbeat(job, owner))) abort.abort();
    } catch {
      abort.abort();
    } finally {
      beating = false;
    }
  }, 5000);
  try {
    const ctx = await context(job, combined, customProvider);
    const handler =
      handlers?.[job.stage] || require(`../jobs/${job.stage}.job`);
    const output = await handler(ctx);
    ctx.check();
    await commit(job, owner, ctx, output);
  } catch (e) {
    await reject(
      job,
      owner,
      combined.aborted ? provider.fail("JOB_ABORTED", true) : e,
    );
  } finally {
    clearInterval(timer);
    clearTimeout(timeout);
  }
  return true;
}
module.exports = { claim, heartbeat, runOnce, commit, context, reject };
