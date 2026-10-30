function tokens(value) { return new Set(String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[\p{L}\p{N}\u00C0-\u024F]{3,}/gu) || []); }
function scoreChunk(query, content) {
    const wanted = tokens(query); const actual = tokens(content); if (!wanted.size || !actual.size) return 0;
    let matches = 0; for (const token of wanted) if (actual.has(token)) matches += 1;
    const phrase = String(query || '').toLowerCase().split(/\s+/).filter(Boolean).some(word => word.length > 4 && String(content).toLowerCase().includes(word));
    return Math.min(1, (matches / wanted.size) * 0.8 + (phrase ? 0.2 : 0));
}
function rankChunks(query, chunks) { return chunks.map(chunk => ({ ...chunk, relevanceScore: Number(scoreChunk(query, chunk.content).toFixed(4)) })).sort((a, b) => b.relevanceScore - a.relevanceScore); }
module.exports = { scoreChunk, rankChunks };
