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
  const db = require("./sqlite-database.cjs");
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
      `SELECT 1 FROM research_documents d JOIN requests r ON r.id=d.request_id JOIN documents p ON p.id=d.document_id WHERE d.owner_id<>r.owner_id OR d.owner_id<>p.owner_id
       UNION ALL SELECT 1 FROM chat_sessions c JOIN requests r ON r.id=c.request_id WHERE c.owner_id<>r.owner_id
       UNION ALL SELECT 1 FROM agent_memories m JOIN requests r ON r.id=m.request_id WHERE m.owner_id<>r.owner_id
       UNION ALL SELECT 1 FROM agent_memories m JOIN chat_messages v ON v.id=m.message_id JOIN chat_sessions c ON c.id=v.chat_id WHERE m.owner_id<>c.owner_id OR m.request_id<>c.request_id
       UNION ALL SELECT 1 FROM memory_evidence_links l JOIN agent_memories m ON m.id=l.memory_id JOIN documents d ON d.id=l.document_id WHERE m.owner_id<>d.owner_id
       UNION ALL SELECT 1 FROM memory_evidence_links l JOIN agent_memories m ON m.id=l.memory_id JOIN sources s ON s.id=l.source_id JOIN requests r ON r.id=s.request_id WHERE m.owner_id<>r.owner_id LIMIT 1`,
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
