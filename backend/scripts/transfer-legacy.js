// Run offline, after stopping backend and worker. No public ownership-claim API.
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
async function main() {
  process.umask(0o077);
  const [email, confirmation] = process.argv.slice(2);
  if (!email || confirmation !== "--transfer-all-workspace")
    throw new Error(
      "Usage: RESEARCH_DB_PATH=/absolute/research.db node scripts/transfer-legacy.js email --transfer-all-workspace (stop backend/worker first)",
    );
  if (
    !process.env.RESEARCH_DB_PATH ||
    !path.isAbsolute(process.env.RESEARCH_DB_PATH) ||
    !fs.existsSync(process.env.RESEARCH_DB_PATH)
  )
    throw new Error("Existing absolute RESEARCH_DB_PATH required");
  const db = require("../src/config/database");
  const user = await db.get(
    "SELECT id FROM users WHERE email=? COLLATE NOCASE AND status='active'",
    [email],
  );
  if (!user) throw new Error("Active target user not found");
  const backup = process.env.RESEARCH_DB_PATH + ".backup-" + randomUUID();
  // VACUUM INTO produces a consistent SQLite backup including committed WAL pages.
  await db.run("VACUUM INTO ?", [backup]);
  console.log("Backup:", backup);
  await db.transaction(async (tx) => {
    for (const table of [
      "requests",
      "documents",
      "research_documents",
      "chat_sessions",
      "agent_memories",
    ])
      await tx.run(
        `UPDATE ${table} SET owner_id=? WHERE owner_id='workspace'`,
        [user.id],
      );
    const invalid = await tx.get(
      `SELECT 1 FROM research_documents d JOIN requests r ON r.id=d.request_id JOIN documents p ON p.id=d.document_id WHERE d.owner_id<>r.owner_id OR d.owner_id<>p.owner_id LIMIT 1`,
    );
    if (invalid)
      throw new Error(
        "Ownership relationship mismatch; transaction rolled back",
      );
  });
  console.log(
    "Transferred legacy workspace to target user. PDF files were preserved.",
  );
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
