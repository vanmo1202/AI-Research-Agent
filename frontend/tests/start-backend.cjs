// Legacy API E2E must never initialize the serving PostgreSQL database.
// Use the mock-only rebuild suite when isolated database initialization is not authorized.
if (
  !/^researchos_(?:migration_test|test_)/.test(process.env.PGDATABASE || '') ||
  !/^test_[a-z0-9_]+$/.test(process.env.PGSCHEMA || '')
) {
  console.error(
    'BLOCKED: legacy E2E requires an explicitly isolated PostgreSQL test database and PGSCHEMA test_*. No database was initialized. Run the mock-only rebuild suite instead.',
  );
  process.exit(1);
}
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-research-browser-'));
process.env.DOCUMENT_STORAGE_PATH = path.join(directory, 'documents');
process.env.RESEARCH_LOAD_ENV = 'false';
const { start } = require('../../backend/src/server');
start().then((server) => {
  const { runOnce } = require('../../backend/src/workers/runner');
  let stopped = false;
  async function tick() {
    if (stopped) return;
    try {
      await Promise.all([runOnce(), require('../../backend/src/knowledge/ingestion').runOnce()]);
    } catch {}
    if (!stopped) setTimeout(tick, 100);
  }
  tick();
  function stop() {
    stopped = true;
    server.close(() => {
      // Chỉ xóa database trong thư mục tạm vừa tạo cho test này.
      fs.rmSync(directory, { recursive: true, force: true });
      process.exit(0);
    });
  }
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
});
