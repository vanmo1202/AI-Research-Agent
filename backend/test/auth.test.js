const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
process.env.RESEARCH_DB_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "auth-test-")),
  "db.sqlite",
);
process.env.MOCK_LLM = "true";
process.env.MOCK_SEARCH = "true";
process.env.INTERNAL_API_KEY = "internal-test";
const db = require("../src/config/database");
test("Auth sessions, CSRF, ownership, legacy preservation, revocation and throttling", async (t) => {
  await db.initializeDatabase();
  const app = require("../src/server").app,
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(
    url,
    {
      body,
      cookie = "",
      origin = "http://localhost:5173",
      method = body ? "POST" : "GET",
      headers = {},
    } = {},
  ) {
    const response = await fetch(base + url, {
      method,
      headers: {
        Origin: origin,
        Cookie: cookie,
        "Content-Type": "application/json",
        "Idempotency-Key": "auth-test",
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
      headers: response.headers,
    };
  }
  const credentials = {
    email: "A@example.test",
    name: "Alice",
    password: "long password for tests",
  };
  const a = await call("/api/auth/register", { body: credentials });
  assert.equal(a.status, 201);
  assert.match(a.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(a.headers.get("set-cookie"), /SameSite=Lax/i);
  assert.equal(
    (
      await call("/api/auth/register", {
        body: { ...credentials, email: "a@EXAMPLE.test" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/api/auth/login", {
        body: { email: credentials.email, password: "wrong" },
      })
    ).status,
    401,
  );
  const login = await call("/api/auth/login", { body: credentials });
  assert.equal(login.status, 200);
  assert.equal(
    (await call("/api/auth/me", { cookie: a.cookie })).body.data.name,
    "Alice",
  );
  const b = await call("/api/auth/register", {
    body: { ...credentials, email: "b@example.test", name: "Bob" },
  });
  const research = await call("/api/research", {
    cookie: a.cookie,
    body: { topic: "Owned topic", goal: "Owned goal", executionMode: "async" },
  });
  assert.equal(research.status, 201);
  const id = research.body.data.requestId;
  await db.run(
    "INSERT INTO requests(id,topic,goal) VALUES('legacy','old','old')",
  );
  assert.equal(
    (await call("/api/research/legacy", { cookie: a.cookie })).status,
    404,
  );
  assert.equal(
    (await db.get("SELECT owner_id FROM requests WHERE id='legacy'")).owner_id,
    "workspace",
  );
  const run = await call(`/api/research/${id}/runs`, {
    cookie: a.cookie,
    body: { searchMore: false },
  });
  assert.equal(run.status, 202);
  const runId = run.body.data.runId;
  const now = new Date().toISOString();
  await db.run(
    "INSERT INTO documents(id,owner_id,filename,storage_name,sha256,byte_size,status,created_at,updated_at) VALUES('private-pdf',$1,'p.pdf','p','hash',1,'ready',$2,$3)",
    [a.body.data.id, now, now],
  );
  const chat = await call(`/api/research/${id}/chats`, {
    cookie: a.cookie,
    body: { scope: "research" },
  });
  assert.equal(chat.status, 201);
  await db.run(
    "INSERT INTO agent_memories(id,owner_id,request_id,kind,content,content_hash,status,created_at,updated_at) VALUES('private-memory',$1,$2,'research','secret','hash','candidate',$3,$4)",
    [a.body.data.id, id, now, now],
  );
  const job = await db.get("SELECT id FROM stage_jobs WHERE run_id=$1", [runId]);
  await db.run(
    "INSERT INTO analysis_versions(id,run_id,job_id,source_snapshot_hash,evidence_json,gaps_json,coverage_status,created_at) VALUES('private-analysis',$1,$2,'snapshot','[]','[]','complete',$3)",
    [runId, job.id, now],
  );
  await db.run(
    "INSERT INTO report_versions(id,run_id,job_id,analysis_version_id,content,references_json,citation_validation_json,status,created_at) VALUES('private-report',$1,$2,'private-analysis','secret','[]','{}','complete',$3)",
    [runId, job.id, now],
  );
  for (const url of [
    `/api/research/${id}`,
    `/api/research/${id}/sources`,
    `/api/research/${id}/evidence`,
    `/api/research/${id}/report`,
    `/api/research/${id}/report/export/pdf`,
    `/api/research/${id}/report/export/docx`,
    `/api/research/runs/${runId}/sources`,
    `/api/research/${id}/runs/${runId}/progress`,
    "/api/research/reports/private-report/export/pdf",
    "/api/research/reports/private-report/export/docx",
    "/api/documents/private-pdf/file",
    `/api/chats/${chat.body.data.id}/messages`,
  ])
    assert.equal((await call(url, { cookie: b.cookie })).status, 404, url);
  for (const url of [
    `/api/research/${id}/search`,
    `/api/research/${id}/analyze`,
    `/api/research/${id}/report`,
    `/api/research/runs/${runId}/cancel`,
    "/api/memories/private-memory/approve",
  ])
    assert.equal(
      (await call(url, { cookie: b.cookie, body: {} })).status,
      404,
      url,
    );
  assert.equal(
    (await call("/api/research", { cookie: b.cookie })).body.data.length,
    0,
  );
  assert.equal(
    (await call("/api/memories", { cookie: b.cookie })).body.data.length,
    0,
  );
  assert.equal((await call("/api/research")).status, 401);
  assert.equal(
    (
      await call("/api/research", {
        headers: { "X-Internal-Api-Key": "internal-test" },
      })
    ).status,
    401,
  );
  assert.equal((await call(`/internal/research/${id}`)).status, 401);
  assert.equal(
    (
      await call(`/internal/research/${id}`, {
        headers: { "X-Internal-Api-Key": "internal-test" },
      })
    ).status,
    503,
  );
  assert.equal(
    (
      await call("/internal/research", {
        body: { topic: "Internal", goal: "Goal" },
        headers: { "X-Internal-Api-Key": "internal-test" },
      })
    ).status,
    503,
  );

  const chatUrl = `/internal/knowledge/chats/${chat.body.data.id}/messages`;
  const chatBody = {
    requestId: id,
    content: "Summarize sources",
    clientToken: "internal-chat-test",
  };
  assert.equal((await call(chatUrl, { body: chatBody })).status, 401);
  assert.equal(
    (
      await call(chatUrl, {
        body: chatBody,
        headers: { "X-Internal-Api-Key": "internal-test" },
      })
    ).status,
    503,
  );
  process.env.INTERNAL_RESEARCH_USER_ID = b.body.data.id;
  assert.equal(
    (
      await call(chatUrl, {
        body: { ...chatBody, ownerId: a.body.data.id },
        headers: { "X-Internal-Api-Key": "internal-test" },
      })
    ).status,
    404,
  );
  process.env.INTERNAL_RESEARCH_USER_ID = a.body.data.id;
  assert.equal((await call(`/internal/research/${id}`, {headers:{"X-Internal-Api-Key":"internal-test"}})).status,200);

  assert.equal(
    (
      await call(chatUrl, {
        body: chatBody,
        headers: { "X-Internal-Api-Key": "internal-test" },
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await call(chatUrl, {
        body: chatBody,
        headers: { "X-Internal-Api-Key": "internal-test" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(chatUrl, {
        body: { ...chatBody, requestId: "legacy" },
        headers: { "X-Internal-Api-Key": "internal-test" },
      })
    ).status,
    404,
  );
  const dashboardA = await call("/api/dashboard", { cookie: a.cookie }),
    dashboardB = await call("/api/dashboard", { cookie: b.cookie });
  assert.equal(dashboardA.body.data.researchCount, 1);
  assert.equal(dashboardB.body.data.researchCount, 0);
  assert.equal(dashboardA.body.data.documentCount, 1);
  assert.equal(dashboardB.body.data.documentCount, 0);
  assert.equal(dashboardA.body.data.recentResearch[0].requestId, id);
  assert.deepEqual(dashboardB.body.data.recentResearch, []);
  assert.equal((await call("/api/dashboard")).status, 401);

  const internalExport = await fetch(
    base + "/internal/research/reports/private-report/export/pdf",
    { headers: { "X-Internal-Api-Key": "internal-test" } },
  );
  assert.equal(internalExport.status, 200);
  assert.match(internalExport.headers.get("content-type"), /application\/pdf/);
  await internalExport.arrayBuffer();
  const internal = await call("/internal/research", {
    body: { topic: "Internal", goal: "Goal", executionMode: "async" },
    headers: { "X-Internal-Api-Key": "internal-test" },
    origin: "http://internal",
  });
  assert.equal(internal.status, 201);
  assert.equal(
    (
      await db.get("SELECT owner_id FROM requests WHERE id=$1", [
        internal.body.data.requestId,
      ])
    ).owner_id,
    a.body.data.id,
  );

  assert.equal(
    (
      await call("/api/auth/logout", {
        cookie: a.cookie,
        body: {},
        origin: "https://attacker.test",
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("/api/auth/logout", { cookie: a.cookie, body: {} })).status,
    200,
  );
  assert.equal((await call("/api/auth/me", { cookie: a.cookie })).status, 401);
  await db.run(
    "UPDATE user_sessions SET expires_at='2000-01-01' WHERE user_id=$1",
    [b.body.data.id],
  );
  assert.equal((await call("/api/auth/me", { cookie: b.cookie })).status, 401);
  const change = await call("/api/auth/change-password", {
    cookie: login.cookie,
    body: {
      currentPassword: credentials.password,
      password: "changed password long",
    },
  });
  assert.equal(change.status, 200);
  assert.equal(
    (await call("/api/auth/me", { cookie: login.cookie })).status,
    401,
  );
  assert.equal(
    (await call("/api/auth/me", { cookie: change.cookie })).status,
    200,
  );
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.run("UPDATE requests SET owner_id='oops' WHERE id='legacy'");
      throw Error("rollback");
    }),
  );
  assert.equal(
    (await db.get("SELECT owner_id FROM requests WHERE id='legacy'")).owner_id,
    "workspace",
  );
  let status;
  for (let i = 0; i < 35; i++)
    status = (
      await call("/api/auth/login", {
        body: { email: "nobody@example.test", password: "wrong" },
      })
    ).status;
  assert.equal(status, 429);
});
