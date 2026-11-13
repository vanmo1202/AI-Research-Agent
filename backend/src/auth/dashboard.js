const db = require('../config/database');
module.exports = async (req, res) => {
  // The newest run is authoritative; requests without runs retain legacy results.
  const data = await db.transaction(async tx => {
    const summary = await tx.get(`SELECT
      (SELECT count(*) FROM requests WHERE owner_id=$1) AS "researchCount",
      (SELECT count(*) FROM requests r WHERE owner_id=$1 AND
        coalesce((SELECT status FROM research_runs WHERE request_id=r.id ORDER BY legacy_position DESC LIMIT 1),r.status)='completed') AS "completedCount",
      (SELECT count(*) FROM documents WHERE owner_id=$1 AND deleted_at IS NULL) AS "documentCount",
      (SELECT count(*) FROM agent_memories WHERE owner_id=$1 AND status='verified') AS "verifiedMemoryCount"`, [req.owner]);
    const recentResearch = await tx.all(`SELECT r.id AS "requestId",r.topic,
      coalesce(latest.status,r.status) AS status,r.created_at AS "createdAt",
      CASE WHEN latest.id IS NULL THEN (SELECT count(DISTINCT question_id) FROM plans WHERE request_id=r.id)
        ELSE coalesce((SELECT jsonb_array_length(output_json->'plan'->'researchQuestions') FROM stage_jobs
          WHERE run_id=latest.id AND stage='planning' AND status='succeeded' ORDER BY legacy_position DESC LIMIT 1),0) END AS "questionCount",
      CASE WHEN latest.id IS NULL THEN (SELECT count(*) FROM sources WHERE request_id=r.id)
        ELSE (SELECT count(*) FROM source_versions WHERE run_id=latest.id) END AS "sourceCount"
      FROM requests r LEFT JOIN LATERAL
        (SELECT id,status FROM research_runs WHERE request_id=r.id ORDER BY legacy_position DESC LIMIT 1) latest ON true
      WHERE r.owner_id=$1 ORDER BY r.created_at DESC,r.legacy_position DESC LIMIT 6`, [req.owner]);
    return {...summary,recentResearch};
  }, {readOnly:true});
  res.json({success:true,data});
};
