# Flow v2 API and operations

Responses use `{success:true,data:...}`. Errors use `{success:false,error:...}`. Legacy endpoints remain available. No provider payload or secret is returned in job errors.

| Method/path | Behavior |
|---|---|
| POST /api/research | `executionMode: async` creates a basic request (201); omitted flag preserves legacy synchronous planning |
| GET /api/research | Latest 200 server requests, latestRunId, runStatus |
| POST /api/research/:requestId/runs | 202; mandatory Idempotency-Key; language vi/en, numberOfSources 1–30, searchMore boolean |
| GET /api/research/:requestId/runs/:runId/progress | State, stage/round, completed stages, active job, percent, events, counts, last error; validates request ownership |
| POST /api/research/runs/:runId/retry | Mandatory Idempotency-Key; optional stage; failed/partial only, validates prerequisite; adds a new job |
| POST /api/research/runs/:runId/cancel | Idempotent cancellation; fences pending writes from active worker |
| GET /api/research/runs/:runId/sources | Immutable source versions including original and Vietnamese display content |
| GET /api/research/runs/:runId/evidence | Current analysis with evidence provenance and gaps |
| GET /api/research/runs/:runId/reports | All report versions, newest first; historical content/references preserved |
| GET /api/research/reports/:reportId/export/docx | Export a specific report version |
| GET /api/research/reports/:reportId/export/pdf | Export a specific report version |
| POST /internal/runs/:runId/jobs | X-Internal-Api-Key and canonical Idempotency-Key; body stage; returns scheduled job, never bypasses backend sequencing |
| GET /internal/jobs/:jobId?runId=... | X-Internal-Api-Key; validates run/job association; read is inherently idempotent |

The canonical idempotency key is in progress.currentJob.idempotency_key. Idempotency keys are scoped to a request for run creation, and to a run for jobs. POST internal dispatch replays existing stage jobs even after the run advances. Client retry after HTTP timeout must reuse its key.

## Persistence and execution

Migration `002-flow-v2` runs transactionally at database initialization. Existing requests/sources/chunks/evidence/reports are unchanged. New runs snapshot request input and use separate source_chunks_v2/analysis_versions/report_versions. No source/evidence/report content is overwritten; report lifecycle status can become historical.

Start backend and worker against the same local SQLite file on a persistent filesystem. WAL + 5s busy timeout + BEGIN IMMEDIATE serialize claims. A partial unique index allows only one live job per run. The worker claims with a 30s lease, heartbeats every 5s, and fences commits by owner, generation, lease and run status. Job success, outputs, next-job creation, event and outbox dispatch are atomic. Expired jobs recover up to max_attempts; exhausted jobs fail visibly. Provider calls can repeat after a worker crash, but immutable result commits cannot repeat.

Local worker consumes the transactional outbox by claiming its queued job and marks dispatch sent in the same transaction. Outbox is not an unauthenticated callback queue. Backend validates and schedules progression in both modes. In backend mode the worker executes scheduled jobs automatically. In n8n mode each scheduled job waits for authenticated dispatch to release its outbox entry; backend still chooses every next stage and search-more decision.

## Limits and failure semantics

Per run: at most 30 sources, 16 search HTTP attempts, 32 LLM HTTP attempts including retries, 4 queries per collecting stage, initial round + 2 additional rounds. Each provider attempt times out at 30s, retries at most twice with exponential delay. Each stage has an 8-minute deadline. Job retries are bounded at 3 attempts; invalid output/auth/config failures are not retried automatically. Translation failure preserves original text and is surfaced as failed status. Extraction validates short verbatim quotes against original immutable chunks in the same run.

Coverage evaluator is deterministic: missing questions and explicit conflicting evidence produce gaps or conflicting status; sufficient requires traceable evidence for every question and at least two cited source versions for corroboration. It is a bounded coverage check, not an independent fact-checking service. Composition assembles current verified excerpts in the requested language and short/medium/long evidence density. It does not fabricate narrative claims. Citation verifier rejects unknown sources/labels and mismatched analysis; invalid citations or zero evidence end partial. Corrections via retry retain analysis/report history.

Frontend polls at 1.5–15s with backoff, stops after 240 observations or 6 consecutive failures, and stops on completed/partial/failed/cancelled. Reload recovers by URL. Reconnect restarts observation without creating another run. Dashboard is server-backed; legacy screens still retain their old browser navigation metadata during migration.

## Migration and rollback

1. Stop old workers; back up SQLite consistently (SQLite backup API or stop services before copying db/WAL files).
2. Deploy new backend, initialize additive migration, then deploy worker/frontend.
3. Reuse an existing request ID to create a fresh v2 run. Old evidence is not auto-imported because it lacks v2 provenance.
4. Import n8n workflows and set HTTP Header Auth credentials before activation.
5. Roll back binaries without deleting additive tables. Never delete production volumes to reset a migration.

Public research APIs retain the repository's existing unauthenticated model; bind local ports or supply application access control at deployment. Internal endpoints additionally require their own secret. Graceful stop aborts current provider calls and leaves durable recovery state.
