require("../config/environment").loadEnvironment();
const { initializeDatabase, close } = require("../config/database");
const { runOnce } = require("./runner");
const { randomUUID } = require("node:crypto");
const owner = `worker-${process.pid}-${randomUUID()}`;
let stopping = false;
const abort = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    stopping = true;
    abort.abort();
  });
(async () => {
  await initializeDatabase();
  const beat = () =>
    require("node:fs").writeFileSync(
      "/tmp/research-worker-heartbeat",
      String(Date.now()),
    );
  beat();
  setInterval(beat, 10000).unref();
  const knowledgeLoop = (async () => {
    while (!stopping) {
      try {
        if (!(await require("../knowledge/ingestion").runOnce()))
          await new Promise((resolve) => setTimeout(resolve, 750));
      } catch {
        console.error("[Knowledge] Ingestion queue unavailable; retrying");
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  })();
  while (!stopping) {
    try {
      if (!(await runOnce({ owner, signal: abort.signal })))
        await new Promise((r) => setTimeout(r, 750));
    } catch {
      console.error("[Worker] Database unavailable; retrying");
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  await knowledgeLoop;
  await close();
  process.exit(0);
})().catch(() => {
  console.error("[Worker] Startup failed");
  process.exit(1);
});
