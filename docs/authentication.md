# User authentication and ownership

Public research, Flow v2, PDF, chat and memory endpoints require a session. Register at `/register`; login at `/login`. Registration never claims legacy data. Email uniqueness is case insensitive; names are limited to 100 characters and passwords to 12–128 characters. Passwords use Node scrypt with a separate random salt. Opaque random 256-bit sessions last seven days; only SHA-256 token hashes are stored in SQLite. Logout revokes the current session. Changing a password requires the current password and revokes every previous session before issuing a new one. No email password recovery is implemented because no email delivery service is configured.

`users.role` supports user/admin, but there are no public role management or legacy claim endpoints. Identity comes exclusively from the session. Research child resources inherit authorization from `requests.owner_id`; documents/chat/memories also check their own owner. Exports resolve ownership before generating bytes. Legacy `workspace` remains a locked sentinel, never a registered user. PDF storage paths, citations and provenance are preserved.

## Configuration

Edit configuration yourself; this change does not modify real `.env` files.

- `FRONTEND_ORIGIN`: exact browser origin including scheme and port, without trailing slash. Compose defaults to `http://localhost:8080`; local backend defaults to `http://localhost:5173`. HTTPS example: `https://research.example.com`.
- `COOKIE_SECURE=true` for HTTPS. `NODE_ENV=production` also forces Secure. Cookies are HttpOnly, SameSite=Lax, Path=/ with seven-day expiry. Use frontend and backend on the same site; the supplied nginx proxies `/api` with cookies and blocks `/internal`.
- Keep `INTERNAL_API_KEY` shared with worker/n8n. It cannot authenticate public `/api` requests.
- Optional `INTERNAL_RESEARCH_USER_ID`: existing active user UUID to own research created by trusted internal automation. Unset means internal creation fails closed. Existing internal research operations resolve the stored research owner.
- `AUTH_RATE_LIMIT` defaults to 30 register/login/password-change attempts per IP per 15 minutes. State is process-local and resets on restart. Behind nginx the backend sees the proxy address, so the default limit is shared across users. Add gateway rate limiting suited to your deployment before scaling traffic; the stack remains a single backend process.

Unsafe public requests require an Origin (or Referer) matching `FRONTEND_ORIGIN`. This includes scripts using public session APIs. CORS allows credentials only for the configured origin. Frontend uses credentials on JSON, multipart and exports; a 401 redirects to login without replaying POST requests. Browser history is namespaced by authenticated user UUID. Old unscoped research metadata is retained but never read; the obsolete workspace key is removed from sessionStorage.

## Migration and legacy transfer

Migration `004-user-auth.js` runs after existing migrations in backend and worker startup. It creates `users`, `user_sessions`, their constraints/indexes, and `requests.owner_id` defaulting to `workspace`, inside a transaction. Earlier migrations are unchanged. A schema migration marker makes repeated startup safe. Ordinary accounts cannot see legacy rows.

Transfer is an explicit offline administrator operation, not an API. This tool transfers **all** remaining `workspace` records to one nominated account. If the historical workspace contains data for multiple people, do not use the all-workspace tool: prepare a reviewed selective migration covering each research/document/chat/memory relationship first.

1. Back up the existing SQLite volume and PDF volume through your usual backup process. Register the intended account normally and verify its email independently.
2. Stop backend and worker so no jobs or uploads are active; keep the volumes intact. Never use `docker compose down -v`.
3. Run against the existing database with backend dependencies available, from the repository root:

   ```sh
   RESEARCH_DB_PATH=/absolute/path/to/research.db node backend/scripts/transfer-legacy.js verified-owner@example.com --transfer-all-workspace
   ```

   For Docker volumes, run the same command in a one-off backend container with the existing mounts and backend/worker stopped:

   ```sh
   docker compose run --rm --no-deps backend node scripts/transfer-legacy.js verified-owner@example.com --transfer-all-workspace
   ```

4. The command requires an existing active user, creates a consistent `VACUUM INTO` backup beside the database (including committed WAL pages), then updates legacy research/documents/attachments/chats/memories in one transaction. A constraint error or inconsistent attachment ownership rolls back all changes. PDF files and child provenance rows are not rewritten. Record the backup path printed by the command and copy it to protected backup storage.
5. Restart backend/worker; sign in as the nominated user and verify research, citations, PDFs and reports. To restore, stop services and restore the full SQLite backup with the matching PDF backup using your normal offline SQLite restore procedure. Do not overwrite an active database or leave stale WAL/SHM files from another database.

The application does not perform the transfer automatically, and this implementation task has not run it against existing data.

## Internal n8n workflows

Updated workflow JSON calls `/internal/research` and uses a named n8n HTTP Header Auth credential `Research Internal API`: header `X-Internal-Api-Key`, value your real internal key. Replace the placeholder credential ID when importing. No secret is embedded in workflow files. Existing `/internal/runs/:runId/jobs`, `/internal/jobs/:jobId` and `/internal/knowledge/*` retain key authentication. Internal operations are privileged and must stay on the Docker network/loopback, behind the nginx deny rule. Do not expose the backend port publicly. Internal research creation requires the explicit owner configuration above.

## Verification

Run `npm --prefix backend test`, `npm --prefix frontend run build`, `npm --prefix frontend run test:e2e`, and `docker compose config --quiet`. Tests use temporary SQLite databases and real test sessions; fixture ownership assignment exists only in test helpers. The new migration test injects a failure after ALTER TABLE and verifies SQLite rolls back both the new tables and column before retry. Auth tests cover CSRF, throttling, expiry, revocation, password changes, legacy locking and cross-user read/write/export denial. Browser auth tests exercise registration/login/refresh/logout and return destinations at 375/768/1024/1440px.
