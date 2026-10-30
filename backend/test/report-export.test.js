const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { unzipSync, strFromU8 } = require('fflate');

test('Saved report exports: real DOCX/PDF, Unicode fonts, canonical citations and safe failures', async t => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'report-export-'));
    process.env.RESEARCH_DB_PATH = path.join(directory, 'db.sqlite');
    process.env.MOCK_LLM = 'true'; process.env.MOCK_SEARCH = 'true';
    const db = require('../src/config/database');
    await db.initializeDatabase();
    const { app } = require('../src/server');
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const fetch = global.fetch;
    const base = `http://127.0.0.1:${server.address().port}`;
    const id = '12345678-1234-1234-1234-123456789abc';
    const content = '# Báo cáo tiếng Việt\n\n## 1. Giới thiệu\n\nNghiên cứu **bằng chứng** và *trích dẫn*.\n\n- Mục thứ nhất\n- Mục thứ hai\n\n> Đánh giá thận trọng.\n\n' + ('Đoạn phân tích về ứng dụng trí tuệ nhân tạo và các hạn chế của dữ liệu.\n\n').repeat(80) + '## Tài liệu tham khảo\n\n[Nguồn 1] Old English title — https://example.com/article';
    await db.run('INSERT INTO requests (id, topic, goal, status) VALUES (?, ?, ?, ?)', [id, 'Chủ đề tiếng Việt', 'Mục tiêu', 'completed']);
    await db.run('INSERT INTO requests (id, topic, goal, status) VALUES (?, ?, ?, ?)', ['no-report', 'Chưa tạo', 'Mục tiêu', 'planned']);
    await db.run('INSERT INTO sources (id, request_id, query, title, title_vi, url, normalized_url, source_language, translation_status, provider, collected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', ['source', id, 'RAG', 'Old English title', 'Tiêu đề nguồn tiếng Việt', 'https://example.com/article', 'https://example.com/article', 'en', 'complete', 'tavily', new Date().toISOString()]);
    await db.run('INSERT INTO reports (id, request_id, title, content, references_json) VALUES (?, ?, ?, ?, ?)', ['report', id, 'Báo cáo tiếng Việt', content, JSON.stringify([{ citationLabel: '[Nguồn 1]', title: 'Old English title', url: 'https://example.com/article' }])]);
    const before = await db.get('SELECT * FROM reports WHERE request_id = ?', [id]);
    global.fetch = () => { throw new Error('Export must not call any external API'); };
    try {
        await t.test('DOCX endpoint contains real zipped Word XML, body, headings and source hyperlinks', async () => {
            const response = await fetch(`${base}/api/research/${id}/report/export/docx`, { headers: { Origin: 'http://localhost:5173' } });
            assert.equal(response.status, 200);
            assert.match(response.headers.get('content-type'), /^application\/vnd.openxmlformats-officedocument.wordprocessingml.document/);
            assert.equal(response.headers.get('content-disposition'), 'attachment; filename="Bao_cao_nghien_cuu_12345678.docx"');
            assert.match(response.headers.get('access-control-expose-headers'), /Content-Disposition/i);
            const buffer = Buffer.from(await response.arrayBuffer()); assert.ok(buffer.length > 3000);
            assert.equal(buffer.subarray(0, 2).toString(), 'PK');
            const entries = unzipSync(buffer); const xml = strFromU8(entries['word/document.xml']);
            assert.match(xml, /Báo cáo tiếng Việt/); assert.match(xml, /Chủ đề tiếng Việt/); assert.match(xml, /Đánh giá thận trọng/);
            assert.match(xml, /Tiêu đề nguồn tiếng Việt/); assert.doesNotMatch(xml, /Old English title/);
            assert.match(xml, /Heading[123]/); assert.match(xml, /Times New Roman/);
            assert.match(strFromU8(entries['word/_rels/document.xml.rels']), /https:\/\/example.com\/article/);
            await fs.writeFile('/tmp/ai-research-export-check.docx', buffer);
        });
        await t.test('PDF endpoint returns actual multi-page PDF with embedded Unicode font and original reference link', async () => {
            const response = await fetch(`${base}/api/research/${id}/report/export/pdf`);
            assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /^application\/pdf/);
            assert.equal(response.headers.get('content-disposition'), 'attachment; filename="Bao_cao_nghien_cuu_12345678.pdf"');
            const buffer = Buffer.from(await response.arrayBuffer()); assert.ok(buffer.length > 5000);
            assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
            const raw = buffer.toString('latin1'); assert.match(raw, /FontFile2/); assert.match(raw, /ToUnicode/);
            assert.match(raw, /https:\/\/example.com\/article/); assert.ok((raw.match(/\/Type \/Page\b/g) || []).length >= 2);
            await fs.writeFile('/tmp/ai-research-export-check.pdf', buffer);
        });
        await t.test('Missing report/request and invalid IDs have JSON errors; exports do not mutate stored content', async () => {
            for (const [requestId, status] of [['no-report', 404], ['missing-request', 404], ['invalid%20id', 400]]) {
                for (const format of ['docx', 'pdf']) {
                    const response = await fetch(`${base}/api/research/${requestId}/report/export/${format}`);
                    assert.equal(response.status, status); assert.equal((await response.json()).success, false);
                }
            }
            assert.deepEqual(await db.get('SELECT * FROM reports WHERE request_id = ?', [id]), before);
        });
    } finally { global.fetch = fetch; await new Promise(resolve => server.close(resolve)); }
});
