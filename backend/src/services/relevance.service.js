const topical = require('./source-relevance.service');
function scoreChunk(query, content) {
    const context = topical.profile({ topic: query });
    const hit = topical.match(content, context);
    if (!hit.relevant) return 0;
    const actual = topical.canonical(content);
    const phrase = context.core.some((word, i) => i + 1 < context.core.length &&
        (` ${actual} `).includes(` ${word} ${context.core[i + 1]} `));
    return Math.min(1, hit.score * 0.8 + (phrase ? 0.2 : 0));
}
function rankChunks(query, chunks) {
    return chunks.map(chunk => ({ ...chunk, relevanceScore: Number(scoreChunk(query, chunk.content).toFixed(4)) }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
module.exports = { scoreChunk, rankChunks };
