const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
process.env.HTTP_RETRY_COUNT = "0";
const llm = require("../src/services/llm.service");

const input = {
    topic: "Ứng dụng AI trong giáo dục đại học",
    goal: "Phân tích ứng dụng, lợi ích và thách thức",
    scope: "Nguồn công khai", outputLength: "medium"
};
const rawPlan = {
    researchQuestions: ["  AI được ứng dụng như thế nào?  ", "Cần những dữ liệu nào?",
        "Lợi ích được đánh giá thế nào?", "Có những thách thức nào?"],
    searchQueries: ["  AI higher education applications  ", "AI higher education data requirements",
        "AI higher education benefits evaluation", "AI higher education challenges"]
};
const expectedPlan = {
    researchQuestions: rawPlan.researchQuestions.map((question, index) => ({ id: `Q${index + 1}`, question: question.trim() })),
    searchQueries: rawPlan.searchQueries.map((query, index) => ({ questionId: `Q${index + 1}`, query: query.trim() }))
};
function geminiResponse(content = JSON.stringify(rawPlan), finishReason = "stop") {
    return new Response(JSON.stringify({ choices: [{ finish_reason: finishReason, message: { content } }] }), {
        headers: { "Content-Type": "application/json" }
    });
}

test("Gemini planner: transport, parsing, validation and safe errors", async t => {
    const previousEnv = { ...process.env };
    const previousFetch = global.fetch;
    try {
        process.env.MOCK_LLM = "false";
        process.env.LLM_PROVIDER = "gemini";
        process.env.GEMINI_API_KEY = "test-placeholder";
        process.env.HTTP_RETRY_COUNT = "0";
        delete process.env.GEMINI_MODEL;

        await t.test("Mock keeps 3/4/5 questions and never calls any network without keys", async () => {
            process.env.MOCK_LLM = "true";
            delete process.env.GEMINI_API_KEY;
            delete process.env.OPENAI_API_KEY;
            global.fetch = async () => { throw new Error("Network must not be called"); };
            for (const [outputLength, count] of [["short", 3], ["medium", 4], ["long", 5]]) {
                const plan = await llm.generateResearchPlan({ ...input, outputLength });
                assert.equal(plan.researchQuestions.length, count);
                assert.equal(plan.searchQueries.length, count);
                assert.equal(plan.researchQuestions[0].id, "Q1");
                assert.ok(plan.researchQuestions[0].question.includes(input.topic));
            }
            process.env.MOCK_LLM = "false";
            process.env.GEMINI_API_KEY = "test-placeholder";
        });

        await t.test("Gemini request uses Google URL, default model, system prompt and complete user input", async () => {
            let calls = 0;
            global.fetch = async (url, options) => {
                calls++;
                assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
                assert.equal(options.method, "POST");
                assert.equal(options.headers.Authorization, `Bearer ${process.env.GEMINI_API_KEY}`);
                assert.ok(options.signal instanceof AbortSignal);
                const body = JSON.parse(options.body);
                assert.equal(body.model, "gemini-2.5-flash");
                assert.equal(body.temperature, 0.3);
                assert.equal(body.response_format.type, "json_object");
                assert.equal(body.messages[0].content, llm.RESEARCH_PLANNER_SYSTEM_PROMPT);
                assert.deepEqual(JSON.parse(body.messages[1].content), input);
                return geminiResponse();
            };
            assert.deepEqual(await llm.generateResearchPlan(input), expectedPlan);
            assert.equal(calls, 1);
        });

        await t.test("Configured model is preserved; empty model uses default", async () => {
            for (const [configured, expected] of [["custom-model", "custom-model"], [" ", "gemini-2.5-flash"]]) {
                process.env.GEMINI_MODEL = configured;
                global.fetch = async (url, options) => {
                    assert.equal(JSON.parse(options.body).model, expected);
                    return geminiResponse();
                };
                await llm.generateResearchPlan(input);
            }
            delete process.env.GEMINI_MODEL;
        });

        await t.test("Plain and fenced JSON parse to unchanged public object schema", async () => {
            for (const content of [JSON.stringify(rawPlan), `  \n\`\`\`json\n${JSON.stringify(rawPlan)}\n\`\`\`\n `,
                `\`\`\`\n${JSON.stringify(rawPlan)}\n\`\`\``]) {
                global.fetch = async () => geminiResponse(content);
                assert.deepEqual(await llm.generateResearchPlan(input), expectedPlan);
            }
        });

        await t.test("Invalid JSON/schema, empty strings and non-four counts fail safely", async () => {
            for (const content of ["{broken", "", null, "null", "[]", "Explanation: " + JSON.stringify(rawPlan),
                JSON.stringify({ ...rawPlan, researchQuestions: ["Only one"] }),
                JSON.stringify({ ...rawPlan, searchQueries: ["One", "Two", "Three", "Four", "Five"] }),
                JSON.stringify({ ...rawPlan, researchQuestions: ["One", "Two", " ", "Four"] }),
                JSON.stringify({ ...rawPlan, searchQueries: ["One", "Two", 3, "Four"] }),
                JSON.stringify(expectedPlan)]) {
                global.fetch = async () => geminiResponse(content);
                await assert.rejects(llm.generateResearchPlan(input), { message: "Gemini returned invalid planner output" });
            }
            global.fetch = async () => geminiResponse(JSON.stringify(rawPlan), "length");
            await assert.rejects(llm.generateResearchPlan(input), { message: "Gemini returned invalid planner output" });
            global.fetch = async () => new Response("invalid response body");
            await assert.rejects(llm.generateResearchPlan(input), { message: "Gemini returned invalid planner output" });
        });

        await t.test("Missing key and unsupported provider fail before fetch", async () => {
            global.fetch = async () => { assert.fail("Configuration error must not call network"); };
            process.env.GEMINI_API_KEY = " ";
            await assert.rejects(llm.generateResearchPlan(input), { message: "GEMINI_API_KEY is not configured" });
            process.env.GEMINI_API_KEY = "test-placeholder";
            process.env.LLM_PROVIDER = "openai";
            await assert.rejects(llm.generateResearchPlan(input), /Unsupported LLM_PROVIDER/);
            process.env.LLM_PROVIDER = "gemini";
        });

        await t.test("401/403/404/429/500 errors are mapped without exposing provider body", async () => {
            for (const [status, message] of [
                [401, "Gemini API authentication failed"], [403, "Gemini API authentication failed"],
                [404, "Gemini model not found"], [429, "Gemini API quota or rate limit exceeded"],
                [500, "Gemini API request failed (HTTP 500)"]
            ]) {
                global.fetch = async () => new Response("provider-debug-data-not-for-users", { status });
                await assert.rejects(llm.generateResearchPlan(input), { message });
            }
        });

        await t.test("Timeout, connection failure and response read timeout return safe network errors", async () => {
            for (const failure of [new TypeError("provider-internal-details"), new DOMException("debug-timeout", "TimeoutError")]) {
                global.fetch = async () => { throw failure; };
                await assert.rejects(llm.generateResearchPlan(input), { message: "Gemini API network request failed or timed out" });
            }
            global.fetch = async () => ({ ok: true, json: async () => { throw new DOMException("debug-timeout", "TimeoutError"); } });
            await assert.rejects(llm.generateResearchPlan(input), { message: "Gemini API network request failed or timed out" });
        });
    } finally { global.fetch = previousFetch; process.env = previousEnv; }
});

test("Gemini Workflow 1 HTTP contract, SQLite status and Workflow 2 compatibility", async () => {
    const previousEnv = { ...process.env };
    const networkFetch = global.fetch;
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gemini-planner-"));
    process.env.RESEARCH_DB_PATH = path.join(directory, "research.db");
    process.env.MOCK_LLM = "false";
    process.env.LLM_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-placeholder";
    process.env.MOCK_SEARCH = "true";
    const { app } = require("../src/server");
    const database = require("../src/config/database");
    await database.initializeDatabase();
    const server = await new Promise(resolve => {
        const instance = app.listen(0, "127.0.0.1");
        instance.once('listening', () => resolve(instance));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    async function postResearch() {
        return networkFetch(`${base}/api/research`, { method: "POST",
            headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    }
    try {
        global.fetch = async url => {
            assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
            return geminiResponse();
        };
        const response = await postResearch();
        assert.equal(response.status, 201);
        const { success, data } = await response.json();
        assert.equal(success, true);
        assert.deepEqual(Object.keys(data).sort(), ["requestId", "topic", "status", "researchQuestions", "searchQueries"].sort());
        assert.equal(data.status, "planned");
        assert.deepEqual(data.researchQuestions, expectedPlan.researchQuestions);
        assert.deepEqual(data.searchQueries, expectedPlan.searchQueries);
        const saved = await networkFetch(`${base}/api/research/${data.requestId}`);
        const read = (await saved.json()).data;
        assert.equal(read.request.status, "planned");
        assert.equal(read.request.goal, input.goal);
        assert.deepEqual(read.researchQuestions, expectedPlan.researchQuestions);
        assert.deepEqual(read.searchQueries, expectedPlan.searchQueries);
        const search = await networkFetch(`${base}/api/research/${data.requestId}/search`, { method: "POST" });
        assert.equal(search.status, 200);
        const collection = (await search.json()).data;
        assert.equal(collection.status, "collected");
        assert.equal(collection.queryCount, 4);
        assert.equal(collection.sourceCount, 8);

        for (const [mockResponse, expectedError] of [
            [async () => new Response("private-provider-details", { status: 429 }), "Gemini API quota or rate limit exceeded"],
            [async () => geminiResponse("invalid JSON"), "Gemini returned invalid planner output"],
            [async () => { throw new TypeError("private-connection-details"); }, "Gemini API network request failed or timed out"]
        ]) {
            global.fetch = mockResponse;
            const failed = await postResearch();
            assert.equal(failed.status, 502);
            const error = await failed.json();
            assert.equal(error.error, expectedError);
            const row = await database.get("SELECT status FROM requests WHERE id = ?", [error.requestId]);
            assert.equal(row.status, "failed");
            const plans = await database.all("SELECT * FROM plans WHERE request_id = ?", [error.requestId]);
            assert.equal(plans.length, 0);
        }
    } finally {
        global.fetch = networkFetch;
        process.env = previousEnv;
        await new Promise(resolve => server.close(resolve));
        await fs.rm(directory, { recursive: true, force: true });
    }
});
