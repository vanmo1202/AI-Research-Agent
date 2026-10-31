# Flow v2 orchestration

Import JSON into n8n 2.0.3, save it in the editor, then publish it. CLI import on this version does not create publication history; save through the editor/API before publishing. Assign an **HTTP Header Auth** credential to every internal HTTP node: name `X-Internal-Api-Key`, value equal to backend `INTERNAL_API_KEY`. Secrets are never embedded in workflow JSON. Protect production webhooks with n8n webhook authentication before activation.

Create a basic request with `POST /api/research` and `executionMode: "async"` first. Then call the full pipeline webhook with:

```json
{"requestId":"UUID","idempotencyKey":"client-stable-key","options":{"language":"vi","numberOfSources":12,"searchMore":true}}
```

The create-run workflow only creates/replays a run. Other orchestrators attach to an existing run: add `runId` in the webhook body. They release and observe the backend-authoritative pipeline, including stages preceding/following their named stage; they cannot bypass prerequisite stages. `jobId` and canonical stage idempotency key come from progress. The full pipeline follows backend stages via Switch, dispatches the scheduled job idempotently, waits, polls job and progress, then returns terminal output. Backend worker owns business execution and two-round search-more limit; orchestration=n8n gates each queued job until its canonical dispatch is received. Replaying the full execution with the same requestId/options/idempotencyKey returns the same run; it never recreates evidence/report. A failed run needs the explicit retry API.

Polling is bounded at 240 iterations and 3600 seconds; return the run ID and reconnect through progress if the observation budget ends. Wait+Code loop is the serialized equivalent of Loop Over Items. HTTP nodes retry transport failures at most 3 times, error outputs return a sanitized response. If n8n stops, an active job finishes and the next scheduled stage waits safely for a restarted observer. The dispatch_outbox is consumed by the local durable worker, not sent as an external webhook.

Root Compose provides DNS `backend:3000`. Standalone n8n users must replace this origin with the reachable backend origin. JSON validation and backend idempotency are automated; live import/execution must also be verified against the running n8n instance (see validation report).
