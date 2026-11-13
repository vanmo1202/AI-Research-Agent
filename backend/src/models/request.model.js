const database = require("../config/database");
async function create(request) {
    await database.run(`INSERT INTO requests
        (id, topic, goal, scope, output_length, status, created_at, updated_at, owner_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [request.id, request.topic, request.goal, request.scope, request.outputLength,
        request.status, request.createdAt, request.createdAt, request.ownerId || "workspace"]);
}
async function updateStatus(id, status) {
    await database.run("UPDATE requests SET status = $1, updated_at = $2 WHERE id = $3",
        [status, new Date().toISOString(), id]);
}
async function findById(id) {
    const row = await database.get("SELECT * FROM requests WHERE id = $1", [id]);
    if (!row) return null;
    return {
        requestId: row.id, topic: row.topic, goal: row.goal, scope: row.scope,
        outputLength: row.output_length, status: row.status,
        createdAt: row.created_at, updatedAt: row.updated_at
    };
}
module.exports = { create, updateStatus, findById };
