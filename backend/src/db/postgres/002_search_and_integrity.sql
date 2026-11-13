-- simple lexemes retain Vietnamese syllables; unaccent normalizes both index/query.
CREATE FUNCTION research_normalize(value TEXT) RETURNS TEXT LANGUAGE SQL STABLE AS $$
 SELECT translate(public.unaccent('public.unaccent', coalesce(value,'')), 'Đđ', 'Dd')
$$;
CREATE FUNCTION research_query(value TEXT) RETURNS tsquery LANGUAGE SQL STABLE AS $$
 SELECT coalesce(string_agg(quote_literal(term),' | ')::tsquery,''::tsquery)
 FROM unnest(tsvector_to_array(to_tsvector('simple',research_normalize(value)))) term
$$;
CREATE FUNCTION research_search_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.search_vector := to_tsvector('simple',research_normalize(NEW.content)); RETURN NEW; END $$;
ALTER TABLE document_chunks ADD COLUMN search_vector tsvector;
ALTER TABLE agent_memories ADD COLUMN search_vector tsvector;
CREATE TRIGGER document_chunks_search BEFORE INSERT OR UPDATE OF content ON document_chunks FOR EACH ROW EXECUTE FUNCTION research_search_update();
CREATE TRIGGER agent_memories_search BEFORE INSERT OR UPDATE OF content ON agent_memories FOR EACH ROW EXECUTE FUNCTION research_search_update();
CREATE INDEX document_chunks_search_gin ON document_chunks USING GIN(search_vector);
CREATE INDEX agent_memories_search_gin ON agent_memories USING GIN(search_vector);

CREATE FUNCTION knowledge_document_stale() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.deleted_at IS NOT NULL THEN
 UPDATE agent_memories SET status='stale',updated_at=CURRENT_TIMESTAMP WHERE id IN (SELECT memory_id FROM memory_evidence_links WHERE document_id=NEW.id);
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER knowledge_document_stale AFTER UPDATE OF deleted_at ON documents FOR EACH ROW EXECUTE FUNCTION knowledge_document_stale();
CREATE FUNCTION knowledge_reference_stale() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='document_chunks' THEN
 UPDATE agent_memories SET status='stale',updated_at=CURRENT_TIMESTAMP WHERE id IN (SELECT memory_id FROM memory_evidence_links WHERE kind='document' AND reference_id=OLD.id);
 ELSIF TG_TABLE_NAME='evidence' THEN
 UPDATE agent_memories SET status='stale',updated_at=CURRENT_TIMESTAMP WHERE id IN (SELECT memory_id FROM memory_evidence_links WHERE kind='evidence' AND reference_id=OLD.id);
 ELSE
 UPDATE agent_memories SET status='stale',updated_at=CURRENT_TIMESTAMP WHERE id IN (SELECT memory_id FROM memory_evidence_links WHERE source_id=OLD.id);
 END IF; RETURN NULL;
END $$;
CREATE TRIGGER knowledge_chunk_stale AFTER DELETE ON document_chunks FOR EACH ROW EXECUTE FUNCTION knowledge_reference_stale();
CREATE TRIGGER knowledge_evidence_update AFTER UPDATE ON evidence FOR EACH ROW EXECUTE FUNCTION knowledge_reference_stale();
CREATE TRIGGER knowledge_evidence_delete AFTER DELETE ON evidence FOR EACH ROW EXECUTE FUNCTION knowledge_reference_stale();
CREATE TRIGGER knowledge_source_update AFTER UPDATE ON sources FOR EACH ROW EXECUTE FUNCTION knowledge_reference_stale();
CREATE TRIGGER knowledge_source_delete AFTER DELETE ON sources FOR EACH ROW EXECUTE FUNCTION knowledge_reference_stale();

CREATE TABLE sqlite_imports (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), source_hash TEXT NOT NULL UNIQUE,
 manifest JSONB NOT NULL, verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
