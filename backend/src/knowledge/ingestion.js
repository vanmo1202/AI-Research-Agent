const { fork } = require("node:child_process");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { db, hash, now, check, fail } = require("./common");
const { storagePath } = require("./documents");
const { splitContent } = require("../services/chunk.service");
const { positiveInteger } = require("../utils/settings");
const LEASE = 90000;
function parse(file) {
  return new Promise((resolve, reject) => {
    const child = fork(
      path.join(__dirname, "pdf-child.cjs"),
      [file, String(positiveInteger("DOCUMENT_MAX_PAGES", 100, 100))],
      {
        execArgv: ["--max-old-space-size=192"],
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      },
    );
    let settled = false;
    const done = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill("SIGKILL");
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(
      () => done(fail("PDF parsing timed out", 422, "PDF_TIMEOUT")),
      45000,
    );
    // Drain diagnostics without leaking PDF text or paths into logs.
    child.stderr.resume();
    child.once("error", () =>
      done(fail("Parser unavailable", 503, "PARSER_UNAVAILABLE")),
    );
    child.once("exit", () =>
      done(fail("PDF parser exited", 422, "INVALID_PDF")),
    );
    child.once("message", (value) =>
      value?.error
        ? done(
            fail(
              "PDF cannot be indexed",
              422,
              /^[A-Z_]{1,40}$/.test(value.error) ? value.error : "INVALID_PDF",
            ),
          )
        : Array.isArray(value?.pages)
          ? done(null, value.pages)
          : done(fail("Invalid parser result", 422, "INVALID_PDF")),
    );
  });
}
async function claim() {
  return db.transaction(async (tx) => {
    const expired = await tx.all(
      "SELECT * FROM document_ingestion_jobs WHERE status='processing' AND lease_until<$1",
      [Date.now()],
    );
    for (const job of expired) {
      const status = job.attempts < 3 ? "pending" : "failed";
      await tx.run(
        "UPDATE document_ingestion_jobs SET status=$1,lease_until=NULL,error_code=$2,updated_at=$3 WHERE id=$4",
        [status, "LEASE_EXPIRED", now(), job.id],
      );
      await tx.run(
        "UPDATE documents SET status=$1,error_code=$2,updated_at=$3 WHERE id=$4 AND deleted_at IS NULL",
        [status, "LEASE_EXPIRED", now(), job.document_id],
      );
    }
    if (
      await tx.get(
        "SELECT id FROM document_ingestion_jobs WHERE status='processing'",
      )
    )
      return null;
    const job = await tx.get(
      "SELECT j.* FROM document_ingestion_jobs j JOIN documents d ON d.id=j.document_id WHERE j.status='pending' AND d.deleted_at IS NULL ORDER BY j.created_at,j.legacy_position LIMIT 1",
    );
    if (!job) return null;
    await tx.run(
      "UPDATE document_ingestion_jobs SET status='processing',attempts=attempts+1,generation=generation+1,lease_until=$1,updated_at=$2 WHERE id=$3",
      [Date.now() + LEASE, now(), job.id],
    );
    await tx.run(
      "UPDATE documents SET status='processing',error_code=NULL,updated_at=$1 WHERE id=$2",
      [now(), job.document_id],
    );
    return { ...job, generation: job.generation + 1 };
  });
}
async function runOnce() {
  const job = await claim();
  if (!job) return false;
  console.info("[Knowledge] Ingestion started", job.id);
  try {
    const doc = await db.get("SELECT * FROM documents WHERE id=$1", [
      job.document_id,
    ]);
    const pages = await parse(storagePath(doc.storage_name));
    const chunks = pages.flatMap((p) =>
      splitContent(p.content, 1200, 160, 250).map((content, index) => ({
        id: randomUUID(),
        page: p.page,
        index,
        content,
        hash: hash(content),
      })),
    );
    check(chunks.length <= 2500, "Too many chunks", 422);
    await db.transaction(async (tx) => {
      const owned = await tx.get(
        "SELECT j.id FROM document_ingestion_jobs j JOIN documents d ON d.id=j.document_id WHERE j.id=$1 AND j.generation=$2 AND j.status='processing' AND j.lease_until>$3 AND d.deleted_at IS NULL",
        [job.id, job.generation, Date.now()],
      );
      if (!owned) throw fail("Ingestion lease lost", 409, "LEASE_EXPIRED");
      await tx.run("DELETE FROM document_pages WHERE document_id=$1", [doc.id]);
      for (const p of pages)
        await tx.run("INSERT INTO document_pages VALUES($1,$2,$3)", [
          doc.id,
          p.page,
          p.content,
        ]);
      for (const c of chunks)
        await tx.run("INSERT INTO document_chunks VALUES($1,$2,$3,$4,$5,$6)", [
          c.id,
          doc.id,
          c.page,
          c.index,
          c.content,
          c.hash,
        ]);
      await tx.run(
        "UPDATE documents SET status='ready',page_count=$1,error_code=NULL,updated_at=$2 WHERE id=$3",
        [pages.length, now(), doc.id],
      );
      await tx.run(
        "UPDATE document_ingestion_jobs SET status='ready',lease_until=NULL,error_code=NULL,updated_at=$1 WHERE id=$2",
        [now(), job.id],
      );
    });
    console.info("[Knowledge] Ingestion complete", job.id);
  } catch (e) {
    const code = /^[A-Z_]{1,40}$/.test(e.code || "")
      ? e.code
      : "INGESTION_FAILED";
    await db.transaction(async (tx) => {
      const result = await tx.run(
        "UPDATE document_ingestion_jobs SET status='failed',error_code=$1,lease_until=NULL,updated_at=$2 WHERE id=$3 AND generation=$4 AND status='processing'",
        [code, now(), job.id, job.generation],
      );
      if (result.changes)
        await tx.run(
          "UPDATE documents SET status='failed',error_code=$1,updated_at=$2 WHERE id=$3 AND deleted_at IS NULL",
          [code, now(), job.document_id],
        );
    });
    console.error("[Knowledge] Ingestion failed", job.id, code);
  }
  return true;
}
module.exports = { runOnce, claim, parse };
