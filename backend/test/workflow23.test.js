const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.RESEARCH_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'workflow23-')), 'db.sqlite');
Object.assign(process.env, { MOCK_LLM: 'true', MOCK_SEARCH: 'true', GEMINI_MIN_INTERVAL_MS: '0',
    GEMINI_API_KEY: 'test-placeholder', GEMINI_EVIDENCE_RETRY_COUNT: '1', GEMINI_EVIDENCE_RETRY_BASE_DELAY_MS: '1',
    GEMINI_TRANSLATION_RETRY_COUNT: '0', RAG_MIN_RELEVANCE_SCORE: '0', RAG_TOP_K: '4', RAG_MAX_CONTEXT_CHARS: '10000',
    RAG_ANALYSIS_CONCURRENCY: '1', TRANSLATE_SOURCE_CONCURRENCY: '2', CONTENT_FETCH_CONCURRENCY: '2' });
const db = require('../src/config/database');
const research = require('../src/services/research.service');
const sources = require('../src/models/source.model');
const search = require('../src/services/search.service');
const content = require('../src/services/content.service');
const translation = require('../src/services/translation.service');
const evidence = require('../src/services/evidence.service');
const llm = require('../src/services/llm.service');
const { detectSourceLanguage } = require('../src/utils/language');
const { createGeminiLimiter } = require('../src/utils/geminiLimiter');
const { retryAfterMilliseconds } = require('../src/utils/geminiError');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const response = value => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }), { headers: { 'content-type': 'application/json' } });
const vi = { title: 'Nguồn nghiên cứu tiếng Việt', snippet: 'Các bằng chứng về ứng dụng trí tuệ nhân tạo', content: 'Nội dung nghiên cứu bằng tiếng Việt về lợi ích và hạn chế của hệ thống hỏi đáp tài liệu.' };
const en = { title: 'The original English source', snippet: 'This is the source article in English', content: 'The content is an original English article and it has the source information for the research.' };

async function createReady() {
    process.env.MOCK_LLM = 'true';
    const request = await research.createResearchRequest({ topic: 'Hệ thống hỏi đáp tài liệu', goal: 'Lợi ích và hạn chế' });
    await sources.createSources(request.requestId, Array.from({ length: 5 }, (_, i) => ({
        ...vi, id: 'unused', url: `https://example.com/${i}`, normalizedUrl: `https://example.com/${i}`, query: 'nghiên cứu',
        content: en.content, contentVi: (vi.content + ` Phân tích nhóm ${i} cung cấp bằng chứng số ${i}. `).repeat(35),
        titleVi: vi.title, snippetVi: vi.snippet, sourceLanguage: 'en', translationStatus: 'complete',
        provider: 'tavily', collectedAt: new Date().toISOString()
    })));
    process.env.MOCK_LLM = 'false'; process.env.MOCK_RAG = 'false';
    return request;
}
function goodEvidence(context) {
    const chunk = context.chunks[0];
    return { evidence: [{ chunkId: chunk.chunkId, sourceId: chunk.sourceId,
        evidenceText: 'Bằng chứng tiếng Việt cho thấy hệ thống hỗ trợ hỏi đáp tài liệu.', reason: 'Nội dung liên quan đến câu hỏi nghiên cứu.' }] };
}

test('Workflow 2/3: language, performance, display policy, rate limits, cache and partial recovery', async t => {
    const saved = { fetch: global.fetch, generate: llm.generateJson, search: search.searchWeb, fetchPage: content.fetchPageContent, env: { ...process.env } };
    global.fetch = () => { throw new Error('No real network in automated tests'); };
    await db.initializeDatabase();
    try {
        await t.test('Local vi/en/unknown detection and Vietnamese bypass with zero Gemini calls', async () => {
            assert.equal(detectSourceLanguage(vi), 'vi');
            assert.equal(detectSourceLanguage(en), 'en');
            assert.equal(detectSourceLanguage({ content: 'RAG API Docker Kubernetes' }), 'unknown');
            llm.generateJson = () => assert.fail('Vietnamese source must not call Gemini');
            process.env.MOCK_LLM = 'false';
            const result = await translation.translateSourceToVietnamese(vi);
            assert.equal(result.titleVi, vi.title); assert.equal(result.contentVi, vi.content);
            assert.equal(result.translationCalls, 0); assert.equal(result.translationStatus, 'not_required');
            process.env.TRANSLATE_MAX_CONTENT_CHARS = '20';
            assert.notEqual(translation.translationHash(vi), translation.translationHash({ ...vi, content: vi.content + ' Thông tin mới.' }));
            process.env.TRANSLATE_MAX_CONTENT_CHARS = '12000';
        });
        await t.test('Dedupe before fetch, separate bounded concurrency, original persistence and hash cache', async () => {
            process.env.MOCK_LLM = 'true';
            const request = await research.createResearchRequest({ topic: 'Kiểm tra nguồn tài liệu', goal: 'Hiệu năng' });
            process.env.MOCK_LLM = 'false';
            let fetched = 0; let fetching = 0; let peakFetch = 0; let translating = 0; let peakTranslate = 0; let calls = 0;
            search.searchWeb = async () => [
                { ...vi, content: '', url: 'https://example.com/vi', provider: 'tavily' },
                ...[1, 2, 3].map(i => ({ ...en, content: '', url: `https://example.com/en${i}`, provider: 'tavily' }))
            ];
            content.fetchPageContent = async url => {
                fetched++; fetching++; peakFetch = Math.max(peakFetch, fetching); await wait(3); fetching--;
                return url.endsWith('/vi') ? vi.content : en.content;
            };
            llm.generateJson = async (prompt, input) => {
                calls++; translating++; peakTranslate = Math.max(peakTranslate, translating); await wait(3); translating--;
                return input.text ? { translatedText: vi.content } : { titleVi: vi.title, snippetVi: vi.snippet };
            };
            const result = await research.searchAndCollect(request.requestId);
            assert.equal(result.status, 'collected'); assert.equal(result.sourceCount, 4); assert.equal(fetched, 4);
            assert.equal(peakFetch, 2); assert.equal(peakTranslate, 2);
            assert.equal(calls, 6); assert.equal(result.metrics.viSources, 1); assert.equal(result.metrics.enSources, 3);
            const original = result.sources.find(item => item.sourceLanguage === 'en');
            assert.equal(original.content, en.content); assert.equal(original.displayContent, vi.content);
            const before = calls;
            const cached = await research.searchAndCollect(request.requestId);
            assert.equal(calls, before); assert.equal(cached.metrics.cacheHits, 4);
            assert.deepEqual(cached.sources.map(item => item.id), result.sources.map(item => item.id));
            // Legacy translations cannot expose old mixed English fallback content.
            await db.run('UPDATE sources SET translation_status = NULL, translation_hash = NULL WHERE id = ?', [original.id]);
            const legacy = (await sources.getSourcesByRequestId(request.requestId)).find(item => item.id === original.id);
            assert.equal(legacy.displayContent, null); assert.equal(legacy.content, en.content);
            search.searchWeb = saved.search; content.fetchPageContent = saved.fetchPage; llm.generateJson = saved.generate;
        });
        await t.test('English partial failure never places an English chunk in Vietnamese fields', async () => {
            llm.generateJson = async (prompt, input) => {
                if (input.text) throw new Error('Translation unavailable');
                return { titleVi: vi.title, snippetVi: vi.snippet };
            };
            const result = await translation.translateSourceToVietnamese(en);
            assert.equal(result.translationStatus, 'partial'); assert.ok(!result.contentVi.includes(en.content));
            assert.equal(result.contentVi, translation.PARTIAL_MESSAGE);
            const chunks = require('../src/services/chunk.service').createChunks('test', { id: 'source', sourceLanguage: 'en', translationStatus: 'partial', contentVi: vi.content + '\n\n' + translation.PARTIAL_MESSAGE });
            assert.ok(chunks.length); assert.ok(chunks.every(chunk => !chunk.content.includes(translation.PARTIAL_MESSAGE))); assert.equal(en.content, 'The content is an original English article and it has the source information for the research.');
            llm.generateJson = saved.generate;
        });
        await t.test('Global limiter holds complete response body and bounds starts across callers', async () => {
            process.env.GEMINI_MAX_CONCURRENT_REQUESTS = '2'; process.env.GEMINI_MIN_INTERVAL_MS = '5';
            let active = 0; let peak = 0; const starts = [];
            global.fetch = async () => {
                active++; peak = Math.max(peak, active); starts.push(Date.now());
                return { ok: true, json: async () => { await wait(20); active--; return { choices: [{ message: { content: '{"ok":true}' } }] }; } };
            };
            await Promise.all(Array.from({ length: 6 }, (_, i) => llm.generateJson('Test', { purpose: ['translation', 'evidence', 'report'][i % 3] })));
            assert.equal(peak, 2); assert.ok(starts.slice(1).every((start, i) => start - starts[i] >= 4));
            process.env.GEMINI_MIN_INTERVAL_MS = '0';
            const limit = createGeminiLimiter({ maxConcurrent: 1, minIntervalMs: 0 });
            const settled = await Promise.allSettled([limit(() => Promise.reject(new Error('Expected'))), limit(() => 'next')]);
            assert.equal(settled[1].value, 'next');
        });
        let request; let normal;
        await t.test('One bounded context per question, valid mapping, Vietnamese evidence and persistent cache', async () => {
            request = await createReady(); let calls = 0;
            global.fetch = async (url, options) => {
                calls++;
                const context = JSON.parse(JSON.parse(options.body).messages[1].content);
                assert.ok(context.chunks.length > 0 && context.chunks.length <= 4);
                assert.ok(JSON.stringify(context).length <= 10000);
                return response(goodEvidence(context));
            };
            normal = await evidence.analyze(request.requestId);
            assert.equal(normal.status, 'analyzed'); assert.equal(calls, request.researchQuestions.length);
            assert.equal(normal.metrics.geminiCalls, calls);
            const items = await evidence.getEvidence(request.requestId);
            assert.equal(items.length, calls);
            for (const item of items) {
                assert.equal(detectSourceLanguage({ content: item.evidenceText }), 'vi');
                const chunk = await db.get('SELECT * FROM chunks WHERE id = ?', [item.chunkId]);
                assert.equal(chunk.source_id, item.sourceId);
                const source = (await sources.getSourcesByRequestId(request.requestId)).find(s => s.id === item.sourceId);
                assert.ok(source.url.startsWith('https://example.com/'));
            }
            const cached = await evidence.analyze(request.requestId);
            assert.equal(cached.metrics.geminiCalls, 0); assert.equal(cached.metrics.cacheHits, calls);
            assert.equal((await evidence.getEvidence(request.requestId)).length, items.length);
        });
        await t.test('429 retries honor Retry-After and preserve earlier successful evidence on partial result', async () => {
            const question = request.researchQuestions[1];
            await db.run('DELETE FROM evidence_cache WHERE request_id = ? AND question_id = ?', [request.requestId, question.id]);
            const before = await evidence.getEvidence(request.requestId);
            let calls = 0; const starts = [];
            global.fetch = async () => { calls++; starts.push(Date.now()); return new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'Rate limited' } }), { status: 429, headers: { 'Retry-After': '0.012' } }); };
            const partial = await evidence.analyze(request.requestId);
            assert.equal(partial.status, 'analyzed_partial'); assert.equal(calls, 2);
            assert.ok(starts[1] - starts[0] >= 10); assert.equal(partial.metrics.rateLimitRetries, 1);
            assert.equal(partial.questions[1].error.code, 'GEMINI_RATE_LIMITED');
            assert.deepEqual(await evidence.getEvidence(request.requestId), before);
            assert.equal((await evidence.getAnalysis(request.requestId)).partial, true);
            assert.equal(retryAfterMilliseconds('2'), 2000);
            const date = Date.now(); assert.ok(retryAfterMilliseconds(new Date(date + 5000).toUTCString(), date) >= 4000);
        });
        await t.test('Daily quota exhausted stops early and returns structured partial state', async () => {
            const fresh = await createReady(); let calls = 0;
            global.fetch = async () => { calls++; return new Response(JSON.stringify({ error: { details: [{ quotaMetric: 'requests_per_day', quotaValue: '0' }] } }), { status: 429 }); };
            const result = await evidence.analyze(fresh.requestId);
            assert.equal(calls, 1); assert.equal(result.status, 'analyzed_partial');
            assert.ok(result.questions.every(q => q.error.code === 'GEMINI_QUOTA_EXHAUSTED'));
        });
        await t.test('403 never retries; wrong source/chunk mapping cannot become evidence', async () => {
            const fresh = await createReady(); let calls = 0;
            global.fetch = async () => { calls++; return new Response('{}', { status: 403 }); };
            const result = await evidence.analyze(fresh.requestId);
            assert.equal(calls, fresh.researchQuestions.length); assert.equal(result.evidenceCount, 0);
            global.fetch = async (url, options) => {
                const context = JSON.parse(JSON.parse(options.body).messages[1].content); const value = goodEvidence(context);
                value.evidence[0].sourceId = 'fabricated'; return response(value);
            };
            const invalid = await evidence.analyze(fresh.requestId);
            assert.equal(invalid.evidenceCount, 0); assert.equal(invalid.status, 'analyzed_partial');
        });
    } finally {
        global.fetch = saved.fetch; llm.generateJson = saved.generate; search.searchWeb = saved.search;
        content.fetchPageContent = saved.fetchPage; process.env = saved.env;
    }
});
