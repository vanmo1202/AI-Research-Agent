const {test,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
process.env.RESEARCH_DB_PATH=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'pg-verify-readonly-')),'source.db');
const legacy=require('./legacy/sqlite-database.cjs'),db=require('../src/config/database');
const {importSqlite}=require('../scripts/migration/import-sqlite.cjs');
after(()=>db.close());
test('verify-only never initializes or migrates a PostgreSQL target',async()=>{
 await legacy.initializeDatabase();
 await assert.rejects(importSqlite(process.env.RESEARCH_DB_PATH,{verifyOnly:true}));
 const row=await db.get('SELECT to_regclass($1) AS name',[process.env.PGSCHEMA+'.postgres_schema_migrations']);
 assert.equal(row.name,null,'A verification request must not create schema tracking or apply DDL');
});
test('read-only verification transactions reject writes on the same checked-out client',async()=>{
 await db.initializeDatabase();
 await assert.rejects(db.transaction(async tx=>{
  assert.equal((await tx.get("SELECT current_setting('transaction_read_only') AS value")).value,'on');
  assert.equal((await db.get("SELECT current_setting('transaction_isolation') AS value")).value,'repeatable read');
  await tx.run("INSERT INTO requests(id,topic,goal) VALUES('unexpected','x','x')");
 },{readOnly:true}),e=>e.code==='25006');
 assert.equal((await db.get('SELECT count(*) AS n FROM requests')).n,0);
});
