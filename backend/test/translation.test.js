const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.RESEARCH_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'translation-test-')), 'test.db');
process.env.MOCK_LLM = 'true';
process.env.MOCK_SEARCH = 'true';
process.env.HTTP_RETRY_COUNT = '0';
process.env.GEMINI_TRANSLATION_RETRY_COUNT = '0';
process.env.TRANSLATE_SOURCE_CONCURRENCY = '1';
process.env.GEMINI_MIN_INTERVAL_MS = '0';
const db = require('../src/config/database');
const llm = require('../src/services/llm.service');
const translation = require('../src/services/translation.service');
const model = require('../src/models/source.model');
const research = require('../src/services/research.service');
const chunks = require('../src/services/chunk.service');

test('Translation: migration, validation, preservation, API, fallback and RAG', async t => {
    const savedEnv = { ...process.env };
    const generate = llm.generateJson;
    const fetch = global.fetch;
    const searchService = require('../src/services/search.service');
    const savedSearch = searchService.searchWeb;
    searchService.searchWeb = async (...args) => (await savedSearch(...args)).map((source, index) => ({ ...source,
        title: `Original English title ${index}`, snippet: 'This is the original English snippet',
        content: 'The source content is an original English article for the research and it has the information.' }));
    // Simulate an existing database before translated columns were introduced.
    await db.run(`CREATE TABLE sources (id TEXT PRIMARY KEY, request_id TEXT NOT NULL, query TEXT NOT NULL,
      title TEXT, url TEXT NOT NULL, normalized_url TEXT NOT NULL, snippet TEXT, content TEXT,
      provider TEXT, collected_at TEXT NOT NULL, UNIQUE(request_id, normalized_url))`);
    await db.run("INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ['legacy', 'legacy-request', 'query', 'Legacy title', 'https://example.com/legacy', 'https://example.com/legacy', 'Legacy snippet', 'Legacy content', 'tavily', new Date().toISOString()]);
    await db.initializeDatabase();
    await db.initializeDatabase();
    const legacy = (await model.getSourcesByRequestId('legacy-request'))[0];
    assert.equal(legacy.title, 'Legacy title');
    assert.equal(legacy.content, 'Legacy content');
    assert.equal(legacy.titleVi, null);
    const { app } = require('../src/server');
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const original = { title: 'Original title', snippet: 'Original snippet', content: 'Original full text' };
    const translated = { titleVi: 'Tiêu đề tiếng Việt', snippetVi: 'Tóm tắt tiếng Việt', contentVi: 'Nội dung tiếng Việt' };
    try {
        global.fetch = () => { throw new Error('Real network forbidden'); };
        await t.test('Mock mode and disabled translation never call Gemini', async () => {
            llm.generateJson = () => { throw new Error('Gemini forbidden'); };
            assert.equal((await translation.translateSourceToVietnamese(original)).titleVi, null);
            process.env.MOCK_LLM = 'false'; process.env.TRANSLATE_SOURCE_CONTENT = 'false';
            assert.equal((await translation.translateSourceToVietnamese(original)).titleVi, null);
        });
        process.env.TRANSLATE_SOURCE_CONTENT = 'true';
        await t.test('Success bounds input and preserves originals', async () => {
            process.env.TRANSLATE_MAX_CONTENT_CHARS = '12';
            llm.generateJson = async (prompt, input) => { assert.match(prompt, /Do not add facts/); if (input.text) { assert.equal(input.text.length, 12); return { translatedText: translated.contentVi }; } assert.equal(input.content, undefined); return translated; };
            const result = await translation.translateSourceToVietnamese(original);
            for (const key of Object.keys(translated)) assert.equal(result[key], translated[key]);
            assert.equal(original.content, 'Original full text');
        });
        await t.test('Invalid schema, JSON, provider failure and modified URLs fall back independently', async () => {
            for (const value of [null, [], {}, { translatedText: '' }]) {
                llm.generateJson = async () => value;
                await assert.rejects(translation.translateChunk(original.content));
                assert.deepEqual(await translation.translateMetadata(original), { titleVi: null, snippetVi: null });
            }
            llm.generateJson = async () => { throw new SyntaxError('Invalid JSON'); };
            await assert.rejects(translation.translateChunk(original.content), /Invalid JSON/);
            llm.generateJson = async () => { throw new Error('Gemini unavailable'); };
            await assert.rejects(translation.translateChunk(original.content), /Gemini unavailable/);
            process.env.TRANSLATE_MAX_CONTENT_CHARS = '12000';
            llm.generateJson = async () => ({ translatedText: translated.contentVi });
            await assert.rejects(translation.translateChunk('See https://example.com'), /URLs/);
            const result = await translation.translateSourceToVietnamese(original);
            assert.equal(result.titleVi, null);
            assert.equal(result.contentVi, translated.contentVi);
        });
        process.env.MOCK_LLM = 'true';
        const request = await research.createResearchRequest({ topic: 'AI research', goal: 'Benefits' });
        process.env.MOCK_LLM = 'false';
        await t.test('Workflow persists translations, API returns both versions, rerun reuses cache', async () => {
            let calls = 0; let active = 0; let peak = 0;
            llm.generateJson = async (prompt, input) => {
                calls++; active++; peak = Math.max(peak, active);
                await new Promise(resolve => setImmediate(resolve));
                active--;
                return input.text ? { translatedText: translated.contentVi } : translated;
            };
            const result = await research.searchAndCollect(request.requestId);
            assert.ok(calls > 0);
            assert.equal(peak, 1);
            const source = result.sources[0];
            assert.ok(source.title); assert.notEqual(source.title, source.titleVi);
            assert.deepEqual(Object.fromEntries(Object.keys(translated).map(key => [key, source[key]])), translated);
            const response = await fetch(base + `/api/research/${request.requestId}/sources`);
            assert.equal(response.status, 200);
            assert.deepEqual((await response.json()).data.sources, result.sources);
            const count = calls;
            await research.searchAndCollect(request.requestId);
            assert.equal(calls, count);
            assert.equal(chunks.createChunks(request.requestId, source)[0].content, translated.contentVi);
            process.env.MOCK_RAG = 'true'; process.env.MOCK_REPORT = 'true';
            process.env.RAG_MIN_RELEVANCE_SCORE = '0';
            const evidenceService = require('../src/services/evidence.service');
            const reportService = require('../src/services/report.service');
            await evidenceService.analyze(request.requestId);
            const evidence = await evidenceService.getEvidence(request.requestId);
            assert.ok(evidence.length);
            for (const item of evidence) {
                const chunk = await db.get('SELECT * FROM chunks WHERE id = ?', [item.chunkId]);
                assert.equal(chunk.source_id, item.sourceId);
                assert.equal(item.evidenceText, translated.contentVi);
            }
            const report = await reportService.generate(request.requestId, {});
            assert.ok(report.references.length);
            for (const reference of report.references) {
                assert.equal(reference.title, translated.titleVi);
                assert.ok(result.sources.some(item => item.url === reference.url && item.provider === reference.provider));
            }

        });
        await t.test('Changed originals invalidate cache while source IDs and URLs stay stable', async () => {
            const search = require('../src/services/search.service');
            const originalSearch = search.searchWeb;
            const before = await model.getSourcesByRequestId(request.requestId);
            let calls = 0;
            llm.generateJson = async (prompt, input) => {
                calls++;
                return input.text ? { translatedText: translated.contentVi } : translated;
            };
            search.searchWeb = async (...args) => (await originalSearch(...args)).map(source => ({ ...source, content: source.content + ' Updated source text.' }));
            try {
                const result = await research.searchAndCollect(request.requestId);
                assert.ok(calls > 0);
                for (const source of result.sources) {
                    const old = before.find(item => item.url === source.url);
                    assert.equal(source.id, old.id);
                    assert.equal(source.url, old.url);
                    assert.equal(source.content, old.content + ' Updated source text.');
                }
            } finally { search.searchWeb = originalSearch; }
        });
        await t.test('Failed translation preserves source and original RAG fallback', async () => {
            process.env.MOCK_LLM = 'true';
            const second = await research.createResearchRequest({ topic: 'Fallback research', goal: 'Original text' });
            process.env.MOCK_LLM = 'false';
            llm.generateJson = async () => { throw new Error('Gemini failure'); };
            const result = await research.searchAndCollect(second.requestId);
            assert.equal(result.status, 'collected');
            const sources = await model.getSourcesByRequestId(second.requestId);
            assert.ok(sources.length);
            for (const source of sources) {
                assert.equal(source.titleVi, null); assert.match(source.contentVi, /Một phần nội dung chưa thể dịch/);
                assert.ok(source.content);
                assert.equal(chunks.createChunks(second.requestId, source).length, 0);
            }
        });
    } finally {
        searchService.searchWeb = savedSearch; llm.generateJson = generate; global.fetch = fetch; process.env = savedEnv;
        await new Promise(resolve => server.close(resolve));
    }
});
