const { randomUUID } = require("node:crypto");
const database = require("../config/database");
function fromRow(row) {
    return { id: row.id, query: row.query, title: row.title, url: row.url,
        normalizedUrl: row.normalized_url, snippet: row.snippet, content: row.content,
        provider: row.provider, collectedAt: row.collected_at };
}
async function getSourcesByRequestId(requestId) {
    return (await database.all("SELECT * FROM sources WHERE request_id = ? ORDER BY rowid", [requestId])).map(fromRow);
}
async function createSources(requestId, sources) {
    // UPSERT giữ id ổn định khi chạy lại Workflow 2; status cùng transaction.
    await database.transaction(async tx => {
        for (const source of sources) {
            await tx.run(`INSERT INTO sources
                (id, request_id, query, title, url, normalized_url, snippet, content, provider, collected_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(request_id, normalized_url) DO UPDATE SET
                query=excluded.query, title=excluded.title, url=excluded.url,
                snippet=excluded.snippet, content=excluded.content,
                provider=excluded.provider, collected_at=excluded.collected_at`,
            [randomUUID(), requestId, source.query, source.title, source.url, source.normalizedUrl,
                source.snippet, source.content, source.provider, source.collectedAt]);
        }
        await tx.run("UPDATE requests SET status = ?, updated_at = ? WHERE id = ?",
            ["collected", new Date().toISOString(), requestId]);
    });
    return getSourcesByRequestId(requestId);
}
async function createSource(requestId, source) { return createSources(requestId, [source]); }
async function deleteSourcesByRequestId(requestId) {
    return database.run("DELETE FROM sources WHERE request_id = ?", [requestId]);
}
module.exports = { createSource, createSources, getSourcesByRequestId, deleteSourcesByRequestId };
