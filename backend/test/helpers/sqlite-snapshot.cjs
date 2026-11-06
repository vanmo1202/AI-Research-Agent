const { createHash } = require('node:crypto');

// Read the same committed metadata through either the app queue or a separate connection.
async function snapshot(db, requestId) {
  const databases = await db.all('PRAGMA database_list');
  const journal = await db.get('PRAGMA journal_mode');
  const count = await db.get('SELECT COUNT(*) AS count FROM sources WHERE request_id=?', [requestId]);
  const request = await db.get('SELECT status,owner_id FROM requests WHERE id=?', [requestId]);
  const sources = await db.all('SELECT id,normalized_url,content FROM sources WHERE request_id=? ORDER BY id', [requestId]);
  return {
    databasePath: databases.find(database => database.name === 'main')?.file,
    journalMode: journal.journal_mode,
    count: count.count,
    request,
    sources: sources.map(source => ({
      id: source.id,
      normalizedUrl: source.normalized_url,
      contentHash: createHash('sha256').update(source.content || '').digest('hex'),
    })),
  };
}

async function readOnlySnapshot(databasePath, requestId) {
  const sqlite3 = require('sqlite3');
  const connection = await new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath, sqlite3.OPEN_READONLY, error => error ? reject(error) : resolve(db));
  });
  connection.configure('busyTimeout', 5000);
  const query = method => (sql, params = []) => new Promise((resolve, reject) => {
    connection[method](sql, params, (error, result) => error ? reject(error) : resolve(result));
  });
  try {
    return await snapshot({ get: query('get'), all: query('all') }, requestId);
  } finally {
    await new Promise((resolve, reject) => connection.close(error => error ? reject(error) : resolve()));
  }
}

if (require.main === module) {
  readOnlySnapshot(process.argv[2], process.argv[3]).then(result => {
    process.stdout.write(JSON.stringify(result) + '\n');
  }).catch(error => {
    console.error(`${error.code || 'SQLITE_READ_FAILED'}: ${error.message}`);
    process.exitCode = 1;
  });
}
module.exports = { snapshot };
