-- Preserve Unicode61-style component searches for host/email/compound tokens.
-- Do not edit applied migrations 001/002. This rebuild changes only derived vectors.
CREATE OR REPLACE FUNCTION research_normalize(value TEXT) RETURNS TEXT
LANGUAGE SQL STABLE AS $$
 SELECT regexp_replace(
   translate(public.unaccent('public.unaccent', normalize(coalesce(value,''), NFC)), 'Đđ', 'Dd'),
   '[[:punct:]]+', ' ', 'g'
 )
$$;
UPDATE document_chunks SET search_vector=to_tsvector('simple',research_normalize(content));
UPDATE agent_memories SET search_vector=to_tsvector('simple',research_normalize(content));
