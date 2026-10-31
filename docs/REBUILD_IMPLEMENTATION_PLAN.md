# Flow v2 implementation plan

## Baseline (2026-10-31)
Node/Express CommonJS, sqlite3 serialized connection, React/Vite/Router; legacy synchronous APIs for planning/search/analysis/report. Existing content safety, bounded retry, translation and DOCX/PDF exporters can be reused. n8n v1 uses manual execution; root Compose only starts frontend/backend.

Baseline backend: 62 tests passed outside sandbox (sandbox prevents server sockets). Frontend production build passed. No AGENTS.md found. User modification to backend/package-lock.json must be preserved.

## Findings
- requests own mutable sources/chunks/evidence and one report; reruns overwrite history.
- in-memory active sets do not coordinate separate backend/worker processes.
- synchronous provider requests couple HTTP lifetime to business execution.
- no durable stage leases, recovery, cancellation or transactional dispatch.
- browser dashboard history uses localStorage; README understates current implementation.
- frontend production Docker hardcodes localhost API; Compose lacks worker/n8n/healthchecks.

## Target
Modular monolith with additive v2 tables and API. Requests retain legacy compatibility; `executionMode: async` creates a basic request without invoking planner. Runs snapshot input. Stage jobs use SQLite BEGIN IMMEDIATE, lease/fencing and heartbeat; handlers prepare data outside transactions and commit results atomically with success/next job. Immutable sources/chunks/analysis/report versions. Backend owns sequencing and bounded search-more, n8n dispatches idempotently and observes the same jobs; n8n-mode jobs wait for authenticated release before claim. Transactional outbox is an audit of durable local dispatch (no webhook secrets persisted).

## Files / phases
1. config/database + migrations/002-flow-v2; models/run; services/run; validators/run; routes/controller; worker planning; tests.
2. providers/research + six jobs; immutable chunk/evidence/report, bounded evaluation and citation checking; failure tests.
3. frontend API/hooks/pages: server dashboard, creation, run progress and source/evidence/report tabs; preserve legacy routes.
4. n8n/workflows/v2, Docker images/proxy/healthchecks; operational documentation.

## Migration
Back up SQLite before deploy. Initialize adds tables using schema_migrations transaction, leaves existing rows untouched. No automatic conversion of legacy evidence (missing original provenance). Create a new run from existing request to get v2 history. Rollback application leaves additive tables intact. Stop workers before rollback. Never delete production database. Historical reports retain content and references; only lifecycle status changes.

## Verification / commands
`cd backend && npm test`; `cd frontend && npm run build && npm run test:e2e`.
Local: backend `npm start`, separate terminal `npm run worker`, frontend `npm run dev`.
Docker: `docker compose config`, `docker compose build`, `docker compose up -d`; `curl http://localhost:3000/health`; `curl http://localhost:8080`.
Tests must use isolated temporary SQLite; mock providers explicitly marked and must not produce a completed factual run. Track execution results and environmental blockers in docs/REBUILD_VALIDATION.md.
