const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
process.env.RESEARCH_DB_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "proxy-auth-")),
  "db",
);
process.env.TRUSTED_PROXY_CIDRS = "127.0.0.2/32";
process.env.AUTH_RATE_LIMIT = "2";
process.env.MOCK_LLM = "true";
process.env.MOCK_SEARCH = "true";
test("Rate limiter ignores spoofed forwarded headers and separates clients only behind an allowlisted proxy", async (t) => {
  const db = require("../src/config/database");
  await db.initializeDatabase();
  const app = require("../src/server").app,
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (ip) =>
    fetch(base + "/api/auth/login", {
      method: "POST",
      headers: {
        Origin: "http://localhost:5173",
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
      },
      body: JSON.stringify({ email: "no@example.test", password: "abc123" }),
    });
  assert.equal((await call("192.0.2.1")).status, 401);
  assert.equal((await call("192.0.2.2")).status, 401);
  assert.equal((await call("192.0.2.3")).status, 429);
  // Simulate a deployment explicitly trusting its local test proxy, not arbitrary addresses.
  app.set("trust proxy", ["127.0.0.1/32"]);
  assert.equal((await call("198.51.100.1")).status, 401);
  assert.equal((await call("198.51.100.2")).status, 401);
  assert.equal((await call("198.51.100.1")).status, 401);
  assert.equal((await call("198.51.100.1")).status, 429);
  const nginx = fs.readFileSync(
    path.join(__dirname, "../../frontend/nginx.conf"),
    "utf8",
  );
  assert.match(nginx, /proxy_set_header X-Forwarded-For \$remote_addr;/);
  assert.doesNotMatch(nginx, /proxy_add_x_forwarded_for/);
});
