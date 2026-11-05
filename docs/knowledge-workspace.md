# PDF RAG, Research Chat and Agent Memory

## Run

Requires the existing backend Node range (22–24); PDF.js is pinned to 5.4.624. PDF text extraction follows [PDF.js Node support](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions). Two direct dependencies were added: Busboy (streaming multipart) and PDF.js (including its Node canvas primitives). No vector server, Redis, OCR or local model is used.

For Docker, keep existing `.env` files and `INTERNAL_API_KEY`. Supply the new workspace key from your shell or secret manager:

```sh
export KNOWLEDGE_WORKSPACE_KEY="$(openssl rand -hex 32)"
docker compose config --quiet
docker compose up -d --build backend worker frontend n8n
```

These commands are instructions, not an assertion that the stack was deployed. Enter this workspace key in the new UI access form. It is sent in `X-Workspace-Key`, retained in sessionStorage for that tab, never put in a URL or Vite build. Lock workspace clears it. Use HTTPS and a trusted private host; all key holders share one workspace. Missing/short server keys disable all knowledge APIs (503), wrong keys return 401. `ownerId` supplied by clients is ignored.

This is **single-workspace access control**, not user authentication. Legacy research endpoints still have their previous access behavior. Do not expose the whole application publicly without gateway authentication/VPN and TLS. Per-user private research requires real authenticated request ownership before enabling multiple tenants. The workspace key must differ from the existing internal automation key.

For local development, export the same workspace key and optionally `DOCUMENT_STORAGE_PATH=/absolute/private/path` in both backend and worker shells, then run the existing backend, worker and frontend scripts. Without Docker, PDF files default to `backend/data/documents`; files are gitignored and excluded from Docker context.

## Use

1. Open **Thư viện tài liệu**, enter the workspace key and upload a PDF. Processing is asynchronous; backend/worker must share storage and database.
2. Wait for ready. The detail screen provides PDF display, page text, explicit retry, deletion and attach/detach by existing Research Request ID.
3. Open **Chat với nghiên cứu**, select that research, choose PDF/research/combined scope and create a chat. Only ready, attached PDFs can be selected. Sessions keep their original scope; create a new session to change it.
4. Ask a question. Validated citations link to the PDF page or an HTTP(S) source. Unsupported questions return “Chưa đủ thông tin từ tài liệu”. There is no automatic POST retry, evidence analysis or report generation.
5. **Bộ nhớ AI** lists extractive candidates from validated quotes (at most three per answer). Approve/reject/delete explicitly. Cross-research reuse requires both approval for cross-research suggestions and selection when creating a combined chat. Recall only suggests; it never changes another research or silently adds memory.

Session memory is the last six completed chat messages, at most 1,000 characters each. Research memory is an approved quote with provenance in its research. Cross-research memory is an explicitly approved quote that can be suggested elsewhere. Generated prose is never stored as verified factual memory. “Verified” means human approved plus current source/quote integrity, not independent scientific fact checking.

## Storage and resource boundaries

Migration `003-knowledge` is additive and transactional. Existing migration files, tables, n8n v2 workflows and API contracts are unchanged. It adds documents/pages/chunks, attachments, ingestion jobs, chats/messages, memories/links, FTS5 indexes and synchronization/invalidation triggers. No legacy data is migrated into PDF tables.

- PDFs: named volume `document_data:/app/documents`, shared by backend/worker, separate from existing `research_data` and `n8n_data`. UUID storage names, no client-controlled paths, mode 0600 files. No PDF bytes go into images or SQLite.
- Upload: one multipart field `file`, MIME `application/pdf`, `%PDF-` signature, safe `.pdf` filename, 20 MB, 100 pages. Server environment can lower `DOCUMENT_MAX_MB` / `DOCUMENT_MAX_PAGES` (upper bounds 20/100); frontend advertises the defaults. SHA-256 deduplication is per workspace; identical active uploads return the stored document, including its processing/error state.
- Parsing: one global SQLite-leased ingestion job; separate Node process, 192 MB V8 heap, 45-second parse timeout, 90-second lease, at most 2M text characters/2,500 chunks. No rendering, eval, external worker fetch or OCR. Encrypted/invalid/scan/oversized-page PDFs fail clearly. Some pages may contain no text; page text UI exposes that limitation. V8 heap limit is not a total RSS sandbox; worker container has a 768 MB limit, backend 512 MB.
- Restart: expired ingestion lease is recovered up to three attempts with a generation fence. Parser failures wait for explicit user retry. Research worker logic remains separate; production worker ticks both queues. Abandoned processing can take up to the lease duration to recover.
- Quota: 200 active PDFs and 1 GiB active PDF bytes; two simultaneous HTTP uploads. At most 2,000 memory records per workspace, at most three candidates per reply. Limits are deliberately small for a 4 GB VPS.
- Retrieval: SQLite FTS5 (Unicode/diacritics) plus existing lexical relevance service; six chunks by default, maximum eight/10,000 context characters. No embedding bill or semantic vector search. Source/evidence retrieval is bounded to current research (40 sources / 200 evidence rows). Lexical recall may miss paraphrases or poorly extracted text.
- Gemini: existing JSON service and limiter, one durable active knowledge turn across sessions, 25-second provider timeout and 35-second end-to-end model wait, no automatic retry, maximum 2,200 output tokens. An aborted queued call is checked before network dispatch. UI shows latest 100 messages; database retains chat history. A lost response is resolved by GET messages; repeated `clientToken` is rejected (409), not silently replayed. Re-sending with a new token is an explicit new turn.
- PDF/web/history are marked untrusted in the prompt. Every claim needs quotes whose context ID, actual reference/source/document/page and normalized exact text match backend-selected context. No citations outside this context are persisted. Provenance is checked again in the commit transaction. This validates reference integrity, not semantic entailment or complete protection from all model prompt-injection behavior. Users should review source text and approve memories carefully.
- PDF viewer fetches an authenticated blob; keys are never included in file links. Browser-native PDF support is needed; opening the blob in a separate tab is available. Extracted page text remains available if embedded PDF display is unsupported.

Deletion tombstones document metadata, removes page/chunk content and attachments, unlinks bytes, and marks linked memory stale. Source/evidence replacement/deletion also invalidates memories through new triggers; recall/approval revalidates hashes and exact quotes. Chat citation snapshots remain as historical references; deleted PDF links return 404. Rejected/stale memory is never factual context. Chat deletion retains already reviewed memories/provenance (message pointer becomes null).

## APIs

All new APIs require `X-Workspace-Key`; success envelope is `{success:true,data}`. Errors keep the existing `{success:false,error}` form. File endpoint streams PDF. Common responses: 400 validation, 401 access, 403 attachment scope, 404 hidden/missing resource, 409 state/duplicate turn, 413 upload/quota, 429 concurrency/provider rate limit, 502 invalid model citations, 503 disabled workspace/provider timeout.

| Group | Endpoints |
| --- | --- |
| Documents | `POST/GET /api/documents`, `GET/DELETE /api/documents/:id`, `GET /api/documents/:id/file`, `GET /api/documents/:id/pages/:page`, `POST /api/documents/:id/retry` |
| Attachments | `POST /api/research/:id/documents` with `{documentId}`, `DELETE /api/research/:id/documents/:documentId`, `GET /api/documents?researchId=:id` |
| Chats | `POST/GET /api/research/:id/chats`, `GET/POST /api/chats/:id/messages`, `DELETE /api/chats/:id` |
| Memory | `GET /api/memories?status=...`, `GET /api/memories/search?q=...`, `POST /api/memories/:id/approve` with `{crossResearch:boolean}`, `POST /api/memories/:id/reject`, `DELETE /api/memories/:id`, `POST /api/research/:id/memory-recall` with optional `{query}` |

Create chat body: `{title?,scope:"documents"|"research"|"combined",documentIds:[],memoryIds:[]}`. Send message body: `{content,clientToken?}`. Scope, IDs, ready state, ownership and attachments are validated on backend at creation and retrieval. New document or memory IDs cannot be injected by question text. List APIs are bounded (documents 200, chats 100, memories 60); maintenance checks 200 records per execution.

Internal routes (existing `X-Internal-Api-Key`, never the browser key): `GET /internal/knowledge/status`, `GET /internal/knowledge/jobs/:jobId`, `POST /internal/knowledge/maintenance`. They expose job/count metadata or validate memory, never document bytes. Ingestion logs IDs/status only. Existing `/health` contract is preserved, worker heartbeat remains active.

## n8n

See [knowledge workflow import guide](../n8n/workflows/knowledge/README.md). Import the three new JSON files, bind Header Auth credentials, test both outputs, then activate. Backend/worker do not depend on n8n and do not call these webhooks automatically, avoiding orchestration loops. Ingestion webhook is a status observer; schedule maintenance is safe to repeat; chat POST is not auto-retried. Notification destinations are deliberately not preconfigured. Live n8n execution must be verified in your own instance.

## Backup and maintenance

Back up **SQLite and document_data together**. Quiesce upload/chat/research writes and stop backend/worker, then take a consistent SQLite backup using SQLite's `.backup`/online-backup tooling plus a file-volume snapshot. Keep the database/WAL/SHM lifecycle intact; do not copy only a live `.db` file. Encrypt backups, restrict access, and test restoration on a separate database/storage path before using production data. Retain existing n8n backups separately. Never run `docker compose down -v`.

A crash between writing an upload file and committing its metadata may leave an orphan UUID PDF. Failed unlink may leave tombstoned bytes; the server logs a cleanup notice. During a maintenance window compare files with `documents.storage_name`, including tombstones, and archive/review orphans before removing them; do not purge volumes. Deletion does not erase source text already quoted in historical chat snapshots or backups. Apply retention/privacy policy to these copies as well.

## Validation

```sh
npm --prefix backend test
npm --prefix frontend run build
npm --prefix frontend run test:e2e
docker compose config --quiet
```

Tests use temporary databases and PDF directories. Backend PDF tests parse real PDFKit-generated documents, including encrypted/blank/corrupt/page-limited fixtures. Gemini errors/output are stubbed in tests; no paid calls are needed. Browser tests exercise real upload→worker→FTS→chat→citation→approval and mobile layouts, alongside existing Workflow 1/evidence/report regressions. `MOCK_LLM=true` remains explicit test/demo behavior; real Gemini requires existing provider configuration. These checks do not certify live Gemini quality, n8n activation or a resource soak test on a 4 GB VPS.
