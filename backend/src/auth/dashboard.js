const db = require("../config/database");
module.exports = async (req, res) => {
  const summary = await db.get(
    `SELECT
  (SELECT COUNT(*) FROM requests WHERE owner_id=?) researchCount,
  (SELECT COUNT(*) FROM requests WHERE owner_id=? AND status='completed') completedCount,
  (SELECT COUNT(*) FROM documents WHERE owner_id=? AND deleted_at IS NULL) documentCount,
  (SELECT COUNT(*) FROM agent_memories WHERE owner_id=? AND status='verified') verifiedMemoryCount`,
    Array(4).fill(req.owner),
  );
  const recentResearch = await db.all(
    `SELECT r.id requestId,r.topic,r.status,r.created_at createdAt,
  (SELECT COUNT(DISTINCT question_id) FROM plans WHERE request_id=r.id) questionCount,
  (SELECT COUNT(*) FROM sources WHERE request_id=r.id) sourceCount
  FROM requests r WHERE r.owner_id=? ORDER BY r.created_at DESC,r.rowid DESC LIMIT 6`,
    [req.owner],
  );
  res.json({ success: true, data: { ...summary, recentResearch } });
};
