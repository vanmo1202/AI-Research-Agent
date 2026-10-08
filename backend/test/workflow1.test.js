const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

// Khởi động process thật trên port ngẫu nhiên, dùng database tạm riêng.
async function boot(databasePath, mock = 'true') {
    const child = spawn(process.execPath, ['-e', `
        const { start } = require('./src/server');
        start().then(server => console.log('TEST_PORT=' + server.address().port));
    `], {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, PORT: '0', MOCK_LLM: mock,
            OPENAI_API_KEY: '', OPENAI_MODEL: '', RESEARCH_DB_PATH: databasePath },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    const port = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { child.kill(); reject(new Error('Server startup timed out')); }, 10000);
        child.stdout.on('data', chunk => {
            output += chunk;
            const match = output.match(/TEST_PORT=(\d+)/);
            if (match) { clearTimeout(timer); resolve(match[1]); }
        });
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
    });
    return {
        base: `http://127.0.0.1:${port}`,
        async stop() {
            if (child.exitCode !== null) return;
            await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
        }
    };
}

const input = { topic: 'Ứng dụng AI trong quản lý tồn kho siêu thị',
    goal: 'Tìm hiểu ứng dụng, dữ liệu cần có, lợi ích và hạn chế',
    scope: 'Tài liệu web công khai', outputLength: 'medium' };
async function post(base, body) {
    return fetch(`${base}/api/research`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
}

test('Workflow 1: HTTP API, validation, SQLite persistence and failed planner', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'research-test-'));
    const databasePath = path.join(directory, 'research.db');
    let server;
    try {
        server = await boot(databasePath);
        const health = await fetch(`${server.base}/health`);
        assert.equal(health.status, 200);
        assert.deepEqual(await health.json(), { status: 'ok', message: 'AI Research Agent Backend is running' });
        const response = await post(server.base, input);
        assert.equal(response.status, 201);
        const { data } = await response.json();
        assert.match(data.requestId, /^[0-9a-f-]{36}$/);
        assert.equal(data.status, 'planned');
        assert.equal(data.researchQuestions.length, 4);
        for (const q of data.researchQuestions) assert.ok(data.searchQueries.some(query => query.questionId === q.id));
        const readPlan = async () => {
            const response = await fetch(`${server.base}/api/research/${data.requestId}`);
            assert.equal(response.status, 200);
            const saved = (await response.json()).data;
            assert.equal(saved.request.topic, input.topic);
            assert.equal(saved.request.goal, input.goal);
            assert.equal(saved.request.status, 'planned');
            assert.deepEqual(saved.researchQuestions, data.researchQuestions);
            assert.deepEqual(saved.searchQueries, data.searchQueries);
        };
        await readPlan();
        for (const invalid of [{ goal: 'Test' }, { ...input, outputLength: 'abc' },
            { ...input, topic: ' ' }, { ...input, goal: 1 }, { ...input, scope: null }, [], null]) {
            const response = await post(server.base, invalid);
            assert.equal(response.status, 400);
            assert.equal((await response.json()).success, false);
        }
        const missing = await fetch(`${server.base}/api/research/missing`);
        assert.equal(missing.status, 404);
        assert.deepEqual(await missing.json(), { success: false, error: 'Research request not found' });
        const malformed = await fetch(`${server.base}/api/research`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{'
        });
        assert.equal(malformed.status, 400);
        for (const length of ['short', 'long']) {
            const response = await post(server.base, { ...input, outputLength: length });
            assert.equal(response.status, 201);
            assert.equal((await response.json()).data.researchQuestions.length, length === 'short' ? 3 : 5);
        }
        await server.stop();
        server = await boot(databasePath);
        await readPlan(); // Process mới vẫn đọc đúng plan đã lưu.
        await server.stop();
        server = await boot(databasePath, 'false');
        const failed = await post(server.base, input);
        assert.equal(failed.status, 502);
        const failure = await failed.json();
        const lookup = await fetch(`${server.base}/api/research/${failure.requestId}`);
        assert.equal((await lookup.json()).data.request.status, 'failed');
        assert.equal((await fetch(`${server.base}/health`)).status, 200);
    } finally {
        if (server) await server.stop();
        await fs.rm(directory, { recursive: true, force: true });
    }
});

test('Planner: mock never calls fetch; real branch and malformed LLM output', async () => {
    const llm = require('../src/services/llm.service');
    const originalFetch = global.fetch;
    const originalEnv = { ...process.env };
    try {
        process.env.MOCK_LLM = 'true';
        delete process.env.OPENAI_API_KEY;
        global.fetch = async () => { throw new Error('Mock must never call network'); };
        const plan = await llm.generateResearchPlan(input);
        assert.equal(plan.researchQuestions.length, 4);
        process.env.MOCK_LLM = 'false';
        process.env.OPENAI_API_KEY = 'test-placeholder';
        process.env.OPENAI_MODEL = 'test-model';
        global.fetch = async (url, options) => {
            assert.equal(url, 'https://api.openai.com/v1/chat/completions');
            const body = JSON.parse(options.body);
            assert.equal(body.model, 'test-model');
            assert.equal(body.response_format.type, 'json_object');
            return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(plan) } }] }) };
        };
        assert.deepEqual(await llm.generateResearchPlan(input), plan);
        global.fetch = async () => ({ ok: false, status: 429 });
        await assert.rejects(llm.generateResearchPlan(input), /OpenAI HTTP 429/);
        assert.throws(() => llm.validatePlan({ ...plan, searchQueries: [] }), /invalid/);
        assert.throws(() => llm.validatePlan({ ...plan,
            searchQueries: [{ questionId: 'Q99', query: 'test' }] }), /invalid/);
    } finally {
        global.fetch = originalFetch;
        process.env = originalEnv;
    }
});
