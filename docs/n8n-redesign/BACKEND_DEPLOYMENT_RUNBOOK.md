# ResearchOS backend deployment / rollback runbook

Prepared 2026-11-09. These steps are for an operator-approved maintenance window. **None of the live deployment, migration, restart, credential binding or publishing steps below was executed in this task.** Use the existing project, networks and volume names. Do not create a replacement production project, re-import SQLite, restore removed workflows, or run `down -v`.

## 1. Preflight and release artifact

1. Review the current dirty tree before building: this release includes prior uncommitted PostgreSQL work, not just this task's five backend-file delta. Run the PostgreSQL/backend and isolated engine checks from the compatibility report. Confirm all five workflow JSON and migrations001–004 retain their recorded hashes. Keep the existing frontend image.
2. Record backend/worker image digest, Compose files/project, start timestamps, effective database/schema, existing networks and mounted volumes. Current observed backend/worker digest is `sha256:9a164266dd7642b8c5fab6f91bb1870bee4a7cc2c49954ef0c58b89c99c07fa4`. Do not retag/delete it. Container names alone are not release identity.
3. Build a **new tag** from the reviewed working tree (`docker build -t researchos-backend:wf-20261109 ./backend`), then record its immutable digest. Build does not authorize deployment. Check the candidate contains `src/schedules/service.js`, migrations001–004 and the corrected internal auth/memory/progress code.
4. Verify the candidate image can run on the target Node/PostgreSQL versions and permissions, including non-root PDF storage where applicable. The CLI engine checks are not a production Docker build/soak test.
5. Never print `docker compose config` or full `docker inspect` environment to shared logs: they can contain secrets. Use `config --quiet` and filtered fields. PostgreSQL must have no public port. Do not connect legacy/staging stacks to production volumes.

## 2. Automation user and secrets (outside Git)

- The operator must choose an **existing active user** that owns the research, PDFs, chats and schedules used by automation. Backend will not impersonate the owner of a target URL. Query only the chosen ID with a bound parameter, e.g. `SELECT id,status FROM users WHERE id = $1`; verify ownership of each referenced object. Do not auto-transfer another user's assets or use ownerId from a webhook.
- In a private environment file **outside the repository**, such as `/etc/researchos/automation.env`, set the non-secret `INTERNAL_RESEARCH_USER_ID=<operator-selected-existing-user-uuid>`. Set this for both Backend and Worker via their existing Compose environment interpolation. Do not put a fixture ID or placeholder into runtime. Existing `docker-compose.yml` and `compose.production.yml` already support it; no Compose edit is required by this fix.
- Keep outbound Backend auth in the existing `INTERNAL_API_KEY` / `INTERNAL_API_KEY_FILE` secret channel. For hardened Compose, provision `${SECRETS_DIRECTORY}/internal_api_key` with restricted permissions; do not put secret contents into this non-secret environment file, shell command arguments or Git. The existing application environment loader handles secret files.
- n8n outbound credential: **Header Auth** with header `X-Internal-Api-Key`. n8n inbound webhook credential: separate **Header Auth** secret chosen by the operator, with different value and purpose. A valid outbound key without a configured active automation user now gets 503; a different owner's resource gets 404. Do not weaken these checks to make an integration green.

For the existing development Compose's fixed image tag, prepare an override **outside Git**, so migrate/backend/worker all resolve the reviewed release digest without retagging the old image:

```yaml
# /etc/researchos/automation-image.override.yml (operator supplies external release env)
services:
  migrate:
    image: ${RESEARCHOS_BACKEND_RELEASE_IMAGE:?Set reviewed immutable digest}
  backend:
    image: ${RESEARCHOS_BACKEND_RELEASE_IMAGE:?Set reviewed immutable digest}
  worker:
    image: ${RESEARCHOS_BACKEND_RELEASE_IMAGE:?Set reviewed immutable digest}
```

Combine this with the **existing** Compose project/file and the external environment file; verify `config --quiet` and filtered image identities. Use `--no-build` for reviewed-image deployment so inherited `build:` cannot silently replace that digest. Hardened `compose.production.yml` already takes `BACKEND_IMAGE`; do not swap a live development project onto that standalone production file without a separately reviewed infrastructure migration.

## 3. Backup before any runtime changes

1. Freeze external triggers/schedules and user writes in an approved window; allow in-flight work to finish or record its state. Do not restart an unreviewed parallel n8n instance.
2. Use PostgreSQL18-compatible `pg_dump --format=custom --no-owner --no-acl` on the **verified production database**, save to a new private encrypted backup destination, enumerate with `pg_restore --list`, and checksum it. `scripts/ops/backup-postgres.sh` provides existing host-side tooling; point it at an explicitly verified DB and a new backup file. Never overwrite a previous backup.
3. Back up shared PDF storage consistently with the database and the existing n8n persistence/encryption-key material using the established quiesced backup procedure. Preserve original SQLite archives/read-only volume; do not run SQLite import/cutover. A live file copy of an n8n SQLite database is not a consistent backup.
4. Rehearse restore into a **separate database/storage destination** before approving the production change. Record backup checksum, restore result, and the rollback image digest.

## 4. Migration004 — explicit operator gate

Current live `researchos.public` has001–003 only. Migration004 creates schedules and the unique dispatch ledger; it has been applied only to the task's isolated PostgreSQL test schemas. It was **not applied to the serving database**.

After backup/preflight approval:

1. Run the migration one-shot from the reviewed candidate backend image, using the **same PGHOST/PGPORT/PGDATABASE/PGSCHEMA/secrets/network** as the existing Backend and Worker. Use the existing `migrate` service or the candidate image's `node src/db/migrate.js`; inspect the resolved image before running. A production release uses its existing external release environment and `BACKEND_IMAGE` digest. Do not run a generic command that targets a new default Compose project or a stale `2.0.0` tag.
2. The migrator checks recorded checksums and applies missing versions transactionally. Any checksum mismatch is a STOP condition, not permission to edit migrations001–003 or tracking rows.
3. Read-only verification: query `postgres_schema_migrations` for001–004 and compare SHA-256 to the candidate SQL files; confirm `research_schedules` and `research_schedule_dispatches` exist with their owner FKs and unique schedule/window key.
4. Only then approve replacing Backend and Worker with the **same reviewed digest** and effective PostgreSQL target. Startup itself calls the migrator, so **do not start the new runtime before this gate** and accidentally apply004 as a side effect.

## 5. Connectivity and controlled verification

- Existing local n8n `ai-research-agent-n8n-1` is configured with network mode `ai-research-agent_research` but currently has no attached network and cannot resolve `backend` (`EAI_AGAIN` in audit). Operator must restore its approved connectivity to Backend's existing research network in the deployment window. Do not attach/recreate any of the other legacy n8n instances. Verify DNS then authenticated HTTP from the intended n8n process; no PostgreSQL port exposure is needed.
- The immutable JSON files use `http://backend:3000`. They target local shared-network deployment. n8n Cloud cannot resolve that hostname. Cloud remains blocked until a separately approved narrow private/HTTPS gateway and reviewed import process exist; this task does not rewrite or publish Cloud workflows.
- Do not expose `/internal/*` globally. If a gateway is used, allow only the necessary paths/methods and enforce service/network controls plus Backend's key/ownership checks. Keep the existing browser proxy separation.
- Recheck Backend readiness, worker heartbeat and image digests. `/health/ready` only checks migration002 in current source: health200 **does not prove004 or automation auth is ready**.
- Use owned disposable research/PDF/chat/schedule assets and mocks in staging. WF01: both modes, resume persisted mode, six stages, retry/cancel and job canonical key. WF02: correct/incorrect document and real status. WF03: citations, request ownership, same clientToken returning409 after ambiguity and history containing only one turn. WF04: array summary only, own memories, no approval. WF05: enabled owned schedule, same window returns the same run, quota/concurrency checks. HTTP202 means accepted, not completed.
- Preserve all five JSON graphs. Credentials are intentionally unbound; bind each Header Auth credential in the operator's environment only after readiness gates. Activation/Publish and paid-provider calls require separate operator approval.

## 6. Rollback

1. Freeze new automation triggers/dispatch and capture progress/leases, error codes, image digests and post-change backups. Never erase jobs or dispatch ledger to force a replay; retry the same canonical key/window/token after inspecting saved state.
2. If code fails, restore the recorded prior Backend/Worker image and external environment through the approved existing deployment process. Keep004 tables/data in place: the migration is additive. Disable scheduled dispatch at the routing/orchestration boundary if the old image cannot serve it. Do not run a destructive down migration.
3. This rollback restores availability but also restores the old internal authorization behavior. Until a corrected release is applied, block internal automation ingress/key use rather than reverting to URL-derived identity as a security workaround.
4. If restoration of data is unavoidable, restore the verified dump and matching PDF snapshot to **new separate destinations** and verify before switching the approved application connection. Do not overwrite/drop the live database or delete old PostgreSQL/SQLite/n8n/PDF volumes. Keep original and failed-release data/backups for reconciliation.
5. Verify schema/image/user/network state and document any work accepted during the failed release. Leave workflows inactive until the relevant gates pass again.
