const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const { Transform } = require("node:stream");
const Busboy = require("busboy");
const { db, now, fail, check, document } = require("./common");
const { positiveInteger } = require("../utils/settings");
const root = () =>
  path.resolve(
    process.env.DOCUMENT_STORAGE_PATH ||
      path.join(__dirname, "../../data/documents"),
  );
const maxBytes = () => positiveInteger("DOCUMENT_MAX_MB", 20, 20) * 1024 * 1024;
function storagePath(name) {
  check(
    /^[a-f0-9-]{36}\.(pdf|upload)$/.test(name),
    "Invalid storage reference",
    400,
  );
  return path.join(root(), name);
}
function publicDoc(row) {
  const { storage_name, owner_id, ...safe } = row;
  return safe;
}
function validFilename(name) {
  check(
    typeof name === "string" &&
      name.length <= 180 &&
      !/[\x00-\x1f\x7f/\\]/.test(name) &&
      !name.includes("..") &&
      /\.pdf$/i.test(name),
    "Invalid PDF filename",
  );
  return name.normalize("NFC");
}
let uploads = 0;
async function upload(req, owner) {
  check(uploads < 2, "Upload capacity exceeded", 429);
  uploads++;
  const name = `${randomUUID()}.pdf`,
    target = storagePath(name);
  let retained = false;
  try {
    await fsp.mkdir(root(), { recursive: true, mode: 0o700 });
    let parser;
    try {
      parser = Busboy({
        headers: req.headers,
        preservePath: true,
        defParamCharset: "utf8",
        limits: { fileSize: maxBytes(), files: 1, fields: 0, parts: 2 },
      });
    } catch {
      throw fail("Expected multipart/form-data with one PDF");
    }
    let filename, fileTask, fault;
    const digest = createHash("sha256");
    let size = 0;
    let signature = Buffer.alloc(0);
    const bad = (e) => {
      fault ||= e;
    };
    parser.on("file", (field, stream, info) => {
      try {
        check(
          field === "file" && info.mimeType === "application/pdf",
          "Only application/pdf is supported",
        );
        filename = validFilename(info.filename);
      } catch (e) {
        bad(e);
        stream.resume();
        return;
      }
      stream.on("limit", () => bad(fail("PDF exceeds size limit", 413)));
      const meter = new Transform({
        transform(chunk, enc, cb) {
          size += chunk.length;
          digest.update(chunk);
          if (signature.length < 5)
            signature = Buffer.concat([signature, chunk]).subarray(0, 5);
          cb(null, chunk);
        },
      });
      fileTask = pipeline(
        stream,
        meter,
        fs.createWriteStream(target, { flags: "wx", mode: 0o600 }),
      ).catch(bad);
    });
    for (const event of ["filesLimit", "fieldsLimit", "partsLimit"])
      parser.on(event, () => bad(fail("Exactly one PDF file is required")));
    const abort = () => parser.destroy(fail("Upload aborted"));
    const timer = setTimeout(abort, 60000);
    req.once("aborted", abort);
    try {
      await pipeline(req, parser);
    } catch (e) {
      bad(e.status ? e : fail("Malformed upload"));
    } finally {
      clearTimeout(timer);
      req.off("aborted", abort);
    }
    await fileTask;
    if (fault) throw fault;
    check(
      filename && size > 5 && signature.toString() === "%PDF-",
      "Invalid PDF signature",
    );
    const sha = digest.digest("hex");
    const result = await db.transaction(async (tx) => {
      const duplicate = await tx.get(
        "SELECT * FROM documents WHERE owner_id=$1 AND sha256=$2 AND deleted_at IS NULL",
        [owner, sha],
      );
      if (duplicate) return { document: publicDoc(duplicate), duplicate: true };
      const quota = await tx.get(
        "SELECT COUNT(*) AS n,COALESCE(SUM(byte_size),0) AS bytes FROM documents WHERE deleted_at IS NULL",
      );
      check(
        quota.n < 200 && quota.bytes + size <= 1024 * 1024 * 1024,
        "Workspace storage quota reached",
        413,
      );
      const id = randomUUID(),
        jobId = randomUUID(),
        time = now();
      await tx.run(
        "INSERT INTO documents(id,owner_id,filename,storage_name,sha256,byte_size,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,'pending',$7,$8)",
        [id, owner, filename, name, sha, size, time, time],
      );
      await tx.run(
        "INSERT INTO document_ingestion_jobs(id,document_id,status,created_at,updated_at) VALUES($1,$2,'pending',$3,$4)",
        [jobId, id, time, time],
      );
      return {
        document: publicDoc(
          await tx.get("SELECT * FROM documents WHERE id=$1", [id]),
        ),
        jobId,
        duplicate: false,
      };
    });
    retained = !result.duplicate;
    return result;
  } finally {
    uploads--;
    if (!retained) await fsp.unlink(target).catch(() => {});
  }
}
async function retry(id, owner) {
  await document(id, owner);
  return db.transaction(async (tx) => {
    const doc = await tx.get(
      "SELECT * FROM documents WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL",
      [id, owner],
    );
    check(
      doc?.status === "failed",
      "Only failed ingestion can be retried",
      409,
    );
    const jobId = randomUUID(),
      time = now();
    await tx.run(
      "UPDATE documents SET status='pending',error_code=NULL,updated_at=$1 WHERE id=$2",
      [time, id],
    );
    await tx.run(
      "INSERT INTO document_ingestion_jobs(id,document_id,status,created_at,updated_at) VALUES($1,$2,'pending',$3,$4)",
      [jobId, id, time, time],
    );
    return { jobId, status: "pending" };
  });
}
async function remove(id, owner) {
  const doc = await document(id, owner);
  await db.transaction(async (tx) => {
    await tx.run(
      "UPDATE documents SET deleted_at=$1,updated_at=$2 WHERE id=$3 AND owner_id=$4",
      [now(), now(), id, owner],
    );
    await tx.run(
      "UPDATE document_ingestion_jobs SET status='failed',error_code='DOCUMENT_DELETED',lease_until=NULL WHERE document_id=$1 AND status IN ('pending','processing')",
      [id],
    );
    await tx.run("DELETE FROM research_documents WHERE document_id=$1", [id]);
    await tx.run("DELETE FROM document_pages WHERE document_id=$1", [id]);
  });
  await fsp.unlink(storagePath(doc.storage_name)).catch((e) => {
    if (e.code !== "ENOENT")
      console.error("[Knowledge] Tombstoned PDF needs storage cleanup");
  });
}
module.exports = {
  upload,
  retry,
  remove,
  root,
  storagePath,
  publicDoc,
  validFilename,
  maxBytes,
};
