# Deployment readiness — WF01–WF05

Audit date: 2026-11-09, Asia/Ho_Chi_Minh. **Source integration is tested; serving runtime is BLOCKED.** This report describes this task's evidence, not earlier README claims. No production restart, migration, deployment, commit, n8n Cloud update or Publish was performed.

The four requested previous reports (`docs/POSTGRESQL_MIGRATION_REPORT.md`, `INTEGRATION_REPORT.md`, this readiness file and `CLOUD_SETUP.md` under `docs/n8n-redesign/`) were absent on disk at the start. The compatibility and readiness documents were created here; missing historical migration/Cloud reports were not invented or restored from legacy.

## Runtime evidence (read-only)

| Check | Observed |
|---|---|
| Backend / Worker | Healthy, same immutable image `sha256:9a164266dd7642b8c5fab6f91bb1870bee4a7cc2c49954ef0c58b89c99c07fa4`; source differs from image. Both lack schedules module/004. |
| Backend started / restart count | `2026-11-08T17:36:57.463983203Z` /0. |
| Worker started / restart count | `2026-11-08T17:37:03.365930685Z` /0. |
| Database configuration | Both use PGHOST=postgres, PGPORT=5432, PGDATABASE=researchos, PGUSER=researchos. PostgreSQL has no published host port. No SQLite runtime fallback. |
| Production persistence | Existing `ai-research-agent_postgres_data`, read-only legacy `ai-research-agent_research_data`, shared `ai-research-agent_document_data` retained. |
| Production migration tracking | `researchos.public.postgres_schema_migrations`:001–003 only; both schedule tables absent. No004 applied by this task. |
| Automation identity | `INTERNAL_RESEARCH_USER_ID` empty on both Backend/Worker; internal key present (value never printed). Must select/configure an existing active owned account outside Git. |
| Intended n8n | `ai-research-agent-n8n-1`,2.46.1; start `2026-11-08T01:27:14.906144852Z`, restart count0. Network configuration names research network but attachments are empty; DNS lookup `backend` returns EAI_AGAIN. |
| Other instances | Other legacy/check n8n and a separate v3 database exist. None modified, stopped, recreated or used for tests. The v3 database's public schema has no ResearchOS migration ledger; no cross-environment004 deployment inferred. |
| Health limitations | `/health/ready` checks migration002, not004, image contents, automation identity or n8n connectivity. |

Production checksum ledger, matched to source without editing SQL:

| Migration | SHA-256 | Applied UTC |
|---|---|---|
|001_parity.sql|`5d450975d732eb9ae08e4bc7c7ef529fef01f0f85102c71c493e5ae0f475b9a6`|2026-11-08 08:20:16.362612|
|002_search_and_integrity.sql|`442233f620ff497202a507873fedee31c95a6edfd448b9376080b061940d65b8`|2026-11-08 08:20:16.362612|
|003_fts_word_boundaries.sql|`3c658c0276ed5c023515c051d71f808885a9fe22bc5a70b6390f25e18cca3ecf`|2026-11-08 17:31:54.300182|

## Source changes and tests

See [single compatibility report](BACKEND_WORKFLOW_COMPATIBILITY.md) for API mapping, exact task delta, preservation decisions and test evidence. The five immutable JSON files retain33/13/10/5/7 nodes; migrations001–004 are unchanged. No frontend or existing image/config changes were necessary for these backend fixes.

PostgreSQL validation uses only new isolated container `researchos-workflow-tests-20261109`, database `researchos_test_workflows`, separate volume `researchos_workflow_tests_20261109`, host-loopback dynamic port32768, randomized schemas, mock providers. Migration004 is applied there (test/engine schemas) only. That is not production deployment. No existing database, backup or volume was deleted.

## Workflow release gates

| Workflow | Source/tests | Serving runtime | Remaining release gates |
|---|---|---|---|
| WF01 Full Research | PASS | BLOCKED | New reviewed Backend/Worker digest; configured active owning automation user; intended n8n-to-backend DNS/network and bound credentials. |
| WF02 Document Processing | PASS | BLOCKED | New auth-scoped image, active owner of document/job, intended n8n connectivity. |
| WF03 Research Chat | PASS | BLOCKED | New image/owner/credentials/connectivity; real transport and provider-quality acceptance outside mocks. |
| WF04 Memory Maintenance | PASS | BLOCKED | New scoped transactional maintenance, active owner, intended n8n connectivity; retain six-hour schedule unchanged. |
| WF05 Scheduled Research | PASS | BLOCKED | All common gates plus backup-approved explicit004 migration and enabled owned schedule ID variable. |

## Operator actions, not executed

1. Review the dirty PostgreSQL working tree, build a new immutable backend release, and preserve the rollback digest.
2. Select existing active automation user and set `INTERNAL_RESEARCH_USER_ID` in a private environment file outside Git. Existing Compose supports it for both services.
3. Freeze writes/triggers, take verified PostgreSQL/PDF/n8n backups, rehearse restore into separate destinations.
4. Explicitly approve/run004 against the verified serving database; check checksum tracking; only then replace Backend/Worker with the same candidate digest. Starting new source automatically invokes migration, so it must not bypass this gate.
5. Restore approved local n8n research-network connectivity without touching other instances. Bind distinct inbound webhook/outbound Backend credentials; verify owned assets and quota/replay behavior before activation.

Detailed [deployment and rollback runbook](BACKEND_DEPLOYMENT_RUNBOOK.md). Do not expose PostgreSQL or all internal APIs publicly, reset schedules/ledger, restore14 legacy exports, or Publish Cloud workflows to remove these blockers.

Fixture cleanup: only the two backend fixture processes and the PostgreSQL test container created by this task were stopped after verification. Test database/volume were retained; no serving container was stopped or restarted.
