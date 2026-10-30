const { test } = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/translation.service');
const llm = require('../src/services/llm.service');

function providerResponse(value) {
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(value) } }] }) };
}

test('Chunk translation: splitting, isolated transport retries, fallback and budgets', async t => {
    const env = { ...process.env };
    const fetch = global.fetch;
    const generate = llm.generateJson;
    const random = Math.random;
    Object.assign(process.env, { GEMINI_API_KEY: 'test-placeholder', MOCK_LLM: 'false', TRANSLATE_SOURCE_CONTENT: 'true',
        TRANSLATE_CHUNK_CHARS: '30', TRANSLATE_MAX_CONTENT_CHARS: '12000',
        GEMINI_TRANSLATION_TIMEOUT_MS: '1234', GEMINI_TRANSLATION_RETRY_COUNT: '2',
        GEMINI_TRANSLATION_RETRY_BASE_DELAY_MS: '1', HTTP_RETRY_COUNT: '8', HTTP_TIMEOUT_MS: '99999', GEMINI_MIN_INTERVAL_MS: '0' });
    Math.random = () => 0;
    global.fetch = () => { throw new Error('Unstubbed real network forbidden'); };
    try {
        await t.test('Empty/short/long input, max length, paragraphs, sentences, words and order', () => {
            const split = service.splitTextForTranslation;
            assert.deepEqual(split(' \n '), []);
            assert.deepEqual(split(' Short text ', 30), ['Short text']);
            assert.deepEqual(split('First paragraph.\n\nSecond paragraph.\n\nThird paragraph.', 30), ['First paragraph.', 'Second paragraph.', 'Third paragraph.']);
            assert.deepEqual(split('First sentence. Second longer sentence.', 30), ['First sentence.', 'Second longer sentence.']);
            const input = 'abcdefghijklmnopqrstuvwxyz'.repeat(8);
            const chunks = split(input, 30);
            assert.ok(chunks.length > 1);
            assert.equal(chunks.join(''), input);
            assert.ok(chunks.every(chunk => chunk.length <= 30 && chunk.trim()));
            const words = 'one two three four five six seven eight nine ten';
            assert.equal(split(words, 15).join(' '), words);
            assert.throws(() => split('x', 0));
        });
        await t.test('Metadata and content have separate bounded payloads and timeout settings', async () => {
            const calls = [];
            llm.generateJson = async (prompt, input, options) => {
                calls.push({ input, options });
                return input.text ? { translatedText: `VI:${input.text}` } : { titleVi: 'Tiêu đề', snippetVi: 'Tóm tắt' };
            };
            const source = { title: 'Original title', snippet: 'Original snippet', content: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.' };
            const before = structuredClone(source);
            const result = await service.translateSourceToVietnamese(source);
            assert.deepEqual(source, before);
            assert.equal(result.titleVi, 'Tiêu đề');
            assert.equal(result.contentVi, 'VI:First paragraph.\n\nVI:Second paragraph.\n\nVI:Third paragraph.');
            assert.equal(calls.length, 4);
            assert.deepEqual(Object.keys(calls[0].input), ['title', 'snippet']);
            assert.ok(calls.slice(1).every(call => call.input.text.length <= 30 && !('title' in call.input)));
            assert.ok(calls.every(call => call.options.timeoutMs === 1234 && call.options.retryCount === 0));
            llm.generateJson = generate;
        });
        for (const status of [400, 401, 403, 404, 408, 429, 500, 502, 503, 504]) {
            await t.test(`HTTP ${status}: correct retry classification without nested retries`, async () => {
                let count = 0;
                const retryable = [408, 429, 500, 502, 503, 504].includes(status);
                global.fetch = async () => { count++; return { ok: false, status }; };
                await assert.rejects(service.translateChunk('Original text'), error => error.status === status);
                assert.equal(count, retryable ? 3 : 1);
            });
        }
        for (const name of ['AbortError', 'TimeoutError', 'TypeError']) {
            await t.test(`${name}: one failed attempt then success`, async () => {
                let count = 0;
                global.fetch = async () => {
                    if (++count === 1) { const error = new Error('Transient failure'); error.name = name; throw error; }
                    return providerResponse({ translatedText: 'Nội dung tiếng Việt' });
                };
                assert.equal(await service.translateChunk('Original text'), 'Nội dung tiếng Việt');
                assert.equal(count, 2);
            });
        }
        await t.test('Body-read timeout retries; invalid JSON/schema/URL changes do not retry', async () => {
            let count = 0;
            global.fetch = async () => {
                if (++count === 1) return { ok: true, json: async () => { throw Object.assign(new Error(), { name: 'TimeoutError' }); } };
                return providerResponse({ translatedText: 'Đã dịch' });
            };
            assert.equal(await service.translateChunk('Original text'), 'Đã dịch');
            assert.equal(count, 2);
            for (const value of [null, {}, { translatedText: 42 }, { translatedText: '' }, { translatedText: 'https://changed.example' }]) {
                count = 0;
                global.fetch = async () => { count++; return providerResponse(value); };
                await assert.rejects(service.translateChunk('See https://original.example'));
                assert.equal(count, 1);
            }
            count = 0;
            global.fetch = async () => { count++; return { ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } }; };
            await assert.rejects(service.translateChunk('Original'));
            assert.equal(count, 1);
        });
        await t.test('Only exhausted chunk falls back in order; siblings remain translated', async () => {
            const attempts = new Map();
            global.fetch = async (url, options) => {
                const input = JSON.parse(JSON.parse(options.body).messages[1].content);
                const count = (attempts.get(input.text) || 0) + 1;
                attempts.set(input.text, count);
                if (input.text === 'Second paragraph.') throw Object.assign(new Error(), { name: 'TimeoutError' });
                return providerResponse({ translatedText: `VI:${input.text}` });
            };
            assert.equal(await service.translateContent('First paragraph.\n\nSecond paragraph.\n\nThird paragraph.'),
                'VI:First paragraph.\n\nMột phần nội dung chưa thể dịch. Vui lòng thử lại sau.\n\nVI:Third paragraph.');
            assert.equal(attempts.get('First paragraph.'), 1);
            assert.equal(attempts.get('Second paragraph.'), 3);
            assert.equal(attempts.get('Third paragraph.'), 1);
        });
        await t.test('Metadata failure does not prevent content translation; long content capped', async () => {
            process.env.TRANSLATE_MAX_CONTENT_CHARS = '45';
            const contentInputs = [];
            global.fetch = async (url, options) => {
                const input = JSON.parse(JSON.parse(options.body).messages[1].content);
                if (!input.text) return { ok: false, status: 401 };
                contentInputs.push(input.text);
                return providerResponse({ translatedText: `VI:${input.text}` });
            };
            const result = await service.translateSourceToVietnamese({ title: 'Title', snippet: 'Snippet', content: 'a'.repeat(90) });
            assert.equal(result.titleVi, null); assert.equal(result.snippetVi, null);
            assert.equal(contentInputs.join('').length, 45);
            assert.ok(contentInputs.every(text => text.length <= 30));
            assert.equal(result.contentVi, 'VI:' + 'a'.repeat(30) + '\n\nVI:' + 'a'.repeat(15));
        });
    } finally {
        process.env = env; global.fetch = fetch; llm.generateJson = generate; Math.random = random;
    }
});
