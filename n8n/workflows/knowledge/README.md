# Knowledge automations

Import the three JSON files through n8n **Import from file**. They are inactive and contain no credentials. Existing v2 workflows are untouched.

Create Header Auth credentials:

- **Knowledge webhook**: choose a separate secret header/value for inbound webhooks; select it on both Webhook nodes. Never expose these webhooks without authentication.
- **Knowledge internal**: `X-Internal-Api-Key` = the backend's existing `INTERNAL_API_KEY`. Select on Backend state in ingestion and maintenance.
- **Knowledge workspace**: `X-Workspace-Key` = `KNOWLEDGE_WORKSPACE_KEY`. Select on Backend state in chat. Do not reuse the internal secret.

URLs on the Compose network use `http://backend:3000`. Webhooks become `/webhook/knowledge/document-ingestion` and `/webhook/knowledge/research-chat-orchestrator` after activation (`/webhook-test/...` while listening in the editor).

- **document-ingestion** receives `{documentId,jobId}` from the upload response and reads durable job status once. It does not parse PDFs or restart jobs. Send another observation later if processing is pending. Backend/worker remain the source of truth.
- **research-chat-orchestrator** receives `{chatId,content,clientToken}` for a previously created chat. Backend validates workspace/scope/citations. No automatic POST retry: if the response is lost, read messages before an explicit retry. A repeated clientToken gets HTTP 409 without another model call.
- **memory-maintenance** checks up to 200 candidate/verified memories every six hours; invalid sources become stale. It never approves memories. Re-running this maintenance POST is safe.

HTTP nodes have timeouts and separate error outputs; safe observer/maintenance requests retry twice. Workflow execution is bounded to 60 seconds, with no loops. Success and error payload storage are disabled to avoid retaining document/chat content. The final result/error node is a notification handoff; connect your chosen notification service yourself after configuring credentials. No external notifications are sent by these files.

Test in the editor with a real upload response / existing chat ID, inspect both success and error outputs, then activate. Disconnect n8n and verify core upload, worker ingestion, chat and memory APIs still operate. JSON structure is tested in this repository; live n8n import/activation has not been verified here.
