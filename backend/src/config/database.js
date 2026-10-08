const fs = require("node:fs");
const path = require("node:path");
const sqlite3 = require("sqlite3").verbose();

// Đường dẫn cố định theo thư mục backend, không phụ thuộc nơi chạy lệnh.
const databasePath = process.env.RESEARCH_DB_PATH || path.join(__dirname, "../../data/research.db");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new sqlite3.Database(databasePath);
db.configure("busyTimeout", 5000);

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (error) {
            if (error) return reject(error);
            resolve({ id: this.lastID, changes: this.changes });
        });
    });
}
function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
    });
}
function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
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
}
module.exports = { run, get, all, initializeDatabase };
