const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-research-browser-'));
process.env.RESEARCH_DB_PATH = path.join(directory, 'research.db');
const { start } = require('../../backend/src/server');
start().then((server) => {
  function stop() {
    server.close(() => {
      // Chỉ xóa database trong thư mục tạm vừa tạo cho test này.
      fs.rmSync(directory, { recursive: true, force: true });
      process.exit(0);
    });
  }
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
});
