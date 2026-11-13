const express = require("express");
const { db, guard, check, research, document, now, text } = require("./common");
const docs = require("./documents");
const chat = require("./chat");
const memory = require("./memory");
const router = express.Router();
const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });
// Session authentication is enforced globally; validate Knowledge JSON bodies here.
router.use(
  [
    "/documents",
    "/chats",
    "/memories",
    "/research/:requestId/documents",
    "/research/:requestId/chats",
    "/research/:requestId/memory-recall",
  ],
  guard,
);
router.get('/knowledge/config', (req, res) => ok(res, {
  autoResearch: require('./auto-budget').limits(),
  maxUploadBytes: docs.maxBytes(), maxPages: require('../utils/settings').positiveInteger('DOCUMENT_MAX_PAGES', 100, 100), ocr: false,
}));
router.post("/documents", async (req, res) => {
  const count = await db.get(
    "SELECT COUNT(*) AS n,COALESCE(SUM(byte_size),0) AS bytes FROM documents WHERE deleted_at IS NULL",
  );
  check(
    count.n < 200 && count.bytes < 1024 * 1024 * 1024,
    "Workspace storage quota reached",
    413,
  );
  const result = await docs.upload(req, req.owner);
  ok(res, result, result.duplicate ? 200 : 202);
});
router.get("/documents", async (req, res) => {
  if (req.query.researchId) await research(req.query.researchId, req.owner);
  const rows = req.query.researchId
    ? await db.all(
        "SELECT d.* FROM documents d JOIN research_documents r ON d.id=r.document_id WHERE r.request_id=$1 AND d.owner_id=$2 AND d.deleted_at IS NULL ORDER BY d.created_at DESC",
        [req.query.researchId, req.owner],
      )
    : await db.all(
        "SELECT * FROM documents WHERE owner_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 200",
        [req.owner],
      );
  ok(res, rows.map(docs.publicDoc));
});
router.get("/documents/:id", async (req, res) => {
  const doc = await document(req.params.id, req.owner);
  const job = await db.get(
    "SELECT id,status,attempts,error_code,updated_at FROM document_ingestion_jobs WHERE document_id=$1 ORDER BY legacy_position DESC LIMIT 1",
    [doc.id],
  );
  ok(res, { ...docs.publicDoc(doc), job });
});
router.get("/documents/:id/file", async (req, res) => {
  const doc = await document(req.params.id, req.owner, true);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'",
  });
  res.sendFile(docs.storagePath(doc.storage_name));
});
router.get("/documents/:id/pages/:page", async (req, res) => {
  const doc = await document(req.params.id, req.owner, true);
  check(
    /^\d+$/.test(req.params.page) &&
      +req.params.page > 0 &&
      +req.params.page <= doc.page_count,
    "Invalid page number",
  );
  ok(
    res,
    await db.get(
      "SELECT document_id,page,content FROM document_pages WHERE document_id=$1 AND page=$2",
      [doc.id, +req.params.page],
    ),
  );
});
router.post("/documents/:id/retry", async (req, res) =>
  ok(res, await docs.retry(req.params.id, req.owner), 202),
);
router.delete("/documents/:id", async (req, res) => {
  await docs.remove(req.params.id, req.owner);
  ok(res, { deleted: true });
});
router.post("/research/:requestId/documents", async (req, res) => {
  await research(req.params.requestId, req.owner);
  const doc = await document(text(req.body.documentId, 100), req.owner);
  await db.run("INSERT INTO research_documents VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING", [
    req.params.requestId,
    doc.id,
    req.owner,
    now(),
  ]);
  ok(res, { attached: true });
});
router.delete(
  "/research/:requestId/documents/:documentId",
  async (req, res) => {
    await research(req.params.requestId, req.owner);
    await document(req.params.documentId, req.owner);
    await db.run(
      "DELETE FROM research_documents WHERE request_id=$1 AND document_id=$2 AND owner_id=$3",
      [req.params.requestId, req.params.documentId, req.owner],
    );
    ok(res, { detached: true });
  },
);
router.post("/research/:requestId/chats", async (req, res) =>
  ok(res, await chat.create(req.owner, req.params.requestId, req.body), 201),
);
router.get("/research/:requestId/chats", async (req, res) => {
  await research(req.params.requestId, req.owner);
  ok(
    res,
    await db.all(
      "SELECT id,title,scope,request_id,document_ids_json,memory_ids_json,created_at,auto_research,internet_enabled FROM chat_sessions WHERE owner_id=$1 AND request_id=$2 ORDER BY created_at DESC LIMIT 100",
      [req.owner, req.params.requestId],
    ),
  );
});
// Document-only sessions require no research creation or planner/provider call.
router.post('/chats', async (req, res) => {
  check(req.body.requestId === undefined || req.body.requestId === null, 'Use research chat endpoint for research context');
  ok(res, await chat.create(req.owner, null, req.body), 201);
});
router.get('/chats', async (req, res) => ok(res, await db.all(
  'SELECT id,title,scope,request_id,document_ids_json,memory_ids_json,created_at,auto_research,internet_enabled FROM chat_sessions WHERE owner_id=$1 ORDER BY created_at DESC,legacy_position DESC LIMIT 100', [req.owner])));
router.get('/chats/:id', async (req, res) => {
  const { owner_id, active_token, busy_until, ...safe } = await chat.session(req.params.id, req.owner);
  ok(res, safe);
});
router.patch('/chats/:id/preferences', async (req,res) => {
  const {owner_id,active_token,busy_until,...safe}=await chat.preferences(req.params.id,req.owner,req.body);
  ok(res,safe);
});
router.get("/chats/:id/messages", async (req, res) =>
  ok(res, await chat.messages(req.params.id, req.owner, req.query.before)),
);
router.post("/chats/:id/messages", async (req, res) =>
  ok(res, await chat.send(req.params.id, req.owner, req.body), 201),
);
router.delete("/chats/:id", async (req, res) => {
  await chat.session(req.params.id, req.owner);
  await db.run("DELETE FROM chat_sessions WHERE id=$1 AND owner_id=$2", [
    req.params.id,
    req.owner,
  ]);
  ok(res, { deleted: true });
});
router.get("/memories", async (req, res) =>
  ok(res, await memory.list(req.owner, "", req.query.status)),
);
router.get("/memories/search", async (req, res) =>
  ok(
    res,
    await memory.list(req.owner, text(req.query.q, 1000), req.query.status),
  ),
);
router.post("/memories/:id/approve", async (req, res) => {
  check(
    req.body.crossResearch === undefined ||
      typeof req.body.crossResearch === "boolean",
    "Invalid sharing choice",
  );
  ok(
    res,
    await memory.approve(
      req.params.id,
      req.owner,
      req.body.crossResearch === true,
    ),
  );
});
router.post("/memories/:id/reject", async (req, res) => {
  const result = await db.run(
    "UPDATE agent_memories SET status='rejected',updated_at=$1 WHERE id=$2 AND owner_id=$3",
    [now(), req.params.id, req.owner],
  );
  check(result.changes, "Memory not found", 404);
  ok(res, { status: "rejected" });
});
router.delete("/memories/:id", async (req, res) => {
  const result = await db.run(
    "DELETE FROM agent_memories WHERE id=$1 AND owner_id=$2",
    [req.params.id, req.owner],
  );
  check(result.changes, "Memory not found", 404);
  ok(res, { deleted: true });
});
router.post("/research/:requestId/memory-recall", async (req, res) => {
  const r = await research(req.params.requestId, req.owner),
    question = req.body.query ? text(req.body.query) : `${r.topic} ${r.goal}`;
  const rows = await memory.list(req.owner, question, "verified");
  ok(
    res,
    rows
      .filter((m) => m.request_id === r.id || m.kind === "cross_research")
      .slice(0, 8),
  );
});
const internal = express.Router();
internal.use(require("../auth/internal").internalAuth, require("../auth/internal").internalResearchOwner);
// Service automation is scoped to an explicitly configured account, never to webhook owner input.
internal.post("/chats/:id/messages", async (req, res) => {
  const user = req.user;
  const requestId = text(req.body?.requestId, 100);
  await research(requestId, user.id);
  const session = await chat.session(req.params.id, user.id);
  check(session.request_id === requestId, "Chat not found", 404);
  ok(res, await chat.send(session.id, user.id, req.body), 201);
});
internal.get("/status", async (req, res) =>
  ok(res, {
    jobs: await db.all(
      "SELECT j.status,COUNT(*) AS count FROM document_ingestion_jobs j JOIN documents d ON d.id=j.document_id WHERE d.owner_id=$1 GROUP BY j.status", [req.owner],
    ),
    memories: await db.all(
      "SELECT status,COUNT(*) AS count FROM agent_memories WHERE owner_id=$1 GROUP BY status", [req.owner],
    ),
  }),
);
internal.get("/jobs/:id", async (req, res) => {
  const user = req.user;
  const job = await db.get(
    "SELECT j.id,j.document_id,j.status,j.error_code,j.attempts,j.updated_at FROM document_ingestion_jobs j JOIN documents d ON d.id=j.document_id WHERE j.id=$1 AND d.owner_id=$2 AND d.deleted_at IS NULL",
    [req.params.id,user.id],
  );
  check(job, "Job not found", 404);
  if(req.query.documentId!==undefined)check(req.query.documentId===job.document_id,"Job does not belong to documentId",409);
  ok(res, job);
});
internal.post("/maintenance", async (req, res) =>
  ok(res, [await memory.maintain(req.owner)]),
);
module.exports = { router, internal };
