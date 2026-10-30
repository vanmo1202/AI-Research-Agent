const { randomUUID } = require("node:crypto");
const database = require("../config/database");
function fromRow(row) {
    return { id: row.id, query: row.query, title: row.title, url: row.url,
        normalizedUrl: row.normalized_url, snippet: row.snippet, content: row.content,
        titleVi: row.title_vi ?? null, snippetVi: row.snippet_vi ?? null, contentVi: row.content_vi ?? null,
        sourceLanguage: row.source_language || 'unknown', translationStatus: row.translation_status || 'pending',
        translationHash: row.translation_hash || null,
        displayTitle: ['complete', 'partial', 'not_required'].includes(row.translation_status) ? row.title_vi : null,
        displaySnippet: ['complete', 'partial', 'not_required'].includes(row.translation_status) ? row.snippet_vi : null,
        displayContent: ['complete', 'partial', 'not_required'].includes(row.translation_status) ? row.content_vi : null,
        provider: row.provider, collectedAt: row.collected_at };
}
async function getSourcesByRequestId(requestId) {
    return (await database.all("SELECT * FROM sources WHERE request_id = ? ORDER BY rowid", [requestId])).map(fromRow);
}
async function createSources(requestId, sources, status = "collected") {
    // UPSERT giữ id ổn định khi chạy lại Workflow 2; status cùng transaction.
    await database.transaction(async tx => {
        for (const source of sources) {
            await tx.run(`INSERT INTO sources
                (id, request_id, query, title, url, normalized_url, snippet, content, provider, collected_at, title_vi, snippet_vi, content_vi, source_language, translation_status, translation_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(request_id, normalized_url) DO UPDATE SET
                query=excluded.query, title=excluded.title, url=excluded.url,
                snippet=excluded.snippet, content=excluded.content,
                provider=excluded.provider, collected_at=excluded.collected_at,
                title_vi=excluded.title_vi, snippet_vi=excluded.snippet_vi, content_vi=excluded.content_vi, source_language=excluded.source_language,
                translation_status=excluded.translation_status, translation_hash=excluded.translation_hash`,
            [randomUUID(), requestId, source.query, source.title, source.url, source.normalizedUrl,
                source.snippet, source.content, source.provider, source.collectedAt,
                source.titleVi ?? null, source.snippetVi ?? null, source.contentVi ?? null, source.sourceLanguage || 'unknown', source.translationStatus || 'pending', source.translationHash || null]);
        }
        await tx.run("UPDATE requests SET status = ?, updated_at = ? WHERE id = ?",
            [status, new Date().toISOString(), requestId]);
    });
    return getSourcesByRequestId(requestId);
}
async function createSource(requestId, source) { return createSources(requestId, [source]); }
async function deleteSourcesByRequestId(requestId) {
    return database.run("DELETE FROM sources WHERE request_id = ?", [requestId]);
}
module.exports = { createSource, createSources, getSourcesByRequestId, deleteSourcesByRequestId };
