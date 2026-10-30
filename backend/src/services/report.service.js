const { randomUUID } = require('node:crypto');
const database = require('../config/database');
const requestModel = require('../models/request.model');
const sourceModel = require('../models/source.model');
const evidenceService = require('./evidence.service');
const logger = require('../utils/logger');
const llmService = require('./llm.service');

function httpError(message, status) { const error = new Error(message); error.status = status; return error; }
function validateConfig(input = {}) { const config = { title: String(input.title || 'Báo cáo nghiên cứu').trim(), language: input.language || 'vi', style: input.style || 'academic', outputLength: input.outputLength || 'medium' }; if (!config.title || !['vi'].includes(config.language) || !['academic', 'professional', 'summary'].includes(config.style) || !['short', 'medium', 'long'].includes(config.outputLength)) throw httpError('Invalid report configuration', 400); return config; }
function buildContext(request, evidence, sources, config) { const max = Number(process.env.REPORT_MAX_CONTEXT_CHARS || 50000); const refs = sources.map((s, i) => `[Nguồn ${i + 1}] ${s.displayTitle || 'Không có tiêu đề'} — ${s.url}`).join('\n'); const body = evidence.map(item => `${item.citationLabel} ${item.researchQuestion}: ${item.evidenceText}`).join('\n'); return `Chủ đề: ${request.topic}\nMục tiêu: ${request.goal}\nPhạm vi: ${request.scope || 'Không nêu'}\nĐộ dài: ${config.outputLength}\n\nBẰNG CHỨNG:\n${body}\n\nNGUỒN:\n${refs}`.slice(0, max); }
function mockReport(request, evidence, sources, config) { const references = sources.map((source, index) => ({ citationLabel: `[Nguồn ${index + 1}]`, title: source.displayTitle || 'Nguồn tài liệu', url: source.url, provider: source.provider })); const grouped = evidence.map(item => `### ${item.researchQuestion}\n${item.evidenceText} ${item.citationLabel}`).join('\n\n'); return { content: `# ${config.title}\n\n## 1. Giới thiệu\n\nBáo cáo này tổng hợp các bằng chứng thu thập được về **${request.topic}** trong phạm vi đã xác định.\n\n## 2. Phân tích theo câu hỏi nghiên cứu\n\n${grouped}\n\n## 3. Hạn chế\n\nKết luận phụ thuộc vào các nguồn tài liệu đã thu thập và cần được kiểm chứng thêm.\n\n## 4. Kết luận\n\nCác bằng chứng trên cung cấp cơ sở ban đầu để trả lời mục tiêu nghiên cứu.\n\n## 5. Tài liệu tham khảo\n\n${references.map(r => `${r.citationLabel} ${r.title || 'Nguồn tài liệu'} — ${r.url}`).join('\n')}`, references }; }
function rowReport(row) { if (!row) return null; return { id: row.id, requestId: row.request_id, title: row.title, language: row.language, style: row.style, outputLength: row.output_length, content: row.content, references: JSON.parse(row.references_json || '[]'), createdAt: row.created_at, updatedAt: row.updated_at }; }
async function getReport(requestId) { return rowReport(await database.get('SELECT * FROM reports WHERE request_id = ?', [requestId])); }
async function generate(requestId, input) {
    const request = await requestModel.findById(requestId); if (!request) throw httpError('Research request not found', 404);
    if (request.status !== 'analyzed_partial' && request.status !== 'analyzed' && request.status !== 'completed') throw httpError('Research must be analyzed first', 409);
    const config = validateConfig(input); const evidence = await evidenceService.getEvidence(requestId); if (!evidence.length) throw httpError('No relevant evidence found', 400);
    const sources = await sourceModel.getSourcesByRequestId(requestId); await requestModel.updateStatus(requestId, 'generating_report'); logger.info('Report', `Building context for request ${requestId}`);
    try {
        let result = mockReport(request, evidence, sources, config);
        if (process.env.MOCK_LLM === 'false' && process.env.MOCK_REPORT !== 'true') {
            const generated = await llmService.generateJson('You are a research report writing assistant. Use only the supplied evidence and sources. Return JSON with content (Vietnamese markdown report) and references (array copied from supplied sources). Do not invent facts or URLs.', { request, config, context: buildContext(request, evidence, sources, config), references: result.references });
            if (typeof generated.content !== 'string' || !generated.content.trim() || !Array.isArray(generated.references)) throw new Error('Invalid report output'); result = { content: generated.content, references: generated.references.filter(item => sources.some(source => source.url === item.url)) };
        }
        const id = randomUUID();
        await database.transaction(async tx => { await tx.run(`INSERT INTO reports (id, request_id, title, language, style, output_length, content, references_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(request_id) DO UPDATE SET title=excluded.title, language=excluded.language, style=excluded.style, output_length=excluded.output_length, content=excluded.content, references_json=excluded.references_json, updated_at=excluded.updated_at`, [id, requestId, config.title, config.language, config.style, config.outputLength, result.content, JSON.stringify(result.references), new Date().toISOString()]); await tx.run('UPDATE requests SET status = ?, updated_at = ? WHERE id = ?', ['completed', new Date().toISOString(), requestId]); });
        logger.info('Report', 'Report saved'); logger.info('Research', 'Status: completed'); const report = await getReport(requestId); return { requestId, status: 'completed', reportId: report.id, title: report.title, content: report.content, references: report.references };
    } catch (error) { await requestModel.updateStatus(requestId, 'failed'); throw httpError('Report generation failed', 502); }
}
module.exports = { generate, getReport, buildContext, validateConfig };
