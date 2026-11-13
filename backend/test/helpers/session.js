const nativeFetch = global.fetch;
const crypto = require("node:crypto");
// Explicit fixture provisioning for service-level tests which seed legacy-shaped rows.
async function fixtureHeaders() {
  const db = require("../../src/config/database"),
    now = new Date().toISOString();
  await db.run(
    "INSERT INTO users(id,email,name,password_hash,created_at,updated_at) VALUES('fixture-user','fixture@example.test','Fixture','unused',$1,$2) ON CONFLICT DO NOTHING",
    [now, now],
  );
  const token = "a".repeat(64),
    hash = crypto.createHash("sha256").update(token).digest("hex");
  await db.run(
    "INSERT INTO user_sessions(id,user_id,token_hash,created_at,expires_at) VALUES('fixture-session','fixture-user',$1,$2,$3) ON CONFLICT DO NOTHING",
    [hash, now, new Date(Date.now() + 3600000).toISOString()],
  );
  await db.run(
    "UPDATE requests SET owner_id='fixture-user' WHERE owner_id='workspace'",
  );
  return {
    Cookie: `research_session=${token}`,
    Origin: "http://localhost:5173",
  };
}
async function fixtureFetch(url, options = {}) {
  return nativeFetch(url, {
    ...options,
    headers: { ...(await fixtureHeaders()), ...options.headers },
  });
}
module.exports = { fixtureHeaders, fixtureFetch };
