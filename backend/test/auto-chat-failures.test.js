const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
process.env.RESEARCH_DB_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "auto-chat-failures-")),
  "test.db",
);
Object.assign(process.env, {
  MOCK_LLM: "false",
  MOCK_SEARCH: "false",
  GEMINI_API_KEY: "fake-gemini-never-live",
  TAVILY_API_KEY: "fake-tavily-never-live",
  HTTP_RETRY_COUNT: "3",
  GEMINI_MIN_INTERVAL_MS: "0",
});
const db = require("../src/config/database"),
  chat = require("../src/knowledge/chat"),
  auto = require("../src/knowledge/auto-research");
const question = "độ phức tạp thuật toán";
const body =
  "Algorithm analysis uses Big O notation to describe time complexity and space complexity. The number of operations increases with input size. Linear search examines each element at most once in the worst case, using a constant amount of additional memory.";
const quote = "The number of operations increases with input size.";
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status });
}
function completion(content, finish = "stop") {
  return json({
    choices: [
      {
        finish_reason: finish,
        message: {
          content:
            typeof content === "string" ? content : JSON.stringify(content),
        },
      },
    ],
  });
}
function routing() {
  return completion({
    question,
    queries: ["algorithm analysis time complexity space complexity Big O"],
    needsWeb: true,
    fresh: false,
  });
}
function web() {
  return json({
    results: [
      {
        title: "Algorithm analysis and Big O",
        url: "https://public.test/algorithms",
        content: "Algorithm complexity explained",
        raw_content: body,
      },
    ],
  });
}
function grounded(payload, changes = {}) {
  const c = payload.context[0];
  return {
    claims: [
      {
        text: "Độ phức tạp mô tả mức tăng tài nguyên theo kích thước đầu vào.",
        citations: [{ contextId: c.contextId, quote, ...changes }],
      },
    ],
  };
}
async function setup(t) {
  await db.initializeDatabase();
  t.mock.method(require("node:dns/promises"), "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
}

test("Short Vietnamese concept matches English subtopics without admitting financial volatility; direction stays specific", () => {
  for (const text of [
    body,
    "Time complexity describes the growth of running time as the size of input increases.",
    "Space complexity measures additional memory used by an algorithm.",
  ])
    assert.equal(auto.evaluate(question, { content: text }).status, "relevant");
  for (const text of [
    "Stock market prices, WTI and EUR/USD fluctuate as traders sell equities in foreign exchange markets.",
    "Economic complexity measures the diversification of exports and productive capabilities.",
  ])
    assert.equal(
      auto.evaluate(question, { title: question, content: text }).accepted,
      false,
    );
  assert.equal(
    auto.evaluate("space complexity", {
      content:
        "Time complexity describes how running time grows with input size.",
    }).accepted,
    false,
  );
});

test("Citation contract derives IDs from server context; explicit forged IDs and nonverbatim quotes still fail", () => {
  const context = [
    {
      contextId: "C1",
      referenceId: "stored",
      sourceId: "web:source",
      content: body,
      kind: "source",
      versionHash: "v1",
    },
  ];
  const result = chat.validateOutput(grounded({ context }), context);
  assert.equal(result.citations[0].referenceId, "stored");
  assert.equal(result.citations[0].sourceId, "web:source");
  assert.doesNotMatch(chat.PROMPT, /"sourceId":null/);
  for (const change of [
    { sourceId: null },
    { sourceId: "web:other" },
    { referenceId: "forged" },
    { documentId: "foreign" },
    { page: 2 },
    { quote: "not a sentence from this source" },
  ])
    assert.throws(
      () => chat.validateOutput(grounded({ context }, change), context),
      { status: 502 },
    );
});


async function createResearchFixture(owner) {
  const { randomUUID } = require("node:crypto");
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  await db.run(
    `INSERT INTO requests
     (id, topic, goal, scope, output_length, status,
      created_at, updated_at, owner_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      "Algorithm analysis độ phức tạp thuật toán",
      "Kiểm chứng độ phức tạp thuật toán bằng nguồn Internet",
      "public",
      "medium",
      "planned",
      timestamp,
      timestamp,
      owner
    ]
  );

  return id;
}

test("Real transport shape: short Vietnamese query, English source, minimal citation and subject-free verbatim quote complete end to end", async (t) => {
  await setup(t);
  let calls = 0;
  t.mock.method(global, "fetch", async (url, opts) => {
    calls++;
    if (url === "https://api.tavily.com/search") {
      assert.match(JSON.parse(opts.body).query, /algorithm analysis/i);
      return web();
    }
    if (url === "https://public.test/algorithms") {
      return new Response(
        `<html><body><article><p>${body}</p></article></body></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }
      );
    }
    assert.equal(
      url,
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    );
    const p = JSON.parse(JSON.parse(opts.body).messages[1].content);
    return p.context ? completion({ related: true, ...grounded(p) }) : routing();
  });
  const requestId = await createResearchFixture("minimal-citation");
  const s = await chat.create("minimal-citation", requestId, {}),
    r = await chat.send(s.id, "minimal-citation", {
      content: question + " tìm thêm nguồn trên Internet",
      clientToken: "minimal",
    });
  assert.equal(
    auto.evaluate(question, { content: quote }).accepted,
    false,
    "A valid quote need not repeat the subject keywords",
  );
  assert.equal(r.status, "complete");
  assert.equal(r.research.searchStatus, "sources_ready");
  assert.equal(r.research.outcome, "grounded");
  assert.equal(r.citations.length, 1);
  assert.equal(r.citations[0].quote, quote);
  assert.equal(calls, 3);
  assert.equal(r.research.usage.llm_calls, 1);
});

test("Gemini failures preserve safe structured diagnosis in stored messages and never retry", async (t) => {
  await setup(t);
  const cases = [
    [
      "auth",
      () => json({ error: { message: "PRIVATE_PROVIDER_SECRET" } }, 401),
      "GEMINI_AUTH_FAILED",
      503,
    ],
    [
      "quota",
      () =>
        json(
          {
            error: { message: "daily quota exhausted PRIVATE_PROVIDER_SECRET" },
          },
          429,
        ),
      "GEMINI_QUOTA_EXHAUSTED",
      429,
    ],
    ["model", () => json({}, 404), "GEMINI_MODEL_NOT_FOUND", 503],
    [
      "network",
      () => {
        throw new TypeError("PRIVATE_PROVIDER_SECRET");
      },
      "GEMINI_NETWORK_ERROR",
      503,
    ],
    [
      "timeout",
      () => {
        throw new DOMException("PRIVATE_PROVIDER_SECRET", "TimeoutError");
      },
      "CHAT_TIMEOUT",
      503,
    ],
    ["json", () => completion('{"claims":['), "GEMINI_INVALID_JSON", 502],
    [
      "truncated",
      () => completion('{"claims":[', "length"),
      "GEMINI_OUTPUT_TRUNCATED",
      502,
    ],
    [
      "blocked",
      () => completion("", "content_filter"),
      "GEMINI_OUTPUT_BLOCKED",
      502,
    ],
    [
      "schema",
      () => completion({ related: true, claims: "not-array" }),
      "CHAT_INVALID_SCHEMA",
      502,
    ],
    [
      "citation",
      (p) =>
        completion({ related: true, ...grounded(p, { quote: "This is not in the actual source." }) }),
      "CHAT_CITATION_REJECTED",
      502,
    ],
  ];
  for (const [name, response, code, status] of cases) {
    let calls = 0,
      logs = [];
    const logging = t.mock.method(console, "warn", (...args) =>
      logs.push(args.join(" ")),
    );
    const fetch = t.mock.method(global, "fetch", async (url, opts) => {
      if (url === "https://api.tavily.com/search") return web();
      if (url === "https://public.test/algorithms") {
        return new Response(`<html><body><p>${body}</p></body></html>`, {
          headers: { "content-type": "text/html" },
        });
      }
      assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
      calls++;
      const payload = JSON.parse(JSON.parse(opts.body).messages[1].content);
      return response(payload);
    });
    const owner = "failure-" + name,
      s = await chat.create(owner, await createResearchFixture(owner), {});
    await assert.rejects(
      chat.send(s.id, owner, { content: question + " tìm thêm nguồn trên Internet", clientToken: name }),
      (e) => e.code === code && e.status === status,
    );
    const m = (await chat.messages(s.id, owner)).at(-1);
    assert.equal(m.status, "failed");
    assert.equal(m.research.error.code, code);
    assert.equal(m.research.searchStatus, "sources_ready");
    assert.equal(
      m.research.failedStage,
      ["schema", "citation"].includes(name) ? "validating" : "answering",
    );
    assert.equal(m.citations.length, 0);
    assert.equal(calls, 1, "No implicit Gemini retry");
    assert.ok(logs.some((line) => line.includes(code)));
    assert.doesNotMatch(
      logs.join(" ") + JSON.stringify(m),
      /PRIVATE_PROVIDER_SECRET|fake-gemini/,
    );
    fetch.mock.restore();
    logging.mock.restore();
  }
});

test("Tavily failure, empty search, off-topic results and unreadable sources are different outcomes", async (t) => {
  await setup(t);
  process.env.MOCK_LLM = "true";
  t.after(() => {
    process.env.MOCK_LLM = "false";
  });
  const cases = [
    ["auth", () => json({}, 401), "provider_error", "TAVILY_AUTH_FAILED"],
    ["quota", () => json({}, 432), "provider_error", "TAVILY_QUOTA_EXCEEDED"],
    ["paygo", () => json({}, 433), "provider_error", "TAVILY_QUOTA_EXCEEDED"],
    ["rate", () => json({}, 429), "provider_error", "TAVILY_QUOTA_EXCEEDED"],
    [
      "network",
      () => {
        throw new TypeError("PRIVATE_PROVIDER_SECRET");
      },
      "provider_error",
      "TAVILY_NETWORK_ERROR",
    ],
    [
      "invalid",
      () => new Response("not json"),
      "provider_error",
      "TAVILY_INVALID_RESPONSE",
    ],
    ["empty", () => json({ results: [] }), "no_results"],
    [
      "filtered",
      () =>
        json({
          results: [
            {
              title: question,
              url: "https://public.test/finance",
              raw_content:
                "WTI crude oil and stock market volatility affect EUR/USD currency trading. Investors trade futures and equities in financial markets.",
            },
          ],
        }),
      "filtered_out",
    ],
  ];
  for (const [name, response, status, code] of cases) {
    let calls = 0;
    const handle = t.mock.method(global, "fetch", async (url) => {
      assert.equal(url, "https://api.tavily.com/search");
      calls++;
      return response();
    });
    const owner = "search-" + name;
    const requestId = await createResearchFixture(owner);
    const session = await chat.create(owner, requestId, {});
    const payload = {
      content: question + " tìm thêm nguồn trên Internet",
      clientToken: name,
    };

    if (code) {
      await assert.rejects(
        chat.send(session.id, owner, payload),
        error =>
          error.code === code &&
          error.status === (
            code === "TAVILY_QUOTA_EXCEEDED" ? 429 : 503
          )
      );

      const message = (await chat.messages(session.id, owner)).at(-1);
      assert.equal(message.status, "failed");
      assert.equal(message.research.searchStatus, "provider_error");
      assert.equal(message.research.error.code, code);
      assert.equal(message.research.searched, false);
      assert.ok(
        !message.research.warnings.includes("NO_RELEVANT_WEB_SOURCES")
      );
    } else {
      const reply = await chat.send(session.id, owner, payload);
      assert.equal(reply.status, "complete");
      assert.equal(reply.research.searchStatus, status);
      assert.equal(reply.research.searched, true);
      assert.equal(reply.citations.length, 0);
      assert.equal(reply.research.outcome, "insufficient_evidence");
      assert.match(reply.content, /Chưa có nguồn bổ sung đủ phù hợp/);
    }

    assert.equal(calls, 1);
    handle.mock.restore();
  }
});

test("Routing authentication failure stops before paid search; no misleading searched flag", async (t) => {
  await setup(t);
  let calls = 0;
  t.mock.method(global, "fetch", async (url) => {
    calls++;
    assert.match(url, /generativelanguage/);
    return json({}, 403);
  });
  const s = await chat.create("routing-auth", await createResearchFixture("routing-auth"), {});
  await assert.rejects(
    chat.send(s.id, "routing-auth", {
      content: question,
      clientToken: "routing",
    }),
    { code: "GEMINI_AUTH_FAILED", status: 503 },
  );
  const r = (await chat.messages(s.id, "routing-auth")).at(-1);
  assert.equal(r.research.failedStage, "answering");
  assert.equal(r.research.searched, false);
  assert.equal(calls, 1);
});

test("HTTP failure exposes safe code without leaking provider auth as user session expiration; history and ownership remain intact", async (t) => {
  await setup(t);
  const { fixtureHeaders } = require("./helpers/session"),
    native = global.fetch,
    headers = await fixtureHeaders();
  const { app } = require("../src/server");
  const server = await new Promise((r) => {
    const s = app.listen(0, "127.0.0.1", () => r(s));
  });
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const s = await chat.create("fixture-user", await createResearchFixture("fixture-user"), {});
  let posts = 0;
  t.mock.method(global, "fetch", async (url, opts) => {
    if (String(url).startsWith(base)) return native(url, opts);
    if (url === "https://api.tavily.com/search") return web();
    posts++;
    return json({ error: { message: "PRIVATE_PROVIDER_SECRET" } }, 401);
  });
  const r = await fetch(`${base}/api/chats/${s.id}/messages`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ content: question, clientToken: "http" }),
  });
  assert.equal(r.status, 503);
  const payload = await r.json();
  assert.equal(payload.code, "GEMINI_AUTH_FAILED");
  assert.equal(payload.stage, "answering");
  assert.doesNotMatch(
    JSON.stringify(payload),
    /PRIVATE_PROVIDER_SECRET|fake-gemini/,
  );
  assert.equal(posts, 1);
  const history = await fetch(`${base}/api/chats/${s.id}/messages`, {
    headers,
  });
  assert.equal(history.status, 200);
  assert.equal(
    (await history.json()).data.at(-1).research.error.code,
    "GEMINI_AUTH_FAILED",
  );
  const stranger = await native(`${base}/api/chats/${s.id}/messages`);
  assert.equal(stranger.status, 401);
});

test("Budget reservation failure is distinct and stops before synthesis HTTP", async (t) => {
  await setup(t);
  const previous = process.env.AUTO_CHAT_DAILY_GEMINI_LIMIT;
  process.env.AUTO_CHAT_DAILY_GEMINI_LIMIT = "1";
  t.after(() => {
    if (previous === undefined) delete process.env.AUTO_CHAT_DAILY_GEMINI_LIMIT;
    else process.env.AUTO_CHAT_DAILY_GEMINI_LIMIT = previous;
  });
  let modelCalls = 0;
  t.mock.method(global, "fetch", async (url) => {
    if (url === "https://api.tavily.com/search") return web();
    modelCalls++;
    return completion({
      related: true,
      content: "Giải thích kỹ thuật trong phạm vi nghiên cứu.",
    });
  });
  const s = await chat.create("budget-reservation", await createResearchFixture("budget-reservation"), {});
  const first = await chat.send(s.id, "budget-reservation", {
    content: question,
    clientToken: "budget-primer",
  });
  assert.equal(first.status, "complete");
  await assert.rejects(
    chat.send(s.id, "budget-reservation", {
      content: question,
      clientToken: "budget",
    }),
    { status: 429, code: "AUTO_CHAT_BUDGET_EXCEEDED" },
  );
  const r = (await chat.messages(s.id, "budget-reservation")).at(-1);
  assert.equal(r.research.error.code, "AUTO_CHAT_BUDGET_EXCEEDED");
  const used = await db.get(
    "SELECT llm_calls FROM chat_daily_usage WHERE subject=$1 AND day=$2",
    ["user:budget-reservation", new Date().toISOString().slice(0, 10)]
  );
  assert.equal(used.llm_calls, 1);
  assert.equal(modelCalls, 1);
});

test("Search succeeded but blocked/unreadable web pages do not become provider authentication failure", async (t) => {
  await setup(t);
  process.env.MOCK_LLM = "true";
  t.after(() => {
    process.env.MOCK_LLM = "false";
  });
  t.mock.method(global, "fetch", async (url) =>
    url === "https://api.tavily.com/search"
      ? json({
          results: [
            {
              title: question,
              url: "https://public.test/blocked",
              content: "Algorithm complexity and Big O notation",
            },
          ],
        })
      : new Response("", { status: 403 }),
  );
  const s = await chat.create("unreadable", await createResearchFixture("unreadable"), {}),
    r = await chat.send(s.id, "unreadable", {
      content: question + " tìm thêm nguồn trên Internet",
      clientToken: "unreadable",
    });
  assert.equal(r.research.searchStatus, "unreadable");
  assert.equal(r.research.searchCounts.successfulSearches, 1);
  assert.equal(r.research.searchCounts.readFailures, 1);
  assert.equal(r.research.searchFailures.length, 0);
  assert.equal(r.citations.length, 0);
  assert.match(r.content, /Chưa có nguồn bổ sung đủ phù hợp/);
});
