module.exports = async ({ transaction }) =>
  transaction(async (db) => {
    if (
      await db.get(
        "SELECT version FROM schema_migrations WHERE version='004-user-auth'",
      )
    )
      return;
    await db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL, password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    await db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL, revoked_at TEXT)`);
    await db.run(
      "CREATE INDEX IF NOT EXISTS sessions_user ON user_sessions(user_id,expires_at)",
    );
    const columns = await db.all("PRAGMA table_info(requests)");
    if (!columns.some((c) => c.name === "owner_id"))
      await db.run(
        "ALTER TABLE requests ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'workspace'",
      );
    await db.run(
      "CREATE INDEX IF NOT EXISTS requests_owner ON requests(owner_id,created_at)",
    );
    await db.run("INSERT INTO schema_migrations VALUES(?,?)", [
      "004-user-auth",
      new Date().toISOString(),
    ]);
  });
