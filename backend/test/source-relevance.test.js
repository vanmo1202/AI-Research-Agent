const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.RESEARCH_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'source-relevance-')), 'test.sqlite');
Object.assign(process.env, { MOCK_LLM: 'true', MOCK_SEARCH: 'false', MOCK_RAG: 'true', MOCK_REPORT: 'true',
    TAVILY_API_KEY: 'synthetic-no-real-key', HTTP_RETRY_COUNT: '0' });
const db = require('../src/config/database');
const research = require('../src/services/research.service');
const sourceModel = require('../src/models/source.model');
const physics = { topic: 'Dao động điều hòa của con lắc lò xo', goal: 'Tìm hiểu lý thuyết và bài tập vật lý từ cơ bản đến nâng cao', scope: 'Con lắc lò xo' };
const finance = [
    { title: 'Chứng khoán dao động mạnh', url: 'https://example.com/stocks', content: 'Thị trường chứng khoán có biến động. Nhà đầu tư theo dõi cổ phiếu và chỉ số thị trường.', raw_content: 'Thị trường chứng khoán có biến động. Nhà đầu tư theo dõi cổ phiếu và chỉ số thị trường.' },
    { title: 'Giá dầu WTI biến động', url: 'https://example.com/wti', content: 'Giá dầu WTI và hợp đồng tương lai tăng giảm trên thị trường năng lượng.', raw_content: 'Giá dầu WTI và hợp đồng tương lai tăng giảm trên thị trường năng lượng.' },
    { title: 'EUR/USD oscillations and market analysis', url: 'https://example.com/eur-usd', content: 'Forex traders study currency oscillations, volatility and price trends.', raw_content: 'Forex traders study currency oscillations, volatility and price trends.' }
];
test('Regression: physics research must not persist Tavily market results', async t => {
    await db.initializeDatabase();
    t.mock.method(global, 'fetch', async url => {
        assert.equal(url, 'https://api.tavily.com/search');
        return new Response(JSON.stringify({ results: finance }), { headers: { 'Content-Type': 'application/json' } });
    });
    const request = await research.createResearchRequest(physics);
    await assert.rejects(research.searchAndCollect(request.requestId), /Không tìm thấy nguồn phù hợp/);
    assert.equal((await sourceModel.getSourcesByRequestId(request.requestId)).length, 0);
});
const relevance = require('../src/services/source-relevance.service');
const validPhysics = {
    title: 'Con lắc lò xo và dao động điều hòa', url: 'https://example.com/physics',
    snippet: 'Lý thuyết, phương trình và bài tập con lắc lò xo.',
    content: 'Con lắc lò xo dao động điều hòa. Lực đàn hồi tuân theo định luật Hooke. Bài tập vật lý về chu kỳ, tần số và năng lượng của con lắc lò xo.'
};
test('Concept gate handles Vietnamese accents, English, physics foundations and title/body disagreement', () => {
    for (const content of [validPhysics.content, relevance.fold(validPhysics.content),
        'A mass-spring system exhibits simple harmonic motion. Hooke\'s law determines restoring force, period and mechanical energy.',
        'Mechanical oscillations of a spring oscillator illustrate harmonic motion and energy conservation.']) {
        assert.equal(relevance.evaluateSource(physics, { content }).accepted, true, content);
    }
    for (const result of finance) {
        const source = { ...result, content: result.raw_content, query: physics.topic };
        assert.equal(relevance.evaluateSource(physics, source).accepted, false, result.title);
        assert.equal(relevance.evaluateSource(physics, { ...source, title: physics.topic, snippet: physics.topic }).accepted, false, 'A correct title cannot launder a wrong body');
    }
    assert.equal(relevance.evaluateSource(physics, { ...validPhysics, content: 'F = -kx; T = 2π√(m/k)' }).accepted, true, 'Do not discard short formula pages with on-topic metadata');
    assert.equal(relevance.evaluateSource(physics, { title: 'A rigorous derivation using energy conservation and differential equations' }, { phase: 'metadata' }).accepted, true, 'Ambiguous metadata must reach content inspection');
    const chunkScore = require('../src/services/relevance.service').scoreChunk;
    assert.equal(chunkScore('nghiên cứu lý thuyết và phân tích', 'Bài nghiên cứu phân tích thị trường chứng khoán'), 0);
    assert.ok(chunkScore(physics.topic, 'Simple harmonic motion of a mass spring system') > 0);
});
test('Gate is domain-independent across technology, education, history and economics', () => {
    const cases = [
        [{ topic: 'Ứng dụng trí tuệ nhân tạo trong giáo dục đại học', goal: 'Đánh giá dạy học' }, 'Artificial intelligence supports university teaching and student assessment.'],
        [{ topic: 'Cách mạng Pháp', goal: 'Tìm hiểu lịch sử và nguyên nhân' }, 'The French Revolution transformed political institutions and social order.'],
        [{ topic: 'Chính sách tiền tệ và lạm phát', goal: 'Tác động kinh tế' }, 'Monetary policy affects inflation through interest rates and credit.'],
        [{ topic: 'Giá dầu WTI', goal: 'Phân tích thị trường năng lượng' }, finance[1].raw_content],
        [{ topic: 'Thị trường chứng khoán', goal: 'Phân tích cổ phiếu' }, finance[0].raw_content],
        [{ topic: 'SQLite WAL concurrency', goal: 'Database engineering' }, 'SQLite WAL concurrency allows committed readers and a single writer to coordinate database access.'],
        [{ topic: 'Biến đổi khí hậu và thuế carbon', goal: 'Tác động chính sách' }, 'Carbon pricing interacts with climate change policy and renewable energy investment.']
    ];
    for (const [input, content] of cases) {
        assert.equal(relevance.evaluateSource(input, { content }).accepted, true, input.topic);
        assert.equal(relevance.evaluateSource(input, validPhysics).accepted, false, input.topic);
    }
});
test('Query repair preserves a valid English query and anchors drift without additional planner calls', async t => {
    const llm = require('../src/services/llm.service');
    t.mock.method(global, 'fetch', () => { throw Error('No network allowed'); });
    const query = relevance.anchorQuery(physics, 'market volatility trends');
    assert.ok(query.includes(physics.topic));
    assert.ok(query.includes(physics.scope));
    assert.ok(query.includes(physics.goal));
    assert.ok(!query.includes('market'), 'Discard drifting query terms rather than retaining them');
    assert.ok(relevance.anchorQuery({ topic: 'Physics', scope: 'mass spring', goal: 'Theory' }, 'quantum physics').includes('mass spring'));
    assert.equal(relevance.anchorQuery(physics, 'simple harmonic motion mass spring exercises'), 'simple harmonic motion mass spring exercises');
    const publicInput = { topic: 'Ứng dụng AI trong giáo dục đại học', goal: 'Phân tích ứng dụng, lợi ích và thách thức của AI trong giáo dục đại học', scope: 'Các nghiên cứu và nguồn web công khai' };
    const publicPlan = await llm.generateResearchPlan(publicInput);
    assert.equal(new Set(publicPlan.searchQueries.map(q => q.query)).size, 4, 'Generic source scope must not collapse distinct valid queries');
    const plan = await llm.generateResearchPlan(physics);
    assert.ok(plan.searchQueries.every(q => relevance.match(q.query, relevance.profile(physics)).relevant));
    const previousKey = process.env.GEMINI_API_KEY;
    process.env.MOCK_LLM = 'false'; process.env.GEMINI_API_KEY = 'synthetic-no-real-key';
    t.after(() => { process.env.MOCK_LLM = 'true'; if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey; });
    let calls = 0;
    global.fetch.mock.mockImplementation(async () => {
        calls++;
        return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
            researchQuestions: Array.from({ length: 4 }, (_, i) => `${physics.topic} câu hỏi ${i}`),
            searchQueries: Array.from({ length: 4 }, () => 'market volatility analysis')
        }) } }] }));
    });
    const repaired = await llm.generateResearchPlan(physics);
    assert.ok(repaired.searchQueries.every(q => q.query.includes(physics.topic) && !q.query.includes('market')));
    assert.equal(calls, 1, 'Query repair must not add planner calls');
});
test('Mixed Tavily collection filters before translation, deduplicates, preserves IDs and COMMIT across processes', async t => {
    await db.initializeDatabase();
    const good = { title: validPhysics.title, url: validPhysics.url, content: validPhysics.snippet, raw_content: validPhysics.content };
    let calls = 0;
    t.mock.method(global, 'fetch', async (url, options) => {
        assert.equal(url, 'https://api.tavily.com/search');
        const body = JSON.parse(options.body);
        assert.equal(body.search_depth, 'basic');
        assert.ok(body.query.includes(physics.topic));
        calls++;
        return new Response(JSON.stringify({ results: [...finance, good, { ...good, url: good.url + '?utm_source=duplicate' }] }));
    });
    const llm = require('../src/services/llm.service');
    t.mock.method(llm, 'generateJson', () => assert.fail('Relevance must not call Gemini per candidate'));
    const request = await research.createResearchRequest(physics);
    const result = await research.searchAndCollect(request.requestId);
    assert.equal(result.sourceCount, 1);
    assert.equal(result.metrics.rejectedSources, 3);
    assert.equal(result.metrics.translationCalls, 0);
    assert.equal(calls, 4);
    const repeat = await research.searchAndCollect(request.requestId);
    assert.deepEqual(repeat.sources.map(s => s.id), result.sources.map(s => s.id));
    assert.equal(calls, 8, 'One search per existing planned query; no hidden search expansion');
    const { spawnSync } = require('node:child_process');
    const child = spawnSync(process.execPath, ['-e', "const d=require('./src/config/database');d.all('SELECT title,url FROM sources WHERE request_id=$1',[process.argv[1]]).then(r=>console.log(JSON.stringify(r))).catch(()=>process.exitCode=1).finally(()=>d.close())", request.requestId], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), [{ title: validPhysics.title, url: validPhysics.url }]);
});
test('Fetched body is checked again and rejected sources never reach SQLite', async t => {
    const search = require('../src/services/search.service');
    const content = require('../src/services/content.service');
    let fetches = 0;
    t.mock.method(search, 'searchWeb', async () => [{ ...validPhysics, content: '', provider: 'tavily' }]);
    t.mock.method(content, 'fetchPageContent', async () => { fetches++; return finance[0].raw_content; });
    const request = await research.createResearchRequest(physics);
    await assert.rejects(research.searchAndCollect(request.requestId), /Không tìm thấy nguồn phù hợp/);
    assert.equal(fetches, 1, 'Deduplicate before fetching');
    assert.equal((await sourceModel.getSourcesByRequestId(request.requestId)).length, 0);
});
test('Flow v2 rejects all off-topic Tavily results, persists zero sources and terminates partial after bounded retry', async t => {
    const dns = require('node:dns/promises');
    t.mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]);
    let calls = 0;
    t.mock.method(global, 'fetch', async (url, options) => {
        assert.equal(url, 'https://api.tavily.com/search', 'No Gemini per rejected source');
        assert.ok(JSON.parse(options.body).query.includes(physics.topic));
        calls++;
        return new Response(JSON.stringify({ results: finance }));
    });
    const request = await research.createResearchRequest(physics);
    const service = require('../src/services/run.service');
    const run = await service.create(request.requestId, { searchMore: true }, 'off-topic-v2');
    const runner = require('../src/workers/runner');
    const realProvider = require('../src/providers/research.provider');

    const oldMock = process.env.MOCK_LLM;
    const oldGemini = process.env.GEMINI_API_KEY;

    process.env.MOCK_LLM = 'false';
    process.env.GEMINI_API_KEY = 'synthetic-no-real-key';

    t.after(() => {
        process.env.MOCK_LLM = oldMock;
        if (oldGemini === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = oldGemini;
    });

    const testProvider = {
        ...realProvider,
        plan: async () => ({
            researchQuestions: [1, 2, 3].map(i => ({
                id: `Q${i}`,
                question: `${physics.topic} câu hỏi ${i}`
            })),
            searchQueries: [{
                questionId: 'Q1',
                query: physics.topic
            }]
        })
    };

    for (let i = 0; i < 25; i++) {
        if (!(await runner.runOnce({ customProvider: testProvider }))) break;
    }
    const progress = await service.progress(request.requestId, run.id);
    assert.equal(progress.status, 'partial');
    assert.equal(progress.sourceCount, 0);
    assert.equal(progress.evidenceCount, 0);
    assert.ok(calls > 0 && calls <= 3, `Unexpected search expansion: ${calls}`);
    assert.equal((await db.get('SELECT llm_calls FROM research_runs WHERE id=$1', [run.id])).llm_calls, 0);
    const jobs = await db.all("SELECT output_json FROM stage_jobs WHERE run_id=$1 AND stage='collecting'", [run.id]);
    assert.ok(jobs.length >= 1 && jobs.length <= 3,
        'Search expansion must remain bounded');
    assert.ok(jobs.every(j => JSON.parse(j.output_json).warnings.some(w => w.code === 'NO_ACCEPTED_SOURCES')));
    const report = await db.get('SELECT * FROM report_versions WHERE run_id=$1', [run.id]);
    assert.deepEqual(JSON.parse(report.references_json), []);
    assert.match(report.content, /Chưa có bằng chứng phù hợp/);
});
test('Flow v2 mixed collection normalizes snippets, deduplicates, excludes misleading bodies and does not spend LLM budget', async t => {
    const goodUrl = 'https://physics-journal.edu/physics';
    const dns = require('node:dns/promises');
    t.mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]);
    t.mock.method(global, 'fetch', async url => {
        if (url === goodUrl) {
            return new Response(
                `<html><body><p>${validPhysics.content}</p></body></html>`,
                { headers: { 'content-type': 'text/html' } }
            );
        }
        assert.equal(url, 'https://api.tavily.com/search');
        return new Response(JSON.stringify({ results: [
            ...finance, { ...finance[0], title: physics.topic },
            { title: validPhysics.title, url: goodUrl, content: validPhysics.snippet, raw_content: validPhysics.content }
        ] }));
    });
    const request = await research.createResearchRequest(physics);
    const service = require('../src/services/run.service');
    const run = await service.create(request.requestId, { searchMore: false }, 'mixed-v2');
    t.after(() => service.cancel(run.id));
    const oldMock = process.env.MOCK_LLM;
    const oldGemini = process.env.GEMINI_API_KEY;

    process.env.MOCK_LLM = 'false';
    process.env.GEMINI_API_KEY = 'synthetic-no-real-key';

    t.after(() => {
        process.env.MOCK_LLM = oldMock;
        if (oldGemini === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = oldGemini;
    });

    await db.run("UPDATE research_runs SET status='running' WHERE id=$1", [run.id]);
    const ctx = { run, input: { ...physics, numberOfSources: 12 }, check() {}, signal: new AbortController().signal };
    const provider = require('../src/providers/research.provider');
    const result = await provider.collect(ctx, ['market trends', 'dao động điều hòa con lắc lò xo'], []);
    assert.equal(result.sources.length, 1);
    assert.equal(result.sources[0].url, goodUrl);
    assert.equal(result.sources[0].original_content, validPhysics.content);
    assert.ok(result.warnings.some(w => w.code === 'SOURCE_URL_REJECTED'));
    assert.equal((await db.get('SELECT llm_calls FROM research_runs WHERE id=$1', [run.id])).llm_calls, 0);
    const runner = require('../src/workers/runner');

    const testProvider = {
        ...provider,
        plan: async () => ({
            researchQuestions: [1, 2, 3].map(i => ({
                id: `Q${i}`,
                question: `${physics.topic} câu hỏi ${i}`
            })),
            searchQueries: [1, 2, 3].map(i => ({
                questionId: `Q${i}`,
                query: physics.topic
            }))
        }),
        collect: async () => result
    };

    assert.equal(
        await runner.runOnce({ customProvider: testProvider }), true
    );
    assert.equal(
        await runner.runOnce({ customProvider: testProvider }), true
    );
    const persisted = await db.all('SELECT * FROM source_versions WHERE run_id=$1', [run.id]);
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].url, goodUrl);
    assert.equal(persisted[0].original_content, validPhysics.content);
});
test('Evidence and new reports exclude legacy off-topic rows without deleting them or breaking citations', async t => {
    const request = await research.createResearchRequest(physics);
    const normalizer = require('../src/utils/sourceNormalizer');
    const legacy = normalizer.normalizeSource({ ...finance[0], snippet: finance[0].content, provider: 'tavily' }, physics.topic);
    const good = normalizer.normalizeSource({ ...validPhysics, provider: 'tavily' }, physics.topic);
    for (const source of [legacy, good]) Object.assign(source, { sourceLanguage: 'vi', translationStatus: 'not_required', contentVi: source.content, titleVi: source.title });
    // Explicit fixture seeding simulates historical rows; production data is never rewritten.
    await sourceModel.createSources(request.requestId, [legacy, good]);
    const before = await db.all('SELECT * FROM sources WHERE request_id=$1', [request.requestId]);
    const evidence = require('../src/services/evidence.service');
    const result = await evidence.analyze(request.requestId);
    assert.ok(result.evidenceCount > 0);
    const items = await evidence.getEvidence(request.requestId);
    const sources = await sourceModel.getSourcesByRequestId(request.requestId);
    const badId = sources.find(s => s.url === finance[0].url).id;
    assert.ok(items.every(e => e.sourceId !== badId));
    const report = await require('../src/services/report.service').generate(request.requestId, {});
    assert.ok(report.references.length > 0);
    assert.ok(report.references.every(r => r.url === validPhysics.url));
    assert.match(report.content, /\[Nguồn 1\]/);
    assert.ok(!report.content.includes(finance[0].url));
    assert.deepEqual(await db.all('SELECT * FROM sources WHERE request_id=$1', [request.requestId]), before);
    t.mock.method(require('../src/services/llm.service'), 'generateJson', () => assert.fail('No LLM for excluded sources'));
    const badOnly = await research.createResearchRequest(physics);
    await sourceModel.createSources(badOnly.requestId, [legacy]);
    await assert.rejects(evidence.analyze(badOnly.requestId), /Không có nguồn phù hợp/);
});

test('Mock mode remains deterministic, offline and deduplicated without exempting off-topic text', async t => {
    const previous = process.env.MOCK_SEARCH;
    process.env.MOCK_SEARCH = 'true';
    t.after(() => { process.env.MOCK_SEARCH = previous; });
    t.mock.method(global, 'fetch', () => assert.fail('Mock collection must be fully offline'));
    const request = await research.createResearchRequest(physics);
    const first = await research.searchAndCollect(request.requestId);
    assert.equal(first.sourceCount, 8);
    assert.equal(first.metrics.translationCalls, 0);
    const second = await research.searchAndCollect(request.requestId);
    assert.deepEqual(second.sources.map(s => s.id), first.sources.map(s => s.id));
    assert.equal(relevance.evaluateSource(physics, { ...finance[0], provider: 'mock', content: finance[0].raw_content }).accepted, false);
});
test('V2 extraction excludes bad sources before Gemini and rejects off-topic quotes inside a valid chunk', async t => {
    const previous = process.env.MOCK_LLM;
    const previousKey = process.env.GEMINI_API_KEY;
    const request = await research.createResearchRequest(physics);
    process.env.MOCK_LLM = 'false'; process.env.GEMINI_API_KEY = 'synthetic-no-real-key';
    t.after(() => {
        process.env.MOCK_LLM = previous;
        if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = previousKey;
    });
    const service = require('../src/services/run.service');
    const run = await service.create(request.requestId, { searchMore: false }, 'extraction-gate');
    t.after(() => service.cancel(run.id));
    await db.run("UPDATE research_runs SET status='running' WHERE id=$1", [run.id]);
    const badSource = {
        id: 'bad', provider: 'tavily',
        url: 'https://finance-journal.edu/market',
        title: finance[0].title,
        original_content: finance[0].raw_content
    };
    const goodSource = {
        id: 'good', provider: 'tavily',
        url: 'https://physics-journal.edu/physics',
        title: validPhysics.title,
        original_content: validPhysics.content
    };
    const badChunk = { id: 'bad-chunk', source_version_id: 'bad', provider: 'tavily', content: finance[0].raw_content };
    const goodChunk = { id: 'good-chunk', source_version_id: 'good', provider: 'tavily', content: validPhysics.content + ' ' + finance[0].raw_content };
    const ctx = { run, input: { ...physics, language: 'vi' }, sources: [badSource], check() {}, signal: new AbortController().signal };
    const provider = require('../src/providers/research.provider');
    const questions = [{ id: 'Q1', question: physics.topic }];
    let calls = 0, quote = finance[0].raw_content;
    t.mock.method(global, 'fetch', async (url, options) => {
        assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\//);
        calls++;
        const chunks = JSON.parse(JSON.parse(options.body).messages[1].content).chunks;
        assert.ok(chunks.every(c => c.sourceVersionId === 'good'));
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ evidence: [{
            questionId: 'Q1', chunkId: 'good-chunk',
            sourceVersionId: 'good', originalQuote: quote,
            evidenceText: 'Con lắc lò xo dao động điều hòa.', reason: 'Bằng chứng vật lý.'
        }] }) } }] }));
    });
    assert.deepEqual((await provider.extract(ctx, questions, [badChunk])).evidence, []);
    assert.equal(calls, 0);
    ctx.sources = [badSource, goodSource];
    const rejectedQuote = await provider.extract(ctx, questions, [badChunk, goodChunk]);
    assert.deepEqual(rejectedQuote.evidence, []);
    assert.deepEqual(
        new Set(rejectedQuote.warnings.map(w => w.code)),
        new Set([
            'OFF_TOPIC_EVIDENCE_QUOTE',
            'NO_VERIFIABLE_EVIDENCE'
        ])
    );
    assert.equal(
        rejectedQuote.warnings[0].code,
        'OFF_TOPIC_EVIDENCE_QUOTE'
    );
    quote = 'Con lắc lò xo dao động điều hòa.';
    const valid = await provider.extract(ctx, questions, [badChunk, goodChunk]);
    assert.equal(valid.evidence.length, 1);
    assert.equal(valid.evidence[0].sourceVersionId, 'good');
    assert.equal(valid.evidence[0].originalQuote, quote);
    assert.equal(calls, 2);
});
