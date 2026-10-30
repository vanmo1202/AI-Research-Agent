const fs = require("node:fs");
const path = require("node:path");
const sqlite3 = require("sqlite3").verbose();

// Đường dẫn cố định theo thư mục backend, không phụ thuộc nơi chạy lệnh.
const databasePath = process.env.RESEARCH_DB_PATH || path.join(__dirname, "../../data/research.db");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new sqlite3.Database(databasePath);
db.configure("busyTimeout", 5000);

function rawRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (error) {
            if (error) return reject(error);
            resolve({ id: this.lastID, changes: this.changes });
        });
    });
}
function rawGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
    });
}
function rawAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
    });
}
// Một hàng đợi chung tránh truy vấn khác xen vào transaction trên cùng connection.
let pending = Promise.resolve();
function enqueue(task) {
    const result = pending.then(task);
    pending = result.catch(() => {});
    return result;
}
const run = (sql, params = []) => enqueue(() => rawRun(sql, params));
const get = (sql, params = []) => enqueue(() => rawGet(sql, params));
const all = (sql, params = []) => enqueue(() => rawAll(sql, params));
function transaction(work) {
    return enqueue(async () => {
        await rawRun("BEGIN IMMEDIATE");
        try {
            const result = await work({ run: rawRun, get: rawGet, all: rawAll });
            await rawRun("COMMIT");
            return result;
        } catch (error) {
            await rawRun("ROLLBACK");
            throw error;
        }
    });
}
async function initializeDatabase() {
    await run("PRAGMA foreign_keys = ON");
    await run(`CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY, topic TEXT NOT NULL, goal TEXT NOT NULL,
        scope TEXT, output_length TEXT, status TEXT,
        created_at TEXT, updated_at TEXT
    )`);
    await run(`CREATE TABLE IF NOT EXISTS plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL REFERENCES requests(id),
        question_id TEXT NOT NULL, research_question TEXT NOT NULL,
        search_query TEXT NOT NULL, created_at TEXT
    )`);
    await run("CREATE INDEX IF NOT EXISTS plans_request_id ON plans(request_id)");
    await run(`CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL REFERENCES requests(id),
        query TEXT NOT NULL, title TEXT, url TEXT NOT NULL,
        normalized_url TEXT NOT NULL, snippet TEXT, content TEXT, provider TEXT,
        collected_at TEXT NOT NULL,
        UNIQUE(request_id, normalized_url)
    )`);
    const sourceColumns = new Set((await all("PRAGMA table_info(sources)")).map(column => column.name));
    for (const column of ["title_vi", "snippet_vi", "content_vi", "source_language", "translation_status", "translation_hash"]) {
        if (!sourceColumns.has(column)) await run(`ALTER TABLE sources ADD COLUMN ${column} TEXT`);
    }
    await run(`CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY, request_id TEXT NOT NULL, source_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL, content TEXT NOT NULL, char_count INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id), FOREIGN KEY (source_id) REFERENCES sources(id),
        UNIQUE(source_id, chunk_index)
    )`);
    await run(`CREATE TABLE IF NOT EXISTS evidence (
        id TEXT PRIMARY KEY, request_id TEXT NOT NULL, source_id TEXT NOT NULL,
        chunk_id TEXT, research_question TEXT, evidence_text TEXT NOT NULL,
        relevance_score REAL, reason TEXT, citation_label TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id), FOREIGN KEY (source_id) REFERENCES sources(id),
        FOREIGN KEY (chunk_id) REFERENCES chunks(id)
    )`);
    await run(`CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, title TEXT,
        language TEXT DEFAULT 'vi', style TEXT, output_length TEXT, content TEXT NOT NULL,
        references_json TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id)
    )`);
    await run(`CREATE TABLE IF NOT EXISTS evidence_cache (
        request_id TEXT NOT NULL REFERENCES requests(id), question_id TEXT NOT NULL,
        input_hash TEXT NOT NULL, evidence_json TEXT NOT NULL,
        PRIMARY KEY(request_id, question_id, input_hash)
    )`);
    await run(`CREATE TABLE IF NOT EXISTS analysis_results (
        request_id TEXT PRIMARY KEY REFERENCES requests(id), metadata_json TEXT NOT NULL
    )`);
    await run("CREATE INDEX IF NOT EXISTS idx_chunks_request_id ON chunks(request_id)");
    await run("CREATE INDEX IF NOT EXISTS idx_chunks_source_id ON chunks(source_id)");
    await run("CREATE INDEX IF NOT EXISTS idx_evidence_request_id ON evidence(request_id)");
    await run("CREATE INDEX IF NOT EXISTS idx_evidence_source_id ON evidence(source_id)");
}
module.exports = { run, get, all, transaction, initializeDatabase };
