const { test } = require("node:test");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
process.env.RESEARCH_DB_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "password-policy-")),
  "db",
);
process.env.MOCK_LLM = "true";
process.env.MOCK_SEARCH = "true";
process.env.AUTH_RATE_LIMIT = "200";
const db = require("../src/config/database");
test("Password boundary policy, old login compatibility, secure cookies and concurrent password changes", async (t) => {
  await db.initializeDatabase();
  const app = require("../src/server").app,
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(route, body, cookie = "") {
    const response = await fetch(base + "/api/auth/" + route, {
      method: body ? "POST" : "GET",
      headers: {
        Origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
      headers: response.headers,
    };
  }
  for (const length of [5, 6, 12, 128, 129]) {
    const password = length === 6 ? "abc123" : "a".repeat(length),
      email = `length-${length}@example.test`;
    const registered = await call("register", {
      email,
      name: "Boundary",
      password,
    });
    if (length === 5 || length === 129) {
      assert.equal(registered.status, 400);
      assert.match(registered.data.error, /6 đến 128/);
      continue;
    }
    assert.equal(registered.status, 201);
    assert.match(registered.headers.get("cache-control"), /no-store/);
    const user = await db.get("SELECT password_hash FROM users WHERE email=$1", [
      email,
    ]);
    assert.notEqual(user.password_hash, password);
    assert.match(user.password_hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
    let login = await call("login", { email, password });
    assert.equal(login.status, 200);
    assert.equal((await call("me", null, login.cookie)).status, 200);
    assert.equal(
      (
        await call(
          "change-password",
          { currentPassword: password, password: "12345" },
          login.cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          "change-password",
          { currentPassword: password, password: "x".repeat(129) },
          login.cookie,
        )
      ).status,
      400,
    );
    const changed = await call(
      "change-password",
      { currentPassword: password, password: "b".repeat(length) },
      login.cookie,
    );
    assert.equal(changed.status, 200);
    assert.equal((await call("me", null, login.cookie)).status, 401);
    assert.equal((await call("me", null, changed.cookie)).status, 200);
    assert.equal((await call("login", { email, password })).status, 401);
    login = await call("login", { email, password: "b".repeat(length) });
    assert.equal(login.status, 200);
    assert.equal((await call("logout", {}, login.cookie)).status, 200);
    assert.equal((await call("me", null, login.cookie)).status, 401);
  }
  // Existing shorter passwords can still authenticate; no minimum is imposed on login.
  const { hashPassword } = require("../src/auth"),
    now = new Date().toISOString();
  await db.run(
    "INSERT INTO users(id,email,name,password_hash,created_at,updated_at) VALUES('old','old@example.test','Old',$1,$2,$3)",
    [await hashPassword("12345"), now, now],
  );
  assert.equal(
    (await call("login", { email: "old@example.test", password: "12345" }))
      .status,
    200,
  );
  const a = await call("register", {
    email: "race@example.test",
    name: "Race",
    password: "abc123",
  });
  const results = await Promise.all(
    ["new123", "other6"].map((password) =>
      call(
        "change-password",
        { currentPassword: "abc123", password },
        a.cookie,
      ),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
  const active = await db.get(
    "SELECT COUNT(*) n FROM user_sessions WHERE user_id=$1 AND revoked_at IS NULL",
    [a.data.data.id],
  );
  assert.equal(active.n, 1);

  // Hold a login's password snapshot while another request changes the password.
  const racing = await call("register", {
    email: "late-login@example.test",
    name: "Late login",
    password: "abc123",
  });
  const originalGet = db.get;
  let release, announce;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const reached = new Promise((resolve) => {
    announce = resolve;
  });
  db.get = async (sql, params) => {
    const row = await originalGet(sql, params);
    if (
      sql === "SELECT * FROM users WHERE lower(email)=lower($1)" &&
      params[0] === "late-login@example.test"
    ) {
      announce();
      await held;
    }
    return row;
  };
  try {
    const late = call("login", {
      email: "late-login@example.test",
      password: "abc123",
    });
    await reached;
    assert.equal(
      (
        await call(
          "change-password",
          { currentPassword: "abc123", password: "def456" },
          racing.cookie,
        )
      ).status,
      200,
    );
    release();
    assert.equal((await late).status, 401);
  } finally {
    release();
    db.get = originalGet;
  }
  assert.equal(
    (
      await db.get(
        "SELECT COUNT(*) n FROM user_sessions WHERE user_id=$1 AND revoked_at IS NULL",
        [racing.data.data.id],
      )
    ).n,
    1,
  );
  // Session storage failure cannot leave a half-created account behind.
  const originalTransaction = db.transaction;
  db.transaction = (work) =>
    originalTransaction((tx) =>
      work({
        ...tx,
        run: (sql, params) => {
          if (sql.startsWith("INSERT INTO user_sessions"))
            throw Error("injected session insert failure");
          return tx.run(sql, params);
        },
      }),
    );
  try {
    const failed = await call("register", {
      email: "rollback@example.test",
      name: "Rollback",
      password: "abc123",
    });
    assert.equal(failed.status, 500);
    assert.equal(failed.cookie, undefined);
    assert.equal(
      await db.get("SELECT id FROM users WHERE email='rollback@example.test'"),
      undefined,
    );
  } finally {
    db.transaction = originalTransaction;
  }
  process.env.COOKIE_SECURE = "true";
  const secure = await call("login", {
    email: "old@example.test",
    password: "12345",
  });
  assert.match(secure.headers.get("set-cookie"), /; Secure/i);

  process.env.NODE_ENV = "production";
  process.env.COOKIE_SECURE = "false";
  const httpDocker = await call("login", {
    email: "old@example.test",
    password: "12345",
  });
  assert.doesNotMatch(httpDocker.headers.get("set-cookie"), /; Secure/i);
  process.env.FRONTEND_ORIGIN = "https://research.example.test";
  const https = await call("login", {
    email: "old@example.test",
    password: "12345",
  });
  assert.match(https.headers.get("set-cookie"), /; Secure/i);
  delete process.env.NODE_ENV;
  delete process.env.FRONTEND_ORIGIN;
  delete process.env.COOKIE_SECURE;
});
