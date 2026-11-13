const { randomUUID } = require("node:crypto");
const { db, hash, now, check, match, normalize } = require("./common");
const { sourceHash } = require("./retrieval");
const { createChunks } = require("../services/chunk.service");
async function resolve(link, owner, connection = db) {
  if (link.kind === "source" && String(link.source_id).startsWith("web:"))
    return require("./auto-research").resolve(link, owner, connection);
  if (link.kind === "document") {
    const c = await connection.get(
      `SELECT c.*,d.sha256,d.filename FROM document_chunks c JOIN documents d ON d.id=c.document_id
      WHERE c.id=$1 AND d.owner_id=$2 AND d.status='ready' AND d.deleted_at IS NULL`,
      [link.reference_id, owner],
    );
    if (!c || c.document_id !== link.document_id || c.page !== link.page)
      return null;
    return {
      kind: "document",
      referenceId: c.id,
      documentId: c.document_id,
      page: c.page,
      title: c.filename,
      content: c.content,
      versionHash: hash(c.sha256 + c.content_hash),
    };
  }
  if (link.kind === "evidence") {
    const e = await connection.get(
      "SELECT e.*,s.title,s.url,s.content_vi,s.content,s.source_language,s.translation_status,r.topic,r.goal,r.scope FROM evidence e JOIN sources s ON s.id=e.source_id JOIN requests r ON r.id=e.request_id WHERE e.id=$1 AND s.id=$2 AND r.owner_id=$3",
      [link.reference_id, link.source_id, owner],
    );
    if (
      !e ||
      !require("../services/source-relevance.service").evaluateSource(e, { content: e.content, contentVi: e.content_vi, title: e.title }).accepted ||
      !createChunks(e.request_id, {
        id: e.source_id,
        content: e.content,
        contentVi: e.content_vi,
        sourceLanguage: e.source_language,
        translationStatus: e.translation_status,
      }).some((c) => c.id === e.chunk_id)
    )
      return null;
    return {
      kind: "evidence",
      referenceId: e.id,
      sourceId: e.source_id,
      content: e.evidence_text,
      title: e.title,
      url: e.url,
      versionHash: hash(
        e.evidence_text +
          sourceHash({
            contentVi: e.content_vi,
            content: e.content,
            url: e.url,
          }),
      ),
    };
  }
  const row = await connection.get("SELECT s.*,r.topic,r.goal,r.scope FROM sources s JOIN requests r ON r.id=s.request_id WHERE s.id=$1 AND r.owner_id=$2", [
    link.source_id, owner,
  ]);
  const source = row && {
    id: row.id,
    requestId: row.request_id,
    content: row.content,
    contentVi: row.content_vi,
    url: row.url,
    title: row.title_vi || row.title,
    sourceLanguage: row.source_language,
    translationStatus: row.translation_status,
  };
  if (!source || !require("../services/source-relevance.service").evaluateSource(row, source).accepted) return null;
  const chunk = createChunks(source.requestId, source).find(
    (c) => c.id === link.reference_id,
  );
  return chunk
    ? {
        kind: "source",
        referenceId: chunk.id,
        sourceId: source.id,
        content: chunk.content,
        title: source.title,
        url: source.url,
        versionHash: sourceHash(source),
      }
    : null;
}
async function validate(m, owner, connection = db) {
  const links = await connection.all(
    "SELECT * FROM memory_evidence_links WHERE memory_id=$1",
    [m.id],
  );
  let valid = links.length > 0 && m.content_hash === hash(normalize(m.content));
  for (const link of links) {
    const source = await resolve(link, owner, connection);
    link.title = source?.title || null;
    link.url = source?.url || null;
    if (
      !source ||
      normalize(link.quote).length < 12 ||
      normalize(m.content) !== normalize(link.quote) ||
      source.versionHash !== link.version_hash ||
      !normalize(source.content).includes(normalize(link.quote))
    )
      valid = false;
  }
  if (!valid && !["stale", "rejected"].includes(m.status)) {
    await connection.run(
      "UPDATE agent_memories SET status='stale',updated_at=$1 WHERE id=$2",
      [now(), m.id],
    );
    m.status = "stale";
  }
  return { ...m, links, valid };
}
async function getValid(id, owner, requestId) {
  const m = await db.get(
    "SELECT * FROM agent_memories WHERE id=$1 AND owner_id=$2 AND status='verified' AND (request_id IS NOT DISTINCT FROM $3 OR kind='cross_research')",
    [id, owner, requestId],
  );
  if (!m) return null;
  const result = await validate(m, owner);
  return result.valid ? result : null;
}
async function candidates(session, messageId, citations) {
  // Extractive candidates: no unverified generated sentence is promoted to factual memory.
  for (const c of citations.slice(0, 3)) {
    if (c.memoryId) continue;
    const content = normalize(c.quote).slice(0, 1000),
      contentHash = hash(content);
    if (content.length < 20) continue;
    await db.transaction(async (tx) => {
      const live = await resolve(
        {
          kind: c.kind,
          reference_id: c.referenceId,
          document_id: c.documentId,
          page: c.page,
          source_id: c.sourceId,
        },
        session.owner_id,
        tx,
      );
      if (!live || live.versionHash !== c.versionHash || !normalize(live.content).includes(content)) return;
      const count = await tx.get(
        "SELECT COUNT(*) AS n FROM agent_memories WHERE owner_id=$1",
        [session.owner_id],
      );
      if (count.n >= 2000) return;
      const id = randomUUID();
      const inserted = await tx.run(
        "INSERT INTO agent_memories(id,owner_id,request_id,message_id,kind,content,content_hash,status,created_at,updated_at) VALUES($1,$2,$3,$4,'research',$5,$6,'candidate',$7,$8) ON CONFLICT DO NOTHING",
        [
          id,
          session.owner_id,
          session.request_id,
          messageId,
          content,
          contentHash,
          now(),
          now(),
        ],
      );
      if (!inserted.changes) return;
      await tx.run(
        "INSERT INTO memory_evidence_links(memory_id,kind,reference_id,document_id,page,source_id,version_hash,quote) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          c.kind,
          c.referenceId,
          c.documentId || null,
          c.page || null,
          c.sourceId || null,
          c.versionHash,
          content,
        ],
      );
    });
  }
}
async function list(owner, query = "", status) {
  check(
    !status || ["candidate", "verified", "rejected", "stale"].includes(status),
    "Invalid memory status",
  );
  const params = [owner],
    clauses = ["m.owner_id=$1"];
  let from = "agent_memories m";
  if (query) {
    const q = match(query);
    if (!q) return [];
    clauses.push(`m.search_vector @@ research_query($${params.length+1})`);
    params.push(q);
  }
  if (status) {
    clauses.push(`m.status=$${params.length+1}`);
    params.push(status);
  }
  const rows = await db.all(
    `SELECT m.* FROM ${from} WHERE ${clauses.join(" AND ")} ORDER BY ${query ? `ts_rank_cd(m.search_vector,research_query($2)) DESC,` : ""} m.updated_at DESC LIMIT 60`,
    params,
  );
  const result = [];
  for (const m of rows) result.push(await validate(m, owner));
  return result.filter((m) => !status || m.status === status);
}
async function approve(id, owner, crossResearch) {
  const result = await db.transaction(async tx => {
    const m = await tx.get('SELECT * FROM agent_memories WHERE id=$1 AND owner_id=$2', [id, owner]);
    check(m, 'Memory not found', 404);
    check(['candidate', 'verified'].includes(m.status), 'Only current candidates can be approved', 409);
    const valid = await validate(m, owner, tx);
    // Commit invalidation, then return a conflict; never resurrect a concurrent stale source.
    if (!valid.valid) return { stale: true };
    await tx.run("UPDATE agent_memories SET status='verified',kind=$1,verification_json=$2,updated_at=$3 WHERE id=$4 AND owner_id=$5", [
      crossResearch ? 'cross_research' : 'research',
      JSON.stringify({ approvedBy: owner, approvedAt: now(), sourceValidatedAt: now(), method: 'human-reviewed-extractive-quote' }),
      now(), id, owner]);
    return { status: 'verified' };
  });
  check(!result.stale, 'Memory source is stale', 409);
  return result;
}

async function maintain(owner) {
  check(typeof owner === 'string' && owner.length > 0, 'Memory owner required');
  // Bounded, database-only transaction: a transient failure must roll back all invalidations.
  return db.transaction(async tx => {
    const rows = await tx.all(
      "SELECT * FROM agent_memories WHERE owner_id=$1 AND status IN ('candidate','verified') ORDER BY last_checked_at ASC NULLS FIRST LIMIT 200",
      [owner],
    );
    let stale = 0;
    for (const m of rows) {
      if (!(await validate(m, owner, tx)).valid) stale++;
      await tx.run('UPDATE agent_memories SET last_checked_at=$1 WHERE id=$2 AND owner_id=$3', [now(),m.id,owner]);
    }
    return { checked: rows.length, stale };
  });
}

module.exports = {
  resolve,
  validate,
  getValid,
  candidates,
  list,
  approve,
  maintain,
};
