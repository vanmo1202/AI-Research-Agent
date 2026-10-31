const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { randomUUID } = require("node:crypto");
process.env.RESEARCH_DB_PATH = join(
  mkdtempSync(join(require("node:os").tmpdir(), "flow-v2-")),
  "test.db",
);
process.env.MOCK_LLM = "true";
process.env.MOCK_SEARCH = "true";
process.env.INTERNAL_API_KEY = "test-internal";
const db = require("../src/config/database"),
  service = require("../src/services/run.service"),
  runner = require("../src/workers/runner"),
  provider = require("../src/providers/research.provider");
async function create(opts = {}) {
  const id = randomUUID();
  await require("../src/models/request.model").create({
    id,
    topic: "Research safety",
    goal: "Check evidence",
    scope: "public",
    outputLength: "medium",
    status: "created",
    createdAt: new Date().toISOString(),
  });
  return service.create(id, { searchMore: false, ...opts }, randomUUID());
}
async function drain(options = {}) {
  for (let i = 0; i < 30; i++) {
    if (!(await runner.runOnce(options))) return;
  }
  throw new Error("Unbounded pipeline");
}
const real = {
  ...provider,
  collect: async (ctx) => ({
    sources: [0, 1].map((index) => ({
      id: randomUUID(),
      run_id: ctx.run.id,
      query: "research",
      title: "Evidence",
      url: `https://example.org/paper${index}`,
      normalized_url: `https://example.org/paper${index}`,
      provider: "test",
      original_content:
        "Research evidence supports careful safety evaluation. More context.",
      display_content_vi: "Nghiên cứu cần đánh giá an toàn.",
      content_hash: "hash",
      language: "en",
      translation_status: "complete",
      collected_at: new Date().toISOString(),
    })),
    warnings: [],
  }),
  extract: async (ctx, questions, chunks) => ({
    evidence: questions.map((q, index) => ({
      id: randomUUID(),
      runId: ctx.run.id,
      questionId: q.id,
      researchQuestion: q.question,
      chunkId: chunks[index % chunks.length].id,
      sourceVersionId: chunks[index % chunks.length].source_version_id,
      originalQuote: "Research evidence supports careful safety evaluation.",
      evidenceText: "Nghiên cứu hỗ trợ đánh giá an toàn.",
      relevanceScore: 0.8,
      reason: "Direct quote",
    })),
    warnings: [],
  }),
};
test("Flow v2 migration, pipeline, HTTP, isolation and concurrency", async (t) => {
  await db.initializeDatabase();
  await db.initializeDatabase();
  await t.test(
    "idempotency, competing claims, expired lease and fencing",
    async () => {
      const r = await create();
      assert.equal(
        (
          await service.create(
            r.request_id,
            { searchMore: false },
            r.idempotency_key,
          )
        ).id,
        r.id,
      );
      await assert.rejects(
        service.create(r.request_id, { searchMore: true }, r.idempotency_key),
        { status: 409 },
      );
      const claims = await Promise.all([runner.claim("a"), runner.claim("b")]);
      assert.equal(claims.filter(Boolean).length, 1);
      const job = claims.find(Boolean);
      await db.run(
        "UPDATE stage_jobs SET locked_until='2000-01-01' WHERE id=?",
        [job.id],
      );
      const recovered = await runner.claim("c");
      assert.equal(recovered.id, job.id);
      assert.equal(recovered.attempts, 2);
      assert.equal(await runner.heartbeat(job, "a"), false);
      assert.equal(
        await runner.commit(
          job,
          "a",
          await runner.context(recovered, new AbortController().signal),
          {},
        ),
        false,
      );
      await service.cancel(r.id);
    },
  );
  await t.test(
    "planner failure redacts secrets, retry and cancel",
    async () => {
      const r = await create();
      await runner.runOnce({
        handlers: {
          planning: async () => {
            throw new Error("secret-api-key");
          },
        },
      });
      const p = await service.progress(r.request_id, r.id);
      assert.equal(p.status, "failed");
      assert.ok(!JSON.stringify(p).includes("secret-api-key"));
      const j = await service.retry(r.id, undefined, "retry-one");
      assert.equal(
        (await service.retry(r.id, undefined, "retry-one")).id,
        j.id,
      );
      await service.cancel(r.id);
      await drain();
      assert.equal((await service.requireRun(r.id)).status, "cancelled");
    },
  );
  await t.test(
    "mock produces partial rather than fabricated evidence",
    async () => {
      const r = await create();
      await drain();
      const p = await service.progress(r.request_id, r.id);
      assert.equal(p.status, "partial");
      assert.equal(p.evidenceCount, 0);
    },
  );
  await t.test(
    "full success, exports and historical report preserved",
    async () => {
      const r = await create();
      await drain({ customProvider: real });
      assert.equal((await service.requireRun(r.id)).status, "completed");
      const first = await db.get(
        "SELECT * FROM report_versions WHERE run_id=?",
        [r.id],
      );
      await db.run("UPDATE research_runs SET status='partial' WHERE id=?", [
        r.id,
      ]);
      await service.retry(r.id, "composing", "report-revision");
      await drain({ customProvider: real });
      const versions = await db.all(
        "SELECT * FROM report_versions WHERE run_id=? ORDER BY rowid",
        [r.id],
      );
      assert.equal(versions.length, 2);
      assert.equal(versions[0].status, "historical");
      assert.equal(versions[0].content, first.content);
      for (const format of ["docx", "pdf"])
        assert.ok(
          (
            await require("../src/services/run-export.service").exportReport(
              first.id,
              format,
            )
          ).buffer.length > 100,
        );
      const second = await service.create(
        r.request_id,
        { searchMore: false },
        "new-run",
      );
      assert.equal(
        (
          await db.all("SELECT * FROM source_versions WHERE run_id=?", [
            second.id,
          ])
        ).length,
        0,
      );
      await service.cancel(second.id);
    },
  );
  await t.test("search-more limited to two rounds", async () => {
    const r = await create({ searchMore: true, numberOfSources: 30 });
    await drain();
    const run = await service.requireRun(r.id);
    assert.equal(run.status, "partial");
    assert.equal(run.current_round, 2);
  });
  await t.test("invalid citation yields partial", async () => {
    const r = await create();
    await drain({
      customProvider: real,
      handlers: {
        composing: async (ctx) => ({
          ...(await require("../src/jobs/composing.job")(ctx)),
          content: "Unsupported [999]",
        }),
      },
    });
    assert.equal((await service.requireRun(r.id)).status, "partial");
  });
  await t.test("foreign provenance is rejected atomically", async () => {
    const r = await create();
    await drain({
      customProvider: {
        ...real,
        extract: async () => ({
          evidence: [
            {
              runId: "foreign",
              chunkId: "fake",
              sourceVersionId: "fake",
              originalQuote: "forged",
            },
          ],
          warnings: [],
        }),
      },
    });
    assert.equal((await service.requireRun(r.id)).status, "failed");
    assert.equal(
      (await db.all("SELECT * FROM analysis_versions WHERE run_id=?", [r.id]))
        .length,
      0,
    );
  });
  await t.test(
    "n8n stages wait for authenticated dispatch rather than auto-executing",
    async () => {
      const r = await create({ orchestration: "n8n" });
      assert.equal(await runner.runOnce(), false);
      const job = await service.dispatch(r.id, "planning", "planning:0");
      assert.equal(job.stage, "planning");
      await runner.runOnce();
      assert.equal(await runner.runOnce(), false);
      const p = await service.progress(r.request_id, r.id);
      assert.equal(p.currentStage, "collecting");
      await service.cancel(r.id);
    },
  );
  await t.test("independent processes cannot claim the same job", async () => {
    const r = await create();
    const execFile = require("node:util").promisify(
      require("node:child_process").execFile,
    );
    const script =
      "(async()=>{await require('./src/config/database').initializeDatabase();const j=await require('./src/workers/runner').claim(process.argv[1]);console.log(JSON.stringify(j?j.id:null));process.exit(0)})().catch(()=>process.exit(1))";
    const results = await Promise.all(
      ["process-a", "process-b"].map((owner) =>
        execFile(process.execPath, ["-e", script, owner], {
          cwd: join(__dirname, ".."),
          env: process.env,
        }),
      ),
    );
    assert.equal(
      results.map((result) => JSON.parse(result.stdout.trim())).filter(Boolean)
        .length,
      1,
    );
    await service.cancel(r.id);
  });
  await t.test(
    "provider query isolation, timeouts, translation failure and durable budgets",
    async () => {
      const r = await create();
      await db.run("UPDATE research_runs SET status='running' WHERE id=?", [
        r.id,
      ]);
      const oldFetch = global.fetch,
        oldLLM = process.env.MOCK_LLM,
        oldSearch = process.env.MOCK_SEARCH,
        oldKey = process.env.TAVILY_API_KEY;
      process.env.MOCK_SEARCH = "false";
      process.env.TAVILY_API_KEY = "fake-key";
      const ctx = {
        run: await service.requireRun(r.id),
        input: { numberOfSources: 4 },
        signal: new AbortController().signal,
        check() {},
      };
      let calls = 0;
      try {
        global.fetch = async () => {
          calls++;
          if (calls === 1)
            throw Object.assign(new Error("raw secret"), {
              name: "TimeoutError",
            });
          return new Response(
            JSON.stringify({
              results: [
                {
                  title: "Research",
                  url: "https://example.org/study",
                  raw_content: "Research evidence supports safety.",
                },
              ],
            }),
            { status: 200 },
          );
        };
        process.env.MOCK_LLM = "false";
        process.env.GEMINI_API_KEY = "fake-key";
        const data = await provider.collect(ctx, ["query"], []);
        assert.equal(data.sources.length, 1);
        assert.equal(data.sources[0].translation_status, "failed");
        assert.ok(data.sources[0].original_content.includes("Research"));
        global.fetch = async () => new Response("{}", { status: 503 });
        await assert.rejects(provider.collect(ctx, ["fail"], []), {
          code: "SEARCH_UNAVAILABLE",
        });
        await db.run("UPDATE research_runs SET llm_calls=32 WHERE id=?", [
          r.id,
        ]);
        await assert.rejects(provider.json(ctx, "test", {}), {
          code: "BUDGET_EXHAUSTED",
        });
      } finally {
        global.fetch = oldFetch;
        process.env.MOCK_LLM = oldLLM;
        process.env.MOCK_SEARCH = oldSearch;
        if (oldKey === undefined) delete process.env.TAVILY_API_KEY;
        else process.env.TAVILY_API_KEY = oldKey;
        delete process.env.GEMINI_API_KEY;
        await service.cancel(r.id);
      }
    },
  );
  await t.test(
    "transient job errors defer retries; cancellation fences in-flight writes",
    async () => {
      const r = await create();
      await runner.runOnce({
        handlers: {
          planning: async () => {
            throw provider.fail("PROVIDER_UNAVAILABLE", true);
          },
        },
      });
      let job = await db.get("SELECT * FROM stage_jobs WHERE run_id=?", [r.id]);
      assert.equal(job.status, "retry_waiting");
      await db.run(
        "UPDATE stage_jobs SET available_at='2000-01-01' WHERE id=?",
        [job.id],
      );
      await runner.runOnce({
        handlers: {
          planning: async (ctx) => {
            await service.cancel(ctx.run.id);
            return { plan: await provider.plan(ctx) };
          },
        },
      });
      job = await db.get("SELECT * FROM stage_jobs WHERE id=?", [job.id]);
      assert.equal(job.status, "cancelled");
      assert.equal(job.output_json, null);
    },
  );
  await t.test("coverage schema rejects inconsistent decisions", async () => {
    const { validate } = require("../src/validators/evaluation.validator");
    assert.throws(
      () =>
        validate({
          coverage: "sufficient",
          action: "search_more",
          gaps: [],
          additional_queries: ["q"],
          reason: "bad",
        }),
      { status: 400 },
    );
    assert.throws(
      () =>
        validate({
          coverage: "insufficient",
          action: "search_more",
          gaps: [],
          additional_queries: [],
          reason: "bad",
        }),
      { status: 400 },
    );
  });
  await t.test("HTTP 202, auth, replay and ownership", async () => {
    const server = require("../src/server").app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (path, body, headers = {}) =>
      fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json", ...headers },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    try {
      const request = await (
          await call("/api/research", {
            topic: "HTTP topic",
            goal: "Async",
            executionMode: "async",
          })
        ).json(),
        id = request.data.requestId;
      const response = await call(
        `/api/research/${id}/runs`,
        { searchMore: false },
        { "Idempotency-Key": "http-create" },
      );
      assert.equal(response.status, 202);
      const run = (await response.json()).data;
      assert.equal((await call(`/api/research/${id}/runs`, {})).status, 400);
      const p = await (
        await call(`/api/research/${id}/runs/${run.runId}/progress`)
      ).json();
      assert.equal(p.data.status, "queued");
      const job = p.data.currentJob;
      assert.equal(
        (await call(`/internal/jobs/${job.id}?runId=${run.runId}`)).status,
        401,
      );
      const headers = {
          "X-Internal-Api-Key": "test-internal",
          "Idempotency-Key": job.idempotency_key,
        },
        path = `/internal/runs/${run.runId}/jobs`;
      const a = await (await call(path, { stage: "planning" }, headers)).json(),
        b = await (await call(path, { stage: "planning" }, headers)).json();
      assert.equal(a.data.id, b.data.id);
      assert.equal(
        (
          await call(
            `/internal/jobs/${job.id}?runId=foreign`,
            undefined,
            headers,
          )
        ).status,
        404,
      );
      await service.cancel(run.runId);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});
