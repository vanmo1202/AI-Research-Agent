const db = require("../config/database");
const missing = () =>
  Object.assign(new Error("Resource not found"), { status: 404 });
async function requestOwner(id, owner) {
  if (
    !(await db.get("SELECT 1 FROM requests WHERE id=$1 AND owner_id=$2", [
      id,
      owner,
    ]))
  )
    throw missing();
}
// Resolve every research URL before any controller reads, mutates or exports children.
async function researchAccess(req, res, next) {
  try {
    const parts = req.path.split("/").filter(Boolean);
    if (!parts.length) return next();
    if (parts[0] === "runs") {
      const run = await db.get(
        "SELECT request_id FROM research_runs WHERE id=$1",
        [parts[1]],
      );
      if (!run) throw missing();
      await requestOwner(run.request_id, req.owner);
    } else if (parts[0] === "reports") {
      const report = await db.get(
        "SELECT r.request_id FROM report_versions v JOIN research_runs r ON r.id=v.run_id WHERE v.id=$1",
        [parts[1]],
      );
      if (!report) throw missing();
      await requestOwner(report.request_id, req.owner);
    } else {
      await requestOwner(parts[0], req.owner);
      if (parts[1] === "runs" && parts[2]) {
        if (
          !(await db.get(
            "SELECT 1 FROM research_runs WHERE id=$1 AND request_id=$2",
            [parts[2], parts[0]],
          ))
        )
          throw missing();
      }
    }
    next();
  } catch (e) {
    next(e);
  }
}
module.exports = { researchAccess, requestOwner };
