const db = require('../config/database');
const timezone = 'Asia/Ho_Chi_Minh';
module.exports = async (req, res, next) => {
  if (!req.owner) return res.status(401).json({ success: false, error: 'Authentication required' });
  const range = req.query.range || '30';
  if (!['7', '30', '90', 'all'].includes(range)) return res.status(400).json({ success: false, error: 'Invalid analytics range' });
  try {
    const data = await db.transaction(async (tx) => {
      const bounds = await tx.get(`SELECT CASE WHEN $1::int IS NULL THEN NULL ELSE (date_trunc('day', now() AT TIME ZONE $2) - ($1::int - 1) * interval '1 day') AT TIME ZONE $2 END AS start`, [range === 'all' ? null : Number(range), timezone]);
      const params = [req.owner, bounds.start];
      const requests = `SELECT * FROM requests WHERE owner_id=$1 AND ($2::timestamptz IS NULL OR created_at >= $2)`;
      const summary = await tx.get(`SELECT (SELECT count(*) FROM (${requests}) r) AS research,
        (SELECT count(DISTINCT rr.request_id) FROM research_runs rr JOIN requests r ON r.id=rr.request_id WHERE r.owner_id=$1 AND rr.status='completed' AND ($2::timestamptz IS NULL OR rr.completed_at >= $2)) AS completed,
        (SELECT count(*) FROM documents WHERE owner_id=$1 AND deleted_at IS NULL AND ($2::timestamptz IS NULL OR created_at >= $2)) AS documents`, params);
      const timeline = await tx.all(`SELECT to_char(created_at AT TIME ZONE '${timezone}', 'YYYY-MM-DD') AS label, count(*) AS value FROM (${requests}) r GROUP BY 1 ORDER BY 1`, params);
      const statuses = await tx.all(`SELECT coalesce((SELECT status FROM research_runs WHERE request_id=r.id ORDER BY created_at DESC,id DESC LIMIT 1),'no_run') AS label,count(*) AS value FROM (${requests}) r GROUP BY 1`, params);
      const volume = await tx.all(`SELECT r.id,r.topic AS label,
        (SELECT count(*) FROM source_versions s JOIN research_runs rr ON rr.id=s.run_id WHERE rr.request_id=r.id) AS sources,
        coalesce((SELECT sum(jsonb_array_length(a.evidence_json)) FROM research_runs rr JOIN LATERAL (SELECT evidence_json FROM analysis_versions WHERE run_id=rr.id ORDER BY created_at DESC,id DESC LIMIT 1) a ON true WHERE rr.request_id=r.id),0) AS evidence
        FROM (${requests}) r ORDER BY r.created_at DESC,r.id LIMIT 12`, params);
      const pdf = await tx.all(`SELECT status AS label,count(*) AS value FROM documents WHERE owner_id=$1 AND deleted_at IS NULL AND ($2::timestamptz IS NULL OR created_at >= $2) GROUP BY status`, params);
      const citations = await tx.all(`SELECT c.item->>'status' AS label,count(*) AS value FROM (${requests}) r JOIN research_runs rr ON rr.request_id=r.id JOIN LATERAL (SELECT citation_validation_json FROM report_versions WHERE run_id=rr.id ORDER BY created_at DESC,id DESC LIMIT 1) report ON true CROSS JOIN LATERAL jsonb_array_elements(coalesce(report.citation_validation_json->'citations','[]'::jsonb)) c(item) WHERE c.item->>'status' IN ('verified','unsupported','unverified','inaccessible') GROUP BY 1`, params);
      const validSources = await tx.get(`SELECT count(DISTINCT c.item->>'sourceVersionId') AS value FROM (${requests}) r JOIN research_runs rr ON rr.request_id=r.id JOIN LATERAL (SELECT citation_validation_json FROM report_versions WHERE run_id=rr.id ORDER BY created_at DESC,id DESC LIMIT 1) report ON true CROSS JOIN LATERAL jsonb_array_elements(coalesce(report.citation_validation_json->'citations','[]'::jsonb)) c(item) JOIN source_versions s ON s.id=c.item->>'sourceVersionId' AND s.run_id=rr.id WHERE c.item->>'status'='verified' AND jsonb_array_length(coalesce(c.item->'evidenceIds','[]'::jsonb))>0 AND s.provider='tavily'`, params);
      return { summary: { ...summary, validSources: citations.length ? validSources.value : null }, timeline, statuses, volume, pdf, citations };
    }, { readOnly: true });
    res.json({ success: true, data: { ...data, timezone, range } });
  } catch (error) { next(error); }
};
