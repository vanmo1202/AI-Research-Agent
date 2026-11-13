// Standard Vietnamese academic Word layout. Presentation only: never rewrite research evidence.
const {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} = require('docx');

const FONT = 'Times New Roman';
const BODY_SIZE = 26; // 13 pt (DOCX uses half points).
const HEADING_SIZES = [32, 29, 27, 26, 26, 26];
const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];
const A4 = {
  width: 11906,
  height: 16838,
  margin: { top: 1417, bottom: 1417, left: 1701, right: 1134, header: 708, footer: 708 },
};
const CONTENT_WIDTH = A4.width - A4.margin.left - A4.margin.right;
const BORDER = { style: BorderStyle.SINGLE, color: '7A7A7A', size: 4 };

function safeUrl(value) {
  try {
    const uri = new URL(value);
    return ['http:', 'https:'].includes(uri.protocol) ? uri.href : null;
  } catch {
    return null;
  }
}

function readableDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.valueOf())
    ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date)
    : String(value || '');
}

function plain(runs = []) {
  return runs.map((run) => String(run.text || '')).join('');
}

function styledRuns(runs = [], options = {}) {
  return runs.map((run) => {
    const url = safeUrl(run.url);
    const text = new TextRun({
      text: String(run.text ?? ''),
      font: options.font || FONT,
      size: options.size || BODY_SIZE,
      bold: Boolean(options.bold || run.bold),
      italics: Boolean(options.italics || run.italics),
      ...(url ? { color: '174B85', underline: {} } : {}),
    });
    return url ? new ExternalHyperlink({ link: url, children: [text] }) : text;
  });
}

function bodyParagraph(block) {
  const list = Boolean(block.prefix);
  const depth = Math.min(5, Math.max(1, Number(block.indent) || 1));
  return new Paragraph({
    children: styledRuns(
      [...(list ? [{ text: block.prefix }] : []), ...(block.runs || [])],
      { size: block.code ? 22 : BODY_SIZE, font: block.code ? 'Courier New' : FONT, italics: block.quote },
    ),
    alignment: block.code || block.quote ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
    spacing: { before: 0, after: 140, line: 360 },
    indent: list
      ? { left: depth * 480, hanging: 260 }
      : block.quote
        ? { left: 700, right: 300 }
        : block.code
          ? { left: 400 }
          : { firstLine: 567 },
    keepTogether: Boolean(block.code),
  });
}

function headingParagraph(block) {
  const depth = Math.min(6, Math.max(1, Number(block.level) || 1));
  return new Paragraph({
    children: styledRuns(block.runs || [], { size: HEADING_SIZES[depth - 1], bold: true }),
    heading: HEADING_LEVELS[depth - 1],
    keepNext: true,
    keepTogether: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: depth === 1 ? 300 : 220, after: 140, line: 320 },
  });
}

function wordTable(block) {
  const rows = [block.table.header, ...block.table.rows];
  const columnCount = Math.max(1, block.table.header.length);
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: BORDER, insideVertical: BORDER },
    rows: rows.map((row, index) =>
      new TableRow({
        cantSplit: true,
        ...(index === 0 ? { tableHeader: true } : {}),
        children: Array.from({ length: columnCount }, (_, column) =>
          new TableCell({
            children: [
              new Paragraph({
                children: styledRuns(row[column] || [{ text: '' }], { size: 24, bold: index === 0 }),
                spacing: { before: 0, after: 0, line: 300 },
                alignment: AlignmentType.LEFT,
              }),
            ],
          }),
        ),
      }),
    ),
  });
}

function cover(data) {
  const title = String(data.report?.title || data.request?.topic || 'Báo cáo nghiên cứu');
  const subject = String(data.request?.topic || title);
  return [
    new Paragraph({
      children: styledRuns([{ text: 'BÁO CÁO NGHIÊN CỨU' }], { size: 34, bold: true }),
      alignment: AlignmentType.CENTER,
      spacing: { before: 2500, after: 520 },
    }),
    new Paragraph({
      children: styledRuns([{ text: title }], { size: 40, bold: true }),
      alignment: AlignmentType.CENTER,
      spacing: { after: 700, line: 400 },
    }),
    new Paragraph({
      children: styledRuns([{ text: 'Chủ đề: ' + subject }], { size: 26 }),
      alignment: AlignmentType.CENTER,
      spacing: { after: 280, line: 360 },
    }),
    new Paragraph({
      children: styledRuns([{ text: 'Ngày tạo: ' + readableDate(data.created) }], { size: 24 }),
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function references(data) {
  const result = [
    headingParagraph({ level: 1, runs: [{ text: 'Tài liệu tham khảo' }] }),
  ];
  const refs = Array.isArray(data.references) ? data.references : [];
  if (!refs.length) {
    result.push(bodyParagraph({ runs: [{ text: 'Chưa có tài liệu tham khảo được lưu trong báo cáo.' }] }));
  }
  for (const ref of refs) {
    const label = String(ref.citationLabel || '');
    const title = String(ref.title || 'Nguồn tài liệu');
    const link = safeUrl(ref.url);
    result.push(
      new Paragraph({
        children: styledRuns([
          { text: (label ? label + ' ' : '') + title },
          ...(link ? [{ text: ' — ' }, { text: link, url: link }] : []),
        ], { size: 24 }),
        alignment: AlignmentType.LEFT,
        spacing: { after: 160, line: 330 },
        indent: { left: 400, hanging: 400 },
      }),
    );
  }
  return result;
}

async function renderDocx(data) {
  const title = String(data.report?.title || data.request?.topic || 'Báo cáo nghiên cứu');
  const firstHeading = data.body?.find((block) => block.level);
  const excludeFirstDuplicate = Boolean(
    firstHeading?.level === 1 && plain(firstHeading.runs).trim() === title.trim(),
  );
  const content = (data.body || []).filter((block) => block !== (excludeFirstDuplicate ? firstHeading : null));
  const toc = content.filter((block) => block.level >= 1 && block.level <= 3)
    .map((block) => ({ title: plain(block.runs).trim(), level: block.level }))
    .filter((item) => item.title);
  toc.push({ title: 'Tài liệu tham khảo', level: 1 });

  const children = [
    ...cover(data),
    new Paragraph({
      children: styledRuns([{ text: 'MỤC LỤC' }], { size: 32, bold: true }),
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
    }),
    new TableOfContents('Mục lục', {
      hyperlink: true,
      headingStyleRange: '1-3',
      cachedEntries: toc,
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
  for (const block of content) {
    if (block.tableContinuation) continue;
    if (block.table) children.push(wordTable(block));
    else if (block.level) children.push(headingParagraph(block));
    else children.push(bodyParagraph(block));
  }
  children.push(...references(data));

  return Packer.toBuffer(
    new Document({
      creator: 'ResearchOS',
      title,
      subject: String(data.request?.topic || title),
      features: { updateFields: true },
      styles: { default: { document: { run: { font: FONT, size: BODY_SIZE } } } },
      sections: [
        {
          properties: { titlePage: true, page: { size: { width: A4.width, height: A4.height }, margin: A4.margin } },
          headers: {
            default: new Header({
              children: [new Paragraph({
                children: styledRuns([{ text: 'RESEARCHOS  |  BÁO CÁO NGHIÊN CỨU' }], { size: 18 }),
                alignment: AlignmentType.RIGHT,
              })],
            }),
          },
          footers: {
            default: new Footer({
              children: [new Paragraph({
                children: [new TextRun({ children: ['Trang ', PageNumber.CURRENT], font: FONT, size: 20 })],
                alignment: AlignmentType.CENTER,
              })],
            }),
          },
          children,
        },
      ],
    }),
  );
}
module.exports = { renderDocx };
