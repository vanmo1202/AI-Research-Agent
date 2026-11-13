const { timingSafeEqual } = require("node:crypto");
const db = require("../config/database");
function internalAuth(req, res, next) {
  const expected = process.env.INTERNAL_API_KEY || "",
    actual = req.get("X-Internal-Api-Key") || "";
  if (
    !expected ||
    Buffer.byteLength(expected) !== Buffer.byteLength(actual) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  ) return res.status(401).json({ success: false, error: "Unauthorized" });
  next();
}
async function activeUser(id) {
  return id && db.get("SELECT id,name,email,role FROM users WHERE id=$1 AND status='active'", [id]);
}
async function internalResearchOwner(req, res, next) {
  try {
    // The secret authenticates the service, not the owner of whichever URL it supplies.
    const user = await activeUser(process.env.INTERNAL_RESEARCH_USER_ID);
    if (!user) return res.status(503).json({ success:false, error:"Active internal research owner required" });
    req.owner = user.id;
    req.user = user;
    next();
  } catch (error) { next(error); }
}
async function internalRunAccess(req, res, next) {
  try {
    const runId = req.params.runId || req.query.runId;
    const owned = typeof runId === 'string' && runId.length <= 100 && await db.get(
      'SELECT r.id FROM research_runs r JOIN requests q ON q.id=r.request_id WHERE r.id=$1 AND q.owner_id=$2',
      [runId,req.owner],
    );
    if (!owned) return res.status(404).json({success:false,error:'Run not found'});
    next();
  } catch (error) { next(error); }
}
module.exports = { internalAuth, activeUser, internalResearchOwner, internalRunAccess };
