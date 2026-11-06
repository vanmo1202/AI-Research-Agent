const { db, check, document, match, hash, normalize } = require("./common");
const { createChunks } = require("../services/chunk.service");
const sourceModel = require("../models/source.model");
const { scoreChunk } = require("../services/relevance.service");
const sourceHash = (s) =>
  hash(JSON.stringify([s.contentVi || s.content || "", s.url]));
async function sourceContexts(requestId) {
  const request = await require('../models/request.model').findById(requestId);
  const sources = require('../services/source-relevance.service').eligibleSources(request || {}, await sourceModel.getSourcesByRequestId(requestId)).slice(
    0,
    40,
  );
  return sources.flatMap((source) =>
    createChunks(requestId, source).map((c) => ({
      kind: "source",
      referenceId: c.id,
      sourceId: source.id,
      content: c.content,
      title: source.displayTitle || source.titleVi || source.title,
      url: source.url,
      versionHash: sourceHash(source),
    })),
  );
}
function score(query, content) {
  const value = scoreChunk(query, content);
  if (value > 0) return value;
  return 0;
}
async function retrieve(session, question, topK = 6) {
  const result = [],
    docIds = JSON.parse(session.document_ids_json);
  if (session.scope !== "research" && docIds.length) {
    // Revalidate access and attachment at every retrieval, not only at session creation.
    for (const id of docIds) {
      await document(id, session.owner_id, true);
      if (session.request_id !== null) check(
        await db.get(
          "SELECT 1 FROM research_documents WHERE request_id=? AND document_id=? AND owner_id=?",
          [session.request_id, id, session.owner_id],
        ),
        "Document no longer attached",
        409,
      );
    }
    const query = require("../services/source-relevance.service").searchTerms(question).map(term => `"${term}"`).join(" OR ");
    if (query) {
      const rows = await db.all(
        `SELECT c.*,d.filename,d.sha256,bm25(document_chunks_fts) AS rank
        FROM document_chunks_fts JOIN document_chunks c ON c.rowid=document_chunks_fts.rowid JOIN documents d ON d.id=c.document_id
        WHERE document_chunks_fts MATCH ? AND d.owner_id=? AND d.status='ready' AND d.deleted_at IS NULL AND d.id IN (${docIds.map(() => "?").join(",")})
        ORDER BY rank LIMIT 24`,
        [query, session.owner_id, ...docIds],
      );
      result.push(
        ...rows.map((r) => ({
          kind: "document",
          referenceId: r.id,
          documentId: r.document_id,
          page: r.page,
          content: r.content,
          title: r.filename,
          versionHash: hash(r.sha256 + r.content_hash),
        })),
      );
    }
  }
  if (session.request_id && session.scope !== "documents") {
    const evidence = await db.all(
      `SELECT e.*,s.title_vi,s.title,s.url,s.content_vi,s.content FROM evidence e JOIN sources s ON s.id=e.source_id WHERE e.request_id=? AND s.request_id=? ORDER BY e.relevance_score DESC LIMIT 200`,
      [session.request_id, session.request_id],
    );
    const currentSources = await sourceContexts(session.request_id);
    const currentChunks = new Map(
      currentSources.map((c) => [c.referenceId, c]),
    );
    result.push(
      ...evidence
        .filter((e) => currentChunks.get(e.chunk_id)?.sourceId === e.source_id)
        .map((e) => ({
          kind: "evidence",
          referenceId: e.id,
          sourceId: e.source_id,
          content: e.evidence_text,
          title: e.title_vi || e.title,
          url: e.url,
          versionHash: hash(
            e.evidence_text +
              sourceHash({
                contentVi: e.content_vi,
                content: e.content,
                url: e.url,
              }),
          ),
        })),
    );
    result.push(...currentSources);
  }
  if (session.scope === "combined") {
    const memory = require("./memory");
    for (const id of JSON.parse(session.memory_ids_json)) {
      const m = await memory.getValid(id, session.owner_id, session.request_id);
      if (!m) continue;
      // Recall only accepted memories, backed by freshly checked source references.
      for (const link of m.links) {
        const original = await memory.resolve(link, session.owner_id);
        if (original)
          result.push({
            ...original,
            memoryId: m.id,
            title: `Bộ nhớ: ${original.title}`,
          });
      }
    }
  }
  const ranked = result
    .map((c) => ({ ...c, score: score(question, c.content) }))
    .filter((c) => c.score > 0.05)
    .sort((a, b) => b.score - a.score);
  const unique = ranked.filter(
    (c, i) =>
      ranked.findIndex((p) => normalize(p.content) === normalize(c.content)) ===
      i,
  );
  let chars = 0;
  return unique
    .slice(0, Math.min(8, Math.max(1, topK)))
    .filter((c) => {
      chars += c.content.length;
      return chars <= 10000;
    })
    .map((c, i) => ({ ...c, contextId: `C${i + 1}` }));
}
module.exports = { retrieve, sourceContexts, sourceHash };
