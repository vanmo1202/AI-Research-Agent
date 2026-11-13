# Backend ↔ WF01–WF05 compatibility

Audit started 2026-11-09. Scope: current dirty working tree, not HEAD; preserve all prior PostgreSQL migration/scheduling changes and removed legacy files. The four requested prior reports are absent on disk, so historical PASS claims in README are not treated as fresh evidence. No live runtime mutation, migration, restart, Cloud modification or commit is authorized.

## Initial API matrix

| Workflow | Endpoint | Initial code | Evidence / required work |
|---|---|---|---|
| WF01 | POST /internal/research/:requestId/runs; GET .../:runId/progress | PARTIAL | Six stages, stored orchestration and canonical keys exist; internal identity is currently derived from target owner instead of configured service user. |
| WF01 | POST /internal/runs/:runId/jobs; GET /internal/jobs/:jobId?runId= | PARTIAL | Dispatch/poll preserve job/run identity, but service key lacks configured-user ownership checks. |
| WF02 | GET /internal/knowledge/jobs/:jobId?documentId= | DONE (source, pending rerun) | Active configured user, owner/document checks, genuine states and snake_case fields match JSON. |
| WF03 | POST /internal/knowledge/chats/:chatId/messages | DONE (source, pending rerun) | Existing configured-user/request/session checks and clientToken conflict prevent duplicate turns. Keep RAG/citation response unchanged. |
| WF04 | POST /internal/knowledge/maintenance | PARTIAL | Array response matches JSON; currently visits all owners without configured-user authorization and per-batch rollback. |
| WF05 | POST /internal/research/schedules/dispatch | DONE (source, pending rerun) / BLOCKED (runtime) | Existing module/004 and atomic dispatch ledger must be retained. Runtime lacks 004/module and automation user. |

## Implementation / verification plan

Spec: user-provided ten-phase integration request, 2026-11-09 (attachment). Tech: existing Express, pg/PostgreSQL, research worker and unchanged five JSON graphs. No frontend edits, legacy restoration, SQLite cutover, or edits to migrations 001–004.

- [x] Reproduce cross-user internal run/dispatch/poll access using a separate PostgreSQL test database; minimally enforce an active configured automation identity and resource ownership without changing public APIs.
- [x] Reproduce cross-user maintenance and partial invalidation on database failure; keep the WF04 array envelope, scope internal maintenance to configured owner and commit a complete bounded batch atomically.
- [x] Preserve proven document/chat/schedule contracts; expand two-user, timeout/token, concurrent dispatch, lease/fencing, schedule replay/quota and provenance regression checks where missing.
- [x] Run backend PostgreSQL regressions and isolated n8n engine scenarios, verify workflow/migration hashes, and write runtime blockers plus a separate backup/preflight/deploy/verify/rollback runbook.

Review focus: inactive/missing automation identity; service-key access to another user's run/job; stale source updates concurrent with maintenance; replay after ambiguous timeout; production image/schema drift despite healthy status. Each must have test evidence or an explicit deployment blocker. Do not weaken existing idempotency/state/lease checks.

## Final compatibility — evidence from this task

| Workflow | Backend request / response contract retained | Source result | Live deployment |
|---|---|---|---|
| WF01 (33 nodes) | Create accepts options + `Idempotency-Key`, returns202 `{requestId,runId,status,orchestration}`. Resume reads persisted orchestration via progress. Progress includes `requestId/runId/status/orchestration/currentStage/currentJob/percent`; job `id/idempotency_key/status/run_id` matches dispatch/poll expressions. Dispatch accepts only a scheduled stage/canonical key; GET job also requires matching runId. | DONE / PASS | BLOCKED |
| WF02 (13 nodes) | GET job returns actual `id,document_id,status,attempts,error_code,updated_at` inside data. Do **not** rename to camelCase: WF02 explicitly reads `data.document_id` and maps webhook jobId/documentId into its final reply. Optional documentId mismatch409; foreign document/job404. GET never enqueues ingestion. | DONE / PASS | BLOCKED |
| WF03 (10 nodes) | Internal POST body `{requestId,content,clientToken}`; active configured account must own research/session/documents and chat must belong to request. Success remains201 `{success,data:<saved assistant message>}`, workflow returns that envelope. Completed/pending/failed token reuse409 never creates another user/assistant pair. Grounded PDF citation IDs/page/quotes persist; insufficient context stays explicit. | DONE / PASS | BLOCKED |
| WF04 (5 nodes) | POST returns `{success:true,data:[{checked,stale}]}` for the configured owner only. Array preserved for `Array.isArray(r.data)` in the unchanged export. Each bounded batch is all-or-nothing; no approval/delete or private content/owner IDs in summary. Six-hour trigger unchanged. | DONE / PASS | BLOCKED |
| WF05 (7 nodes) | Existing schedule endpoint accepts `{scheduleId,windowKey,requestedAt}` and canonical header `scheduleId:windowKey`. Returns202 data `{scheduleId,windowKey,requestId,runId,status:'accepted',replayed}`. Backend clock determines current Asia/Ho_Chi_Minh date; requestedAt is caller metadata, not trusted authorization/time authority. Duplicate ledger replay reuses saved run, including after disable; new dispatch requires enabled/active ownership and quotas. | DONE / PASS | BLOCKED |

Runtime blockers and detailed operations are tracked in [DEPLOYMENT_READINESS.md](DEPLOYMENT_READINESS.md) and the separate [deployment/rollback runbook](BACKEND_DEPLOYMENT_RUNBOOK.md). There is no missing source endpoint among WF01–WF05 after the fixes. This is not a claim of production activation or Cloud webhook validation.

## Exact backend fixes in this task

Relative to the pre-task dirty working-tree snapshot (not `git diff HEAD`):

- `backend/src/auth/internal.js`: replace URL-derived identity with configured **active** automation user. Add run owner guard for standalone job dispatch/poll; missing/disabled account503, foreign resources404, invalid service secret401. No ownerId/userId payload is trusted.
- `backend/src/routes/run.routes.js`: apply that identity and run-ownership guard before standalone dispatch/poll controllers. Keep stage prerequisites, canonical keys, job state transitions, leases and fencing untouched.
- `backend/src/knowledge/routes.js`: shared configured-user protection for internal knowledge routes; job/chat checks retained; status counts filtered to owner; maintenance wraps one scoped result in the existing array envelope.
- `backend/src/knowledge/memory.js`: bounded per-owner maintenance transaction passes its pg client through source resolution, validation, invalidation and last_checked_at writes. A real PostgreSQL error rolls back the whole batch. No global implicit owner scan, auto-approval or deletion.
- `backend/src/services/run.service.js`: progress uses a read-only REPEATABLE READ snapshot, so a worker commit between run and job reads cannot produce `currentStage='planning'` with `currentJob.stage='collecting'`. AsyncLocalStorage keeps existing model calls on that connection. No provider calls inside the transaction.

No edits were needed to controllers, worker handlers, schedule implementation/004, PDF ingestion/parsing/chunking, PostgreSQL FTS, Gemini/Tavily providers, RAG/citation logic, session authentication, frontend, or deployment configuration. Existing uncommitted work and removals remain intact; nothing was reset or restored.

## Existing features deliberately preserved

- Six stages, evaluation→collection loop within round/search/LLM/source budgets, completed/partial/failed/cancelled states, report/citation checks, retries/cancel/history, immutable evidence versions and lease generation fence.
- Backend mode self-processing versus n8n mode requiring release of already scheduled jobs; stable canonical key reuse and persisted orchestration on resume.
- Owner-scoped document observer, true pending/processing/ready/failed status; upload/parsing/RAG stays in Backend/Worker.
- Research/PDF/combined chats, verified memory opt-in, backend citation validation, safe failure diagnostics, clientToken uniqueness and history recovery.
- Existing migration004, owner-scoped enabled schedules, transactionally unique schedule/window dispatch ledger, per-user/global daily quotas, active-run caps, backend-only scheduled orchestration and canonical-run reuse.

## Tests actually executed

All providers were mocked; no paid Gemini/Tavily call. Test database was **not** production: isolated PostgreSQL18 container `researchos-workflow-tests-20261109`, `researchos_test_workflows`, separate retained volume `researchos_workflow_tests_20261109`, loopback port32768. Preload creates a randomized schema for each test file and refuses non-test database names. The engine fixture uses a separate randomized `engine_*` schema in that same test DB. No existing database/volume was deleted.

| Verification | Actual result |
|---|---|
| New failing tests before fixes | Five service-identity/maintenance tests failed against initial source: foreign run accepted202, missing user accepted202, other user's memory became stale, and failed batch left earlier invalidations committed. A sixth deterministic concurrent writer test reproduced mismatched progress stage/job. |
| Fix verification | Those six tests passed after minimal fixes. Additional internal PDF RAG/concurrent token/timeout/redaction tests, disabled-account/status isolation assertions, and schedule timezone/reuse coverage also pass. |
| `PGHOST=127.0.0.1 PGPORT=32768 PGUSER=researchos PGDATABASE=researchos_test_workflows npm --prefix backend test` | **175/175 PASS**,0 failed,0 skipped. Includes PostgreSQL migration/import/transfer tests against temporary fixtures, auth/public API, PDF parsing/FTS, RAG/citations/memory, run state machine/retry/cancel/evaluation/recovery/fencing, schedules and five immutable workflow contracts. No import was performed against serving data. |
| `python3 scripts/test-researchos-n8n-engine.py --context /tmp/researchos-engine-final-context.json` | **8/8 PASS** using n8n2.46.1 CLI copies in a new temporary container with tmpfs n8n state. All five main flows, WF01 backend handoff, WF03 timeout with one POST attempt, and WF04 database-error branch. Final WF01 n8n observation saw six distinct stage jobs. |
| `docker compose config --quiet` | PASS; no deployment performed and rendered secrets were not printed. |
| SHA-256 protection | Five JSON bytes and SQL001–004 hashes identical to task-start snapshot. No workflow or applied migration edit. |
| Independent read-only review | No Critical/Important findings. Minor coverage suggestion for disabled maintenance identity/status isolation was covered by added assertions before final regression. |

The initial full suite also exposed outdated tests pointing to removed legacy JSON and old service-key impersonation behavior. Updated `auth.test.js`, `flow-v2.test.js`, `knowledge.test.js`, `n8n-knowledge-auth.test.js`, `n8n-v2.test.js` and the maintenance fault-injection boundary in `researchos-integration.test.js` to assert the **current** five exports and configured-account contract; no skipped tests or14 legacy exports restored. Added `researchos-automation-security.test.js`, `researchos-progress-snapshot.test.js`, and appended schedule reuse/timezone coverage to `researchos-schedules.test.js`.

Engine boundary substitutions exist only in generated `/tmp` test copies: manual fixture triggers replace inbound webhooks/schedules, Respond nodes become no-op, waits are shortened, Backend URL/credential references point to mock fixtures, and the schedule variable receives the fixture schedule ID. Real HTTP/Code/IF/Switch/loop execution occurs in n8n. This proves engine compatibility but **not** live inbound Header Auth bindings, Cloud connectivity, production scheduling, provider quality or load/soak behavior. Existing local/Cloud workflows and credentials were not changed.

Test evidence: `/tmp/researchos-backend-regression-final.log`, `/tmp/researchos-automation-red.log`, `/tmp/researchos-progress-red.log`, `/tmp/researchos-fixes-green.log`, `/tmp/researchos-engine-final.log`, `/tmp/researchos-n8n-engine-isce3m93/SUMMARY.json`. Only this compatibility report contains test results; readiness/runbook link here rather than creating duplicate test reports.

## Migration004 and release boundaries

`004_research_schedules.sql` SHA-256: `e812d7c854bf5115d8ae402aa84eba1b96eab873f5d027f7b82554ecbe54ddb9`.

- Serving `researchos.public`: **NOT applied**, no schedule tables.001–003 checksums match source.
- Isolated PostgreSQL test/engine schemas created by this task: **applied and exercised** by175 backend tests /8 engine scenarios.
- Other environments: no unverified deployment claims; v3 public ledger absent, Cloud not mutated.

Current runtime image predates scheduling and these fixes. Source/backend tests PASS does not remove deployment blockers. Existing Compose already provides matching PostgreSQL and automation-user wiring; external environment, reviewed image replacement, migration004 approval and local n8n network repair are operator actions. See the runbook for backup/preflight/migration/verification/rollback gates.

Implementation plan above is complete: all four tasks verified; no commit, push, merge, production migration/restart, SQLite cutover or n8n Publish performed.

Fixture cleanup: only the two backend fixture processes and the PostgreSQL test container created by this task were stopped after verification. Test database/volume were retained; no serving container was stopped or restarted.
