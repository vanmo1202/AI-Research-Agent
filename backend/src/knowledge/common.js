const { createHash, timingSafeEqual } = require("node:crypto");
const db = require("../config/database");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const now = () => new Date().toISOString();
const fail = (message, status = 400, code) =>
  Object.assign(new Error(message), { status, code, safeKnowledge: true });
const check = (condition, message, status = 400) => {
  if (!condition) throw fail(message, status);
};
function guard(req, res, next) {
  const key = process.env.KNOWLEDGE_WORKSPACE_KEY;
  if (!key || key.length < 24)
    return next(
      fail(
        "Knowledge workspace disabled: configure a key of at least 24 characters",
        503,
      ),
    );
  const actual = req.get("X-Workspace-Key") || "";
  if (
    Buffer.byteLength(actual) !== Buffer.byteLength(key) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(key))
  )
    return next(fail("Workspace access denied", 401));
  // Single trusted workspace, never derived from client-supplied ownerId.
  req.owner = "workspace";
  if (req.body === undefined) req.body = {};
  if (
    req.body === null ||
    Array.isArray(req.body) ||
    typeof req.body !== "object"
  )
    return next(fail("Invalid request body"));
  next();
}
async function research(id) {
  check(typeof id === "string" && id.length <= 100, "Invalid research ID");
  const row = await db.get("SELECT * FROM requests WHERE id=?", [id]);
  check(row, "Research request not found", 404);
  return row;
}
async function document(id, owner, ready = false) {
  const row = await db.get(
    "SELECT * FROM documents WHERE id=? AND owner_id=? AND deleted_at IS NULL",
    [id, owner],
  );
  check(row, "Document not found", 404);
  if (ready) check(row.status === "ready", "Document not ready", 409);
  return row;
}
const text = (value, max = 2000) => {
  check(
    typeof value === "string" && value.trim().length > 0 && value.length <= max,
    "Invalid text",
  );
  return value.trim();
};
function ids(value, max = 12) {
  check(
    Array.isArray(value) &&
      value.length <= max &&
      value.every((id) => typeof id === "string" && id.length <= 100),
    "Invalid reference IDs",
  );
  return [...new Set(value)];
}
function match(query) {
  const words =
    String(query)
      .normalize("NFKC")
      .match(/[\p{L}\p{N}]{2,}/gu) || [];
  return [...new Set(words)]
    .slice(0, 24)
    .map((w) => `"${w}"`)
    .join(" OR ");
}
const normalize = (value) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
module.exports = {
  db,
  hash,
  now,
  fail,
  check,
  guard,
  research,
  document,
  text,
  ids,
  match,
  normalize,
};
