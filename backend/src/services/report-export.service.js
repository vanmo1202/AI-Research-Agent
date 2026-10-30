const path = require('node:path');
const PDFDocument = require('pdfkit');
const { Document, Paragraph, TextRun, ExternalHyperlink, Packer, HeadingLevel, AlignmentType } = require('docx');
const reportService = require('./report.service');
const requests = require('../models/request.model');
const sources = require('../models/source.model');
const MIME = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pdf: 'application/pdf' };
const safeUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; } };
function markdownText(content) {
    // Legacy mock reports stored escaped newlines; normalize only this known envelope for presentation.
    return !content.includes('\n') && content.includes('\\n##') ? content.replace(/\\n/g, '\n') : content;
}
function inline(tokens = [], style = {}) {
    return tokens.flatMap(token => {
        if (token.type === 'strong') return inline(token.tokens, { ...style, bold: true });
        if (token.type === 'em') return inline(token.tokens, { ...style, italics: true });
        if (token.type === 'link') return inline(token.tokens, { ...style, url: safeUrl(token.href) });
        if (token.type === 'br') return [{ text: '\n', ...style }];
        if (token.type === 'image') return [{ text: token.text || '', ...style }];
        return token.tokens ? inline(token.tokens, style) : [{ text: token.text || token.raw || '', ...style }];
    });
}
function blocks(tokens, options = {}) {
    return tokens.flatMap(token => {
        if (['space', 'def'].includes(token.type)) return [];
        if (token.type === 'heading') return [{ ...options, level: token.depth, runs: inline(token.tokens) }];
        if (token.type === 'list') return token.items.flatMap((item, index) => {
            const parts = blocks(item.tokens, { ...options, indent: (options.indent || 0) + 1 });
            if (parts[0]) parts[0].prefix = token.ordered ? `${Number(token.start || 1) + index}. ` : '• ';
            return parts;
        });
        if (token.type === 'blockquote') return blocks(token.tokens, { ...options, quote: true });
        if (token.type === 'table') return [{ ...options, runs: [{ text: token.header.map(cell => cell.text).join(' | '), bold: true }] },
            ...token.rows.map(row => ({ ...options, runs: [{ text: row.map(cell => cell.text).join(' | ') }] }))];
        if (token.type === 'hr') return [{ runs: [{ text: '────────' }] }];
        if (token.type === 'code') return [{ ...options, code: true, runs: [{ text: token.text }] }];
        return [{ ...options, runs: token.tokens ? inline(token.tokens) : [{ text: token.text || token.raw || '' }] }];
    });
}
async function loadExport(requestId) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(requestId)) throw Object.assign(new Error('Mã nghiên cứu không hợp lệ.'), { status: 400 });
    const request = await requests.findById(requestId);
    if (!request) throw Object.assign(new Error('Không tìm thấy nghiên cứu.'), { status: 404 });
    const report = await reportService.getReport(requestId);
    if (!report) throw Object.assign(new Error('Không tìm thấy báo cáo đã lưu.'), { status: 404 });
    const originalSources = await sources.getSourcesByRequestId(requestId);
    const references = report.references.filter(ref => safeUrl(ref.url)).map(ref => {
        const source = originalSources.find(item => item.url === ref.url);
        const title = source ? source.titleVi || source.displayTitle || (source.sourceLanguage === 'vi' ? source.title : null) || 'Nguồn tài liệu' : ref.title || 'Nguồn tài liệu';
        return { ...ref, title }; // Preserve the saved citation label and original URL.
    });
    const { lexer } = await import('marked');
    const tokens = lexer(markdownText(report.content));
    let referenceDepth = null;
    const body = tokens.filter((token, index) => {
        if (index === 0 && token.type === 'heading' && token.text === report.title) return false;
        if (token.type === 'heading' && /^(?:\d+[.)]?\s*)?(?:tài liệu tham khảo|references)\s*$/i.test(token.text)) { referenceDepth = token.depth; return false; }
        if (referenceDepth && token.type === 'heading' && token.depth <= referenceDepth) referenceDepth = null;
        return !referenceDepth;
    });
    const created = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(report.createdAt.replace(' ', 'T') + (/[zZ]|[+]\d{2}:\d{2}$/.test(report.createdAt) ? '' : 'Z')));
    return { report, request, references, body: blocks(body), created,
        filename: `Bao_cao_nghien_cuu_${requestId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8)}` };
}
function wordRuns(runs, size = 24) {
    return runs.map(run => {
        const text = new TextRun({ text: run.text, bold: run.bold, italics: run.italics, size, font: 'Times New Roman', ...(run.url ? { style: 'Hyperlink' } : {}) });
        return run.url ? new ExternalHyperlink({ link: run.url, children: [text] }) : text;
    });
}
async function docx(data) {
    const headings = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
    const children = [new Paragraph({ text: data.report.title, heading: HeadingLevel.TITLE }),
        new Paragraph({ text: `Chủ đề: ${data.request.topic}` }), new Paragraph({ text: `Ngày tạo: ${data.created}`, spacing: { after: 300 } }),
        ...data.body.map(block => new Paragraph({ children: wordRuns([...(block.prefix ? [{ text: block.prefix }] : []), ...block.runs], block.level ? Math.max(26, 38 - block.level * 2) : 24),
            ...(block.level ? { heading: headings[Math.min(block.level, 6) - 1], keepNext: true } : {}),
            spacing: { after: 140, line: 320 }, indent: block.indent || block.quote ? { left: 360 * (block.indent || 1) } : undefined,
            alignment: block.level ? AlignmentType.LEFT : AlignmentType.JUSTIFIED })),
        new Paragraph({ text: 'Tài liệu tham khảo', heading: HeadingLevel.HEADING_1, keepNext: true }),
        ...data.references.map(ref => new Paragraph({ children: wordRuns([{ text: `${ref.citationLabel} ${ref.title} — ` }, { text: ref.url, url: safeUrl(ref.url) }]), spacing: { after: 160 } }))];
    return Packer.toBuffer(new Document({ creator: 'AI Research Agent', title: data.report.title,
        styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
        sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1417, right: 1134 } } }, children }] }));
}
function pdf(data) {
    return new Promise((resolve, reject) => {
        const document = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 56, left: 64, right: 56 }, info: { Title: data.report.title, Author: 'AI Research Agent' } });
        const chunks = [];
        document.on('data', chunk => chunks.push(chunk)); document.on('end', () => resolve(Buffer.concat(chunks))); document.on('error', reject);
        const fonts = path.join(__dirname, '../../assets/fonts');
        for (const [name, file] of [['regular', 'Regular'], ['bold', 'Bold'], ['italic', 'Italic'], ['bolditalic', 'BoldItalic']]) document.registerFont(name, path.join(fonts, `LiberationSerif-${file}.ttf`));
        function paragraph(runs, { size = 12, indent = 0, heading = false } = {}) {
            if (document.y + (heading ? 70 : 30) > document.page.height - 56) document.addPage();
            runs.forEach((run, index) => {
                document.font(heading || run.bold ? (run.italics ? 'bolditalic' : 'bold') : run.italics ? 'italic' : 'regular').fontSize(size).fillColor(run.url ? '#174b85' : '#17202a');
                document.text(run.text, { continued: index < runs.length - 1, lineGap: 4, indent,
                    ...(run.url ? { link: run.url, underline: true } : {}) });
            });
            document.moveDown(0.6);
        }
        try {
            paragraph([{ text: data.report.title }], { size: 20, heading: true });
            paragraph([{ text: `Chủ đề: ${data.request.topic}` }]); paragraph([{ text: `Ngày tạo: ${data.created}` }]);
            for (const block of data.body) paragraph([...(block.prefix ? [{ text: block.prefix }] : []), ...block.runs], { size: block.level ? Math.max(13, 19 - block.level) : 12, heading: Boolean(block.level), indent: block.indent || block.quote ? 18 * (block.indent || 1) : 0 });
            paragraph([{ text: 'Tài liệu tham khảo' }], { size: 17, heading: true });
            for (const ref of data.references) paragraph([{ text: `${ref.citationLabel} ${ref.title} — ` }, { text: ref.url, url: safeUrl(ref.url) }]);
            document.end();
        } catch (error) { document.destroy(error); }
    });
}
async function exportReport(id, format) {
    const data = await loadExport(id);
    return { buffer: await (format === 'docx' ? docx(data) : pdf(data)), filename: `${data.filename}.${format}`, mime: MIME[format] };
}
module.exports = { exportReport, markdownText };
