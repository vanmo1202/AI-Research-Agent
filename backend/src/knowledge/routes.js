const express = require("express");
const { timingSafeEqual } = require("node:crypto");
const { db, guard, check, research, document, now, text } = require("./common");
const docs = require("./documents");
const chat = require("./chat");
const memory = require("./memory");
const router = express.Router();
const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });
// Guard only the new namespaces; legacy APIs keep their existing contracts.
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
  if (req.query.researchId) await research(req.query.researchId);
  const rows = req.query.researchId
    ? await db.all(
        "SELECT d.* FROM documents d JOIN research_documents r ON d.id=r.document_id WHERE r.request_id=? AND d.owner_id=? AND d.deleted_at IS NULL ORDER BY d.created_at DESC",
        [req.query.researchId, req.owner],
      )
    : await db.all(
        "SELECT * FROM documents WHERE owner_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 200",
        [req.owner],
      );
  ok(res, rows.map(docs.publicDoc));
});
router.get("/documents/:id", async (req, res) => {
  const doc = await document(req.params.id, req.owner);
  const job = await db.get(
    "SELECT id,status,attempts,error_code,updated_at FROM document_ingestion_jobs WHERE document_id=? ORDER BY rowid DESC LIMIT 1",
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
      "SELECT document_id,page,content FROM document_pages WHERE document_id=? AND page=?",
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
  await research(req.params.requestId);
  const doc = await document(text(req.body.documentId, 100), req.owner);
  await db.run("INSERT OR IGNORE INTO research_documents VALUES(?,?,?,?)", [
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
    await research(req.params.requestId);
    await document(req.params.documentId, req.owner);
    await db.run(
      "DELETE FROM research_documents WHERE request_id=? AND document_id=? AND owner_id=?",
      [req.params.requestId, req.params.documentId, req.owner],
    );
    ok(res, { detached: true });
  },
);
router.post("/research/:requestId/chats", async (req, res) =>
  ok(res, await chat.create(req.owner, req.params.requestId, req.body), 201),
);
router.get("/research/:requestId/chats", async (req, res) => {
  await research(req.params.requestId);
  ok(
    res,
    await db.all(
      "SELECT id,title,scope,document_ids_json,memory_ids_json,created_at FROM chat_sessions WHERE owner_id=? AND request_id=? ORDER BY created_at DESC LIMIT 100",
      [req.owner, req.params.requestId],
    ),
  );
});
router.get("/chats/:id/messages", async (req, res) =>
  ok(res, await chat.messages(req.params.id, req.owner)),
);
router.post("/chats/:id/messages", async (req, res) =>
  ok(res, await chat.send(req.params.id, req.owner, req.body), 201),
);
router.delete("/chats/:id", async (req, res) => {
  await chat.session(req.params.id, req.owner);
  await db.run("DELETE FROM chat_sessions WHERE id=? AND owner_id=?", [
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
    "UPDATE agent_memories SET status='rejected',updated_at=? WHERE id=? AND owner_id=?",
    [now(), req.params.id, req.owner],
  );
  check(result.changes, "Memory not found", 404);
  ok(res, { status: "rejected" });
});
router.delete("/memories/:id", async (req, res) => {
  const result = await db.run(
    "DELETE FROM agent_memories WHERE id=? AND owner_id=?",
    [req.params.id, req.owner],
  );
  check(result.changes, "Memory not found", 404);
  ok(res, { deleted: true });
});
router.post("/research/:requestId/memory-recall", async (req, res) => {
  const r = await research(req.params.requestId),
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
internal.use((req, res, next) => {
  const expected = process.env.INTERNAL_API_KEY || "",
    actual = req.get("X-Internal-Api-Key") || "";
  if (
    !expected ||
    Buffer.byteLength(expected) !== Buffer.byteLength(actual) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  )
    return res.status(401).json({ success: false, error: "Unauthorized" });
  next();
});
internal.get("/status", async (req, res) =>
  ok(res, {
    jobs: await db.all(
      "SELECT status,COUNT(*) AS count FROM document_ingestion_jobs GROUP BY status",
    ),
    memories: await db.all(
      "SELECT status,COUNT(*) AS count FROM agent_memories GROUP BY status",
    ),
  }),
);
internal.get("/jobs/:id", async (req, res) => {
  const job = await db.get(
    "SELECT id,document_id,status,error_code,attempts,updated_at FROM document_ingestion_jobs WHERE id=?",
    [req.params.id],
  );
  check(job, "Job not found", 404);
  ok(res, job);
});
internal.post("/maintenance", async (req, res) =>
  ok(res, await memory.maintain()),
);
module.exports = { router, internal };
