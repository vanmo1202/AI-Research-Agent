// Additive: legacy tables and contracts remain intact.
module.exports = async ({ transaction }) =>
  transaction(async (tx) => {
    if (
      await tx.get("SELECT version FROM schema_migrations WHERE version=?", [
        "003-knowledge",
      ])
    )
      return;
    const statements = [
      `CREATE TABLE documents (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, filename TEXT NOT NULL,
      storage_name TEXT NOT NULL, sha256 TEXT NOT NULL, byte_size INTEGER NOT NULL CHECK(byte_size>0),
      page_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL CHECK(status IN ('pending','processing','ready','failed')),
      error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT)`,
      `CREATE UNIQUE INDEX documents_hash ON documents(owner_id,sha256) WHERE deleted_at IS NULL`,
      `CREATE INDEX documents_owner ON documents(owner_id,created_at)`,
      `CREATE TABLE document_pages (document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      page INTEGER NOT NULL CHECK(page>0), content TEXT NOT NULL, PRIMARY KEY(document_id,page))`,
      `CREATE TABLE document_chunks (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, page INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL, content TEXT NOT NULL, content_hash TEXT NOT NULL,
      FOREIGN KEY(document_id,page) REFERENCES document_pages(document_id,page) ON DELETE CASCADE,
      UNIQUE(document_id,page,chunk_index))`,
      `CREATE VIRTUAL TABLE document_chunks_fts USING fts5(content, content='document_chunks', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2')`,
      `CREATE TRIGGER document_chunks_ai AFTER INSERT ON document_chunks BEGIN INSERT INTO document_chunks_fts(rowid,content) VALUES(new.rowid,new.content); END`,
      `CREATE TRIGGER document_chunks_ad AFTER DELETE ON document_chunks BEGIN INSERT INTO document_chunks_fts(document_chunks_fts,rowid,content) VALUES('delete',old.rowid,old.content); END`,
      `CREATE TRIGGER document_chunks_au AFTER UPDATE ON document_chunks BEGIN INSERT INTO document_chunks_fts(document_chunks_fts,rowid,content) VALUES('delete',old.rowid,old.content); INSERT INTO document_chunks_fts(rowid,content) VALUES(new.rowid,new.content); END`,
      `CREATE TABLE research_documents (request_id TEXT NOT NULL REFERENCES requests(id), document_id TEXT NOT NULL REFERENCES documents(id), owner_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(request_id,document_id))`,
      `CREATE TABLE document_ingestion_jobs (id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id), status TEXT NOT NULL CHECK(status IN ('pending','processing','ready','failed')), attempts INTEGER NOT NULL DEFAULT 0, generation INTEGER NOT NULL DEFAULT 0, lease_until INTEGER, error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
      `CREATE UNIQUE INDEX ingestion_single_worker ON document_ingestion_jobs((1)) WHERE status='processing'`,
      `CREATE UNIQUE INDEX ingestion_one_per_document ON document_ingestion_jobs(document_id) WHERE status IN ('pending','processing')`,
      `CREATE INDEX ingestion_queue ON document_ingestion_jobs(status,created_at)`,
      `CREATE TABLE chat_sessions (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, request_id TEXT NOT NULL REFERENCES requests(id), title TEXT NOT NULL, scope TEXT NOT NULL CHECK(scope IN ('documents','research','combined')), document_ids_json TEXT NOT NULL, memory_ids_json TEXT NOT NULL DEFAULT '[]', busy_until INTEGER NOT NULL DEFAULT 0, active_token TEXT, created_at TEXT NOT NULL)`,
      `CREATE INDEX chats_owner_request ON chat_sessions(owner_id,request_id,created_at)`,
      `CREATE TABLE chat_messages (id TEXT PRIMARY KEY, chat_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('user','assistant')), content TEXT NOT NULL, citations_json TEXT NOT NULL DEFAULT '[]', turn_id TEXT, status TEXT NOT NULL CHECK(status IN ('pending','complete','failed')), created_at TEXT NOT NULL, UNIQUE(chat_id,turn_id,role))`,
      `CREATE INDEX messages_chat ON chat_messages(chat_id,created_at)`,
      `CREATE TABLE agent_memories (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, request_id TEXT NOT NULL REFERENCES requests(id), message_id TEXT REFERENCES chat_messages(id) ON DELETE SET NULL, kind TEXT NOT NULL CHECK(kind IN ('research','cross_research')), content TEXT NOT NULL, content_hash TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('candidate','verified','rejected','stale')), verification_json TEXT NOT NULL DEFAULT '{}', last_checked_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(owner_id,request_id,content_hash))`,
      `CREATE INDEX memories_owner_status ON agent_memories(owner_id,status,updated_at)`,
      `CREATE TABLE memory_evidence_links (id INTEGER PRIMARY KEY, memory_id TEXT NOT NULL REFERENCES agent_memories(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK(kind IN ('document','evidence','source')), reference_id TEXT NOT NULL, document_id TEXT, page INTEGER, source_id TEXT, version_hash TEXT NOT NULL, quote TEXT NOT NULL)`,
      `CREATE INDEX memory_links_reference ON memory_evidence_links(kind,reference_id)`,
      `CREATE VIRTUAL TABLE agent_memories_fts USING fts5(content, content='agent_memories', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2')`,
      `CREATE TRIGGER memories_ai AFTER INSERT ON agent_memories BEGIN INSERT INTO agent_memories_fts(rowid,content) VALUES(new.rowid,new.content); END`,
      `CREATE TRIGGER memories_ad AFTER DELETE ON agent_memories BEGIN INSERT INTO agent_memories_fts(agent_memories_fts,rowid,content) VALUES('delete',old.rowid,old.content); END`,
      `CREATE TRIGGER memories_au AFTER UPDATE OF content ON agent_memories BEGIN INSERT INTO agent_memories_fts(agent_memories_fts,rowid,content) VALUES('delete',old.rowid,old.content); INSERT INTO agent_memories_fts(rowid,content) VALUES(new.rowid,new.content); END`,
      `CREATE TRIGGER knowledge_document_stale AFTER UPDATE OF deleted_at ON documents WHEN new.deleted_at IS NOT NULL BEGIN UPDATE agent_memories SET status='stale',updated_at=CURRENT_TIMESTAMP WHERE id IN (SELECT memory_id FROM memory_evidence_links WHERE document_id=new.id); END`,
      `CREATE TRIGGER knowledge_chunk_stale AFTER DELETE ON document_chunks BEGIN UPDATE agent_memories SET status='stale',updated_at=CURRENT_TIMESTAMP WHERE id IN (SELECT memory_id FROM memory_evidence_links WHERE kind='document' AND reference_id=old.id); END`,
      ...["DELETE", "UPDATE"].map(
        (op) =>
          `CREATE TRIGGER knowledge_evidence_${op.toLowerCase()} AFTER ${op} ON evidence BEGIN UPDATE agent_memories SET status='stale',updated_at=CURRENT_TIMESTAMP WHERE id IN (SELECT memory_id FROM memory_evidence_links WHERE kind='evidence' AND reference_id=old.id); END`,
      ),
      ...["DELETE", "UPDATE"].map(
        (op) =>
          `CREATE TRIGGER knowledge_source_${op.toLowerCase()} AFTER ${op} ON sources BEGIN UPDATE agent_memories SET status='stale',updated_at=CURRENT_TIMESTAMP WHERE id IN (SELECT memory_id FROM memory_evidence_links WHERE source_id=old.id); END`,
      ),
    ];
    for (const sql of statements) await tx.run(sql);
    await tx.run("INSERT INTO schema_migrations VALUES (?,?)", [
      "003-knowledge",
      new Date().toISOString(),
    ]);
  });
