# Auth and integration review

Verified corrections:

- New passwords accept 6–128 characters consistently in registration and change-password. Login retains compatibility with existing shorter hashes. No account or password migration occurs.
- Registration inserts user and session atomically. Login rechecks the verified password snapshot before issuing a session. Password changes recheck session validity/password snapshot and atomically update hash, revoke old sessions and issue a replacement, preventing concurrent old-password changes or logins from bypassing revocation.
- HTTP Docker cookies work with explicit `COOKIE_SECURE=false`; HTTPS origins always force Secure. Origin CSRF, credential CORS and opaque hashed sessions remain active.
- Explicit proxy address allowlisting and an isolated fixed-address nginx/backend network provide per-client rate limiting without trusting spoofed headers from direct callers. Nginx replaces forwarded client headers.
- Knowledge chat orchestration uses a key-authenticated internal endpoint scoped to the configured automation account, validates research/chat ownership and rejects webhook owner impersonation. No user cookie enters n8n.
- Internal report export owner resolution now handles report-version URLs. Repeated internal key validation and owner resolution moved to a small shared module.
- Settings displays authenticated name/email/role, cancels pending health checks on unmount and wraps long profile text.
- Dashboard reads owner-filtered SQLite counts and recent research via one endpoint, displays loading/error/retry and avoids fetching/validating full memory content for counts. Previously counts were capped by PDF/memory list limits and research history only existed in the browser.
- Heavy research/chat/report pages load on demand. Main JS bundle fell from approximately 394 KB (117 KB gzip) to 282 KB (86 KB gzip); route chunks are fetched as needed.
- Research mount no longer triggers an unconditional duplicate reload. Collection polling and research status polling avoid running two repeating loops for the same active collection task. Auth startup aborts stale requests; context callbacks/value are stable.
- Migration 005 adds only lookup indexes; EXPLAIN QUERY PLAN verifies indexed run child lookups without temporary ordering. Migrations 002/003/004 remain unchanged.
- Offline legacy transfer additionally rejects inconsistent chat/memory/provenance ownership, preserving the backup-first transaction and PDF files.

Reviewed existing safeguards retained: SQLite WAL/serialized transactions, generation/lease checks and heartbeat cleanup in worker, PDF subprocess resource limit/deadline and ingestion recovery, bounded multipart upload, FTS owner filters, citation revalidation, Gemini concurrency/retry budgets and source download size limits. Business logic was retained where no tested change was justified. This review is not a penetration test or a full infrastructure audit.

Deployment configuration and transfer instructions: [authentication.md](authentication.md). No real `.env`, production database, legacy ownership or Docker volumes were modified. No commit, push, merge or deployment was performed. Live VPS HTTPS, actual n8n credential import/activation and paid provider behavior still require staging validation; automated workflows use deterministic mock providers and temporary databases.

## Verification results

- `npm --prefix backend test`: 101 passed, 0 failed/skipped. Includes 5/6/12/128/129-character boundaries, old-password login, session revocation/expiry, two concurrent password changes, held old-password login during a password change, account/session insert rollback, spoofed proxy headers, internal Knowledge Chat isolation and legacy transfer rollback.
- `npm --prefix frontend run build`: passed; main JS 282.62 KB / 86.46 KB gzip.
- `npm --prefix frontend run test:e2e`: 25 passed, including six-character registration/password change, real Settings, expiry without POST replay, Dashboard error/retry, four viewport sizes, cross-account history, PDF/citations and real PDF/DOCX exports.
- `docker compose config --quiet`: passed; validation override also passed.
- `git diff --check`: passed. Migrations 002/003/004 are unchanged.

Ready for code review and merge consideration; run the documented HTTPS/proxy/n8n staging checks before a production release. Process-local rate limits still reset on backend restart. No paid provider, live n8n or VPS deployment verification was performed.

## Files changed

- `.env.example`
- `backend/.env.example`
- `backend/scripts/transfer-legacy.js`
- `backend/src/auth/dashboard.js`
- `backend/src/auth/index.js`
- `backend/src/auth/internal.js`
- `backend/src/config/database.js`
- `backend/src/knowledge/routes.js`
- `backend/src/migrations/005-query-indexes.js`
- `backend/src/routes/run.routes.js`
- `backend/src/server.js`
- `backend/test/auth-password-policy.test.js`
- `backend/test/auth-transfer.test.js`
- `backend/test/auth.test.js`
- `backend/test/n8n-knowledge-auth.test.js`
- `backend/test/proxy.test.js`
- `backend/test/query-indexes.test.js`
- `docker-compose.yml`
- `docs/auth-optimization-review.md`
- `docs/authentication.md`
- `frontend/nginx.conf`
- `frontend/src/App.jsx`
- `frontend/src/auth/AuthProvider.jsx`
- `frontend/src/hooks/useResearch.js`
- `frontend/src/hooks/useSearchAndCollect.js`
- `frontend/src/pages/DashboardPage.jsx`
- `frontend/src/pages/LoginPage.jsx`
- `frontend/src/pages/SettingsPage.jsx`
- `frontend/src/researchos.css`
- `frontend/tests/auth.spec.js`
- `frontend/tests/dashboard-auth.spec.js`
- `n8n/workflows/knowledge/README.md`
- `n8n/workflows/knowledge/research-chat-orchestrator.json`
