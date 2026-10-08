const database = require("../config/database");
async function save(requestId, plan) {
    const questions = new Map(plan.researchQuestions.map(q => [q.id, q.question]));
    const createdAt = new Date().toISOString();
    const params = plan.searchQueries.flatMap(q =>
        [requestId, q.questionId, questions.get(q.questionId), q.query, createdAt]);
    // Một INSERT lưu toàn bộ plan: nếu lỗi thì không lưu dở một phần.
    const placeholders = plan.searchQueries.map(() => "(?, ?, ?, ?, ?)").join(", ");
    await database.run(`INSERT INTO plans
        (request_id, question_id, research_question, search_query, created_at)
        VALUES ${placeholders}`, params);
}
async function findByRequestId(requestId) {
    const rows = await database.all("SELECT * FROM plans WHERE request_id = ? ORDER BY id", [requestId]);
    const questions = new Map();
    for (const row of rows) questions.set(row.question_id, row.research_question);
    return {
        researchQuestions: [...questions].map(([id, question]) => ({ id, question })),
        searchQueries: rows.map(row => ({ questionId: row.question_id, query: row.search_query }))
    };
}
module.exports = { save, findByRequestId };
