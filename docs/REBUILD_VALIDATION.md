# Flow v2 validation — 2026-10-31 (Asia/Ho_Chi_Minh)

## Baseline

- Read the complete original README and inspected backend/frontend/database, four legacy n8n workflows and both Compose files.
- Created branch `rebuild/flow-v2`.
- Backend before changes: **62 passed, 0 failed**.
- Frontend before changes: production build passed.
- Sandbox prevents server sockets/process streams; tests were rerun outside sandbox. These environment failures were not counted as passing tests.
- Original user edit: backend/package-lock.json root engines.node. Kept separate from implementation commits.

## Final checks

- Backend `npm test`: **78 passed, 0 failed, 0 skipped**.
- Frontend `npm run build`: passed.
- Frontend `npm run test:e2e`: **11 passed**, including all legacy browser tests.
- `docker compose config --quiet`: passed with a temporary shared INTERNAL_API_KEY.
- `docker compose build`: passed (backend/frontend/worker; exact base tags pinned).
- `docker compose up -d --build`: passed in an isolated project; backend, worker, frontend, n8n all healthy.
- New backend health: HTTP 200 on 13000. New frontend and same-origin API proxy: HTTP 200 on 18080. New n8n health: HTTP 200 on 15678.

Existing containers `ai-research-backend`, `ai-research-frontend`, `ai-research-n8n` already occupied 3000/8080/5678. They were not stopped, replaced or migrated. V2 verification used project **ai-research-flow-v2-check**, distinct named volumes and [validation override](../docker-compose.validation.yml). No production rows or legacy database were used for tests.

## Actual n8n integration

All seven workflow definitions were created successfully in n8n 2.0.3. Full workflow was activated with an HTTP Header Auth credential pointing to the isolated backend key. The exported repository JSON contains no secret or test credential.

- Six-stage webhook execution: succeeded, observed all six completed stages; mock run correctly ended **partial** with 0 factual evidence, 8 mock sources. Duration ~31 seconds.
- Same webhook/requestId/idempotencyKey replay: same run ID, **one report**, no repeated stages.
- Search-more webhook execution: exactly **two additional rounds**, **24 mock sources**, then partial; duration ~63 seconds.
- Search-more execution replay: same run, one report.
- Both report-version DOCX and PDF downloads passed against the Nginx proxy.
- Cancel API passed against the Docker backend.
- Full workflow includes the IF search_more branch and cooldown; backend bounds/chooses the loop and n8n releases only canonical scheduled jobs.

CLI import in n8n 2.0.3 accepts the JSON but does not establish publication history. CLI publish then fails with version-not-found. Saving via the editor/API and publishing works; integration used the API. This is documented in the workflow README. Missing Python runner is logged by this n8n image; all workflow Code nodes use JavaScript and executed successfully.

## Required scenarios

| Scenario | Evidence |
|---|---|
| Create research/run | HTTP 201 basic request, 202 run tests; browser and Docker/n8n |
| Planner failure | Legacy provider tests + v2 injected failure with sanitized error and retry |
| One query fails | Existing search isolation tests; v2 bounded provider retry and per-query warning path |
| All queries fail | Existing search tests + v2 SEARCH_UNAVAILABLE provider assertion |
| Provider timeout | Existing transport tests + v2 timeout retry test |
| Translation failure | Existing translation tests + v2 preserved original content / failed display translation |
| No evidence | Mock v2 run must end partial; browser and actual n8n |
| Insufficient evidence/search_more | Two-round test + actual n8n loop, no infinite execution |
| Retry job | Idempotent manual retry; transient retry_waiting test; retry preserves earlier evidence timestamps |
| Reload frontend | Playwright reloads run URL, resumes observation, terminal polling stops |
| Cancel | Queued and in-flight cancellation; cancelled job cannot commit output; Docker cancel |
| n8n replay | Two actual webhook executions with same key, same run/report |
| Duplicate idempotency key | API/service replay and mismatched-input 409 |
| Two workers | Concurrent same-process claims and two independent Node processes against one SQLite file |
| Invalid citation | Verifier produces partial; rejects unknown labels, foreign references, stale analysis, absent sections/citations |
| Report history | New report version leaves previous content intact, marks historical, exports historical version |

Additional checks cover migration idempotency, expired lease recovery, generation fencing, retained evidence during a later provider outage, cross-run evidence rejection, coverage schema consistency, internal auth/ownership and workflow graph integrity.

## Phase delivery

| Phase | Files and API | Verification | Run commands |
|---|---|---|---|
| Persistence/API | migration 002, run model/service/controller/routes, validators, database initialization; create/progress/retry/cancel and internal APIs | Full backend suite | `cd backend && npm start`; worker in separate terminal |
| Pipeline | six jobs, research provider, worker runner/health, version export; sources/evidence/reports/export APIs | Full backend suite, cross-process tests, both exports | `cd backend && npm run worker` |
| UI | server dashboard, creation/progress pages, run API/hook, sidebar/routes, proxy defaults; legacy pages preserved | Vite build and 11 Playwright tests | `cd frontend && npm run dev` |
| Orchestration/deploy | seven v2 workflows, root Compose and validation override, pinned Dockerfiles/Nginx, env examples/docs | config/build/up, health, actual webhook/replay/loop | `docker compose up -d --build` after root .env setup |

## Reproduce isolated Docker verification

Create a temporary env file with a random INTERNAL_API_KEY (do not commit it). Current session used `/tmp/flow-v2-compose.env`.

```bash
docker compose --env-file /tmp/flow-v2-compose.env -p ai-research-flow-v2-check \
  -f docker-compose.yml -f docker-compose.validation.yml config --quiet
docker compose --env-file /tmp/flow-v2-compose.env -p ai-research-flow-v2-check \
  -f docker-compose.yml -f docker-compose.validation.yml up -d --build
curl http://localhost:13000/health
curl http://localhost:18080
curl http://localhost:15678/healthz
```

## Material limits

- Gemini/Tavily live paid calls were not made. Transport, malformed output, timeouts, budgets and failure paths use explicit provider stubs; Docker/n8n runs use labeled mock mode. Real provider credentials are still required for factual evidence.
- Evaluator checks question coverage, corroboration count and explicit conflict flags. It does not independently verify source truthfulness or perform peer review. Report includes this limitation.
- Composition is an evidence-based structured synthesis, with length controlling evidence density. It deliberately does not invent free-form conclusions absent from current evidence.
- Legacy request-level APIs retain their synchronous behavior and mutable legacy data during migration. New run-based APIs use immutable versions.
- No automatic deployment or replacement of the existing stack was performed. The review stack remains available on 18080 with isolated data.

## Dependency security follow-up

Docker's initial npm install reported body-parser/qs/undici advisories (2 high, 1 moderate). Compatible lockfile updates patched these runtime dependencies. The full audit also identified nodemon's minimatch dependency; a scoped override to minimatch ^11.0.1 preserves nodemon's existing API and avoids npm's suggested breaking downgrade. A real nodemon matcher smoke check confirms JavaScript files match and node_modules remains ignored. Final npm install/audit reports **0 vulnerabilities**. Backend suite was rerun after updates.

Host backend tests used Node 24.21.0; repository engine preference remains Node 22 and Docker integration uses pinned Node 22.14.0. The user's pre-existing lockfile engine edit remains unstaged after the dependency patch is committed.
