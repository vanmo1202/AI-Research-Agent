const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("Workflow 2: API, provider, collection, failures and persistence", async t => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "search-workflow-"));
    const databasePath = path.join(directory, "research.db");
    process.env.RESEARCH_DB_PATH = databasePath;
    process.env.MOCK_LLM = "true";
    process.env.MOCK_SEARCH = "true";
    process.env.SEARCH_CONCURRENCY = "2";
    process.env.MAX_SOURCE_CONTENT_CHARS = "20000";
    delete process.env.TAVILY_API_KEY;
    const { app } = require("../src/server");
    const db = require("../src/config/database");
    const search = require("../src/services/search.service");
    const content = require("../src/services/content.service");
    const normalizer = require("../src/utils/sourceNormalizer");
    const urls = require("../src/utils/url");
    const networkFetch = global.fetch;
    const originalSearch = search.searchWeb;
    const originalContent = content.fetchPageContent;
    await db.initializeDatabase();
    const server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    async function api(endpoint, method = "GET", body) {
        const response = await networkFetch(base + endpoint, { method,
            headers: { "Content-Type": "application/json" },
            ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, body: await response.json() };
    }
    async function create() {
        const response = await api("/api/research", "POST", { topic: "AI inventory", goal: "Benefits and limitations" });
        assert.equal(response.status, 201);
        return response.body.data.requestId;
    }
    const fixture = (url, text = "Useful public source content") => ({ title: "Source", url,
        snippet: "Excerpt", content: text, provider: "mock" });
    let requestId;
    try {
        await t.test("Mock has no network, successful collection, GET and rerun dedup", async () => {
            global.fetch = async () => { throw new Error("No network allowed in mock"); };
            requestId = await create();
            const empty = await api(`/api/research/${requestId}/sources`);
            assert.equal(empty.body.data.sourceCount, 0);
            const result = await api(`/api/research/${requestId}/search`, "POST");
            assert.equal(result.status, 200);
            assert.equal(result.body.data.status, "collected");
            assert.equal(result.body.data.queryCount, 4);
            assert.equal(result.body.data.sourceCount, 8);
            assert.ok(result.body.data.sources.every(s => s.id && s.provider === "mock" && s.content));
            const read = await api(`/api/research/${requestId}/sources`);
            assert.deepEqual(read.body.data.sources, result.body.data.sources);
            const request = await api(`/api/research/${requestId}`);
            assert.equal(request.body.data.request.status, "collected");
            const again = await api(`/api/research/${requestId}/search`, "POST");
            assert.equal(again.body.data.sourceCount, 8);
            assert.deepEqual(again.body.data.sources.map(s => s.id), read.body.data.sources.map(s => s.id));
        });
        await t.test("Missing request and missing search queries", async () => {
            for (const route of ["search", "sources"]) {
                const response = await api(`/api/research/missing/${route}`, route === "search" ? "POST" : "GET");
                assert.equal(response.status, 404);
                assert.equal(response.body.error, "Research request not found");
            }
            const id = await create();
            await db.run("DELETE FROM plans WHERE request_id = ?", [id]);
            const response = await api(`/api/research/${id}/search`, "POST");
            assert.equal(response.status, 400);
            assert.equal(response.body.error, "Research plan does not contain search queries");
        });
        await t.test("URL normalization, dedup, content preference and invalid result", () => {
            const sources = [fixture("https://EXAMPLE.com/article", "first"),
                fixture("https://example.com/article/", "first"),
                fixture("https://example.com/article?utm_source=x#section", "longer content")]
                .map(source => normalizer.normalizeSource(source, "query"));
            const unique = urls.deduplicateSources(sources);
            assert.equal(unique.length, 1);
            assert.equal(unique[0].content, "longer content");
            assert.equal(urls.normalizeUrl("https://example.com/article?item=1&utm_medium=x"), "https://example.com/article?item=1");
            assert.equal(normalizer.normalizeSource(fixture("not-url"), "query"), null);
            assert.equal(normalizer.normalizeSource(fixture("javascript:alert(1)"), "query"), null);
        });
        await t.test("Partial search failure succeeds; content failure keeps source", async () => {
            let count = 0;
            search.searchWeb = async () => {
                if (count++ === 0) throw new Error("Query failed");
                return [fixture("https://example.com/article", "")];
            };
            content.fetchPageContent = async () => "";
            const id = await create();
            const response = await api(`/api/research/${id}/search`, "POST");
            assert.equal(response.status, 200);
            assert.equal(response.body.data.sourceCount, 1);
            assert.equal(response.body.data.sources[0].content, "");
        });
        await t.test("All failures and no valid sources set failed status", async () => {
            for (const callback of [async () => { throw new Error("Provider unavailable"); },
                async () => [fixture("invalid-url")], async () => []]) {
                search.searchWeb = callback;
                const id = await create();
                const response = await api(`/api/research/${id}/search`, "POST");
                assert.equal(response.status, 502);
                const read = await api(`/api/research/${id}`);
                assert.equal(read.body.data.request.status, "failed");
            }
        });
        await t.test("Search concurrency bound and same-request overlap returns 409", async () => {
            let active = 0;
            let maximum = 0;
            search.searchWeb = async query => {
                active++; maximum = Math.max(maximum, active);
                await new Promise(resolve => setTimeout(resolve, 30));
                active--;
                return [fixture(`https://example.com/${encodeURIComponent(query)}`)];
            };
            const id = await create();
            const results = await Promise.all([api(`/api/research/${id}/search`, "POST"), api(`/api/research/${id}/search`, "POST")]);
            assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
            assert.equal(maximum, 2);
        });
        await t.test("Tavily request shape and provider errors without real network", async () => {
            process.env.MOCK_SEARCH = "false";
            process.env.SEARCH_PROVIDER = "tavily";
            await assert.rejects(originalSearch("query"), /TAVILY_API_KEY/);
            process.env.TAVILY_API_KEY = "test-placeholder";
            global.fetch = async (url, options) => {
                assert.equal(url, "https://api.tavily.com/search");
                assert.ok(options.signal);
                const body = JSON.parse(options.body);
                assert.equal(body.query, "query"); assert.equal(body.max_results, 5);
                return { ok: true, json: async () => ({ results: [{ title: "Title", url: "https://example.com",
                    content: "Snippet only", raw_content: "Full page" }] }) };
            };
            const result = await originalSearch("query");
            assert.equal(result[0].snippet, "Snippet only");
            assert.equal(result[0].content, "Full page");
            global.fetch = async () => ({ ok: false, status: 429 });
            await assert.rejects(originalSearch("query"), /HTTP 429/);
            global.fetch = async () => ({ ok: true, json: async () => ({}) });
            await assert.rejects(originalSearch("query"), /invalid search results/);
            process.env.MOCK_SEARCH = "true";
        });
        await t.test("HTML cleaning, truncation, HTTP failure and private URLs", async () => {
            const html = "<html><style>hide</style><script>secret()</script><p>Hello&nbsp;world</p><p>Text</p></html>";
            assert.equal(content.cleanContent(html), "Hello world Text");
            process.env.MAX_SOURCE_CONTENT_CHARS = "5";
            assert.equal(content.cleanContent(html), "Hello");
            process.env.MAX_SOURCE_CONTENT_CHARS = "20000";
            global.fetch = async () => new Response(html, { headers: { "Content-Type": "text/html" } });
            assert.equal(await originalContent("https://93.184.216.34/article"), "Hello world Text");
            global.fetch = async () => { throw new Error("Timeout"); };
            assert.equal(await originalContent("https://93.184.216.34/article"), "");
            await assert.rejects(content.checkPublicUrl("http://127.0.0.1"), /public address/);
        });
        await t.test("Transaction rollback leaves no partial sources", async () => {
            const id = await create();
            const model = require("../src/models/source.model");
            const valid = normalizer.normalizeSource(fixture("https://example.com/rollback"), "query");
            await assert.rejects(model.createSources(id, [valid, { ...valid, normalizedUrl: null }]));
            assert.equal((await model.getSourcesByRequestId(id)).length, 0);
            assert.equal((await api(`/api/research/${id}`)).body.data.request.status, "planned");
        });
        await t.test("SQLite persistence from independent process", () => {
            const result = spawnSync(process.execPath, ["-e", `
                const db = new (require('sqlite3').Database)(process.argv[1]);
                db.get('SELECT count(*) AS count FROM sources WHERE request_id = ?', [process.argv[2]], (error, row) => {
                    if (error) process.exit(1); console.log(row.count); db.close();
                });
            `, databasePath, requestId], { encoding: "utf8" });
            assert.equal(result.status, 0);
            assert.equal(result.stdout.trim(), "8");
        });
    } finally {
        global.fetch = networkFetch;
        search.searchWeb = originalSearch;
        content.fetchPageContent = originalContent;
        await new Promise(resolve => server.close(resolve));
        // File tạm chỉ dùng trong test; connection được giải phóng khi process test kết thúc.
        await fs.rm(directory, { recursive: true, force: true });
    }
});
