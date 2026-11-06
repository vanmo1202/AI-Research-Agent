const { timingSafeEqual } = require("node:crypto");
const db = require("../config/database");
function internalAuth(req, res, next) {
  const expected = process.env.INTERNAL_API_KEY || "",
    actual = req.get("X-Internal-Api-Key") || "";
  if (
    !expected ||
    Buffer.byteLength(expected) !== Buffer.byteLength(actual) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  )
    return res.status(401).json({ success: false, error: "Unauthorized" });
  next();
}
async function activeUser(id) {
  return (
    id &&
    db.get(
      "SELECT id,name,email,role FROM users WHERE id=? AND status='active'",
      [id],
    )
  );
}
async function internalResearchOwner(req, res, next) {
  try {
    const parts = req.path.split("/").filter(Boolean);
    let row;
    if (parts[0] === "runs")
      row = await db.get(
        "SELECT q.owner_id FROM requests q JOIN research_runs r ON r.request_id=q.id WHERE r.id=?",
        [parts[1]],
      );
    else if (parts[0] === "reports")
      row = await db.get(
        "SELECT q.owner_id FROM requests q JOIN research_runs r ON r.request_id=q.id JOIN report_versions v ON v.run_id=r.id WHERE v.id=?",
        [parts[1]],
      );
    else if (parts[0])
      row = await db.get("SELECT owner_id FROM requests WHERE id=?", [
        parts[0],
      ]);
    const user = await activeUser(
      row?.owner_id ||
        (!parts.length ? process.env.INTERNAL_RESEARCH_USER_ID : null),
    );
    if (!user)
      return res.status(parts.length ? 404 : 503).json({
        success: false,
        error: "Active internal research owner required",
      });
    req.owner = user.id;
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}
module.exports = { internalAuth, activeUser, internalResearchOwner };
