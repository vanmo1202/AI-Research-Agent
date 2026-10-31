const fs = require("node:fs");
try {
  const stamp = fs.statSync("/tmp/research-worker-heartbeat");
  process.exit(Date.now() - stamp.mtimeMs < 45000 ? 0 : 1);
} catch {
  process.exit(1);
}
