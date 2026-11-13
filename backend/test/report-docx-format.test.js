const { test } = require('node:test');
const assert = require('node:assert/strict');
const { unzipSync, strFromU8 } = require('fflate');
const { renderDocx } = require('../src/services/report-docx.service');
const { blocks } = require('../src/services/report-export.service');

async function parseMarkdown(markdown) {
  const { lexer } = await import('marked');
  return blocks(lexer(markdown));
}

function unpack(buffer) {
  assert.ok(buffer.subarray(0, 2).equals(Buffer.from('PK')));
  const zip = unzipSync(buffer);
  return Object.fromEntries(
    Object.entries(zip)
      .filter(([path]) => path.endsWith('.xml') || path.endsWith('.rels'))
      .map(([path, content]) => [path, strFromU8(content)]),
  );
}

test('Academic DOCX uses A4, page margins, Times New Roman and 1.5 line spacing', async () => {
  const body = await parseMarkdown(
    '# Báo cáo A4\n\n## 1. Giới thiệu\n\nPhân tích **bằng chứng** đáng tin cậy.\n\n' +
      '## 2. Đánh giá\n\nNội dung nghiên cứu đầy đủ.',
  );
  const xml = unpack(
    await renderDocx({
      report: { title: 'Báo cáo A4' },
      request: { topic: 'Nghiên cứu AI' },
      created: '2026-11-13T10:00:00Z',
      body,
      references: [],
    }),
  );
  const document = xml['word/document.xml'];
  assert.match(document, /w:w="11906"/);
  assert.match(document, /w:h="16838"/);
  assert.match(document, /w:left="1701"/);
  assert.match(document, /w:right="1134"/);
  assert.match(document, /w:line="360"/);
  assert.match(document, /Times New Roman/);
  assert.match(document, /Heading1/);
  assert.match(document, /Heading2/);
  assert.match(document, /Đánh giá/);
  assert.match(document, /MỤC LỤC/);
  assert.match(document, /Tài liệu tham khảo/);
  assert.match(xml['word/settings.xml'] || '', /updateFields/);
  assert.match(xml['word/footer1.xml'] || '', /PAGE|PAGE\s/);
  // One copy in the cover and not repeated as a body heading.
  assert.equal((document.match(/Báo cáo A4/g) || []).length, 1);
});

test('DOCX converts markdown tables to real OOXML tables and retains safe citation links', async () => {
  const body = await parseMarkdown(
    '## 1. Bảng phân tích\n\n| Tiêu chí | Kết quả |\n| --- | --- |\n' +
      '| Độ chính xác | **Cao** |\n| Bằng chứng | *Đầy đủ* |\n\n' +
      '1. Kết luận thứ nhất\n2. Kết luận thứ hai\n',
  );
  assert.ok(body.some((entry) => entry.table));
  const xml = unpack(
    await renderDocx({
      report: { title: 'Báo cáo tổng hợp' },
      request: { topic: 'Đánh giá mô hình' },
      created: '2026-11-13T10:00:00Z',
      body,
      references: [
        { citationLabel: '[Nguồn 1]', title: 'Tài liệu mẫu', url: 'https://example.org/source' },
        { citationLabel: '[Nguồn 2]', title: 'Không có URL', url: 'javascript:alert(1)' },
      ],
    }),
  );
  assert.match(xml['word/document.xml'], /<w:tbl>/);
  assert.match(xml['word/document.xml'], /<w:tblHeader/);
  assert.match(xml['word/document.xml'], /Độ chính xác/);
  assert.match(xml['word/document.xml'], /Kết luận thứ nhất/);
  assert.match(xml['word/document.xml'], /Tài liệu mẫu/);
  assert.match(xml['word/_rels/document.xml.rels'], /https:\/\/example.org\/source/);
  assert.doesNotMatch(xml['word/_rels/document.xml.rels'], /javascript:/);
});

test('DOCX retains all body sections for six-stage report output without inserting fake results', async () => {
  const body = await parseMarkdown(
    '## Tóm tắt\n\nKết quả sơ bộ.\n\n### Hạn chế\n\nChưa xác minh độc lập.',
  );
  const xml = unpack(
    await renderDocx({
      report: { title: 'Nghiên cứu thực nghiệm' },
      request: { topic: 'Tìm hiểu dữ liệu' },
      created: new Date().toISOString(),
      body,
      references: [],
    }),
  );
  assert.match(xml['word/document.xml'], /Kết quả sơ bộ/);
  assert.match(xml['word/document.xml'], /Chưa xác minh độc lập/);
  assert.match(xml['word/document.xml'], /Chưa có tài liệu tham khảo/);
});
