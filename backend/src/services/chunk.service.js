const { createHash } = require('node:crypto');

function splitContent(content, size = Number(process.env.RAG_CHUNK_SIZE || 1200), overlap = Number(process.env.RAG_CHUNK_OVERLAP || 200), max = Number(process.env.RAG_MAX_CHUNKS_PER_SOURCE || 30)) {
    const text = String(content || '').replace(/\s+/g, ' ').trim();
    if (!text) return [];
    size = Math.max(100, size); overlap = Math.max(0, Math.min(overlap, size - 1));
    const chunks = []; let start = 0;
    while (start < text.length && chunks.length < max) {
        let end = Math.min(start + size, text.length);
        if (end < text.length) {
            const boundary = Math.max(text.lastIndexOf('. ', end), text.lastIndexOf(' ', end));
            if (boundary > start + Math.floor(size * 0.55)) end = boundary + 1;
        }
        const value = text.slice(start, end).trim();
        if (value) chunks.push(value);
        if (end >= text.length) break;
        start = Math.max(start + 1, end - overlap);
    }
    return chunks;
}
function createChunks(requestId, source) {
    const trusted = ['complete', 'partial', 'not_required'].includes(source.translationStatus);
    const content = source.sourceLanguage === 'vi' ? source.contentVi || source.content : trusted ? source.contentVi : '';
    const usable = String(content || '').replace(/Một phần nội dung chưa thể dịch\. Vui lòng thử lại sau\./g, '');
    return splitContent(usable)
        .map((content, chunkIndex) => ({
            id: createHash('sha256').update(JSON.stringify([requestId, source.id, chunkIndex, content])).digest('hex'),
            requestId, sourceId: source.id, chunkIndex, content, charCount: content.length
        }));
}
module.exports = { splitContent, createChunks };
