const {test,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'pg-import-'));
process.env.RESEARCH_DB_PATH=path.join(root,'legacy.db');
const old=require('./legacy/sqlite-database.cjs'),db=require('../src/config/database');
const {importSqlite}=require('../scripts/migration/import-sqlite.cjs');
after(()=>db.close());
test('read-only SQLite import preserves IDs/data, reconciles, replays and detects target drift',async()=>{
 await old.initializeDatabase();const now=new Date().toISOString();
 await old.run("INSERT INTO users(id,email,name,password_hash,created_at,updated_at) VALUES('legacy-owner','migration@example.test','Owner','preserved-hash',?,?)",[now,now]);
 await old.run("INSERT INTO requests(id,topic,goal,owner_id,created_at,updated_at) VALUES('opaque-research','chuyển đổi','preserve','legacy-owner',?,?)",[now,now]);
 await old.run("INSERT INTO chat_sessions(id,owner_id,request_id,title,scope,document_ids_json,created_at) VALUES('chat','legacy-owner','opaque-research','Original','research','[]',?)",[now]);
 await old.run("INSERT INTO chat_messages(id,chat_id,role,content,turn_id,status,created_at) VALUES('message','chat','user','Original message','turn','complete',?)",[now]);
 await old.run("INSERT INTO agent_memories(id,owner_id,request_id,message_id,kind,content,content_hash,status,created_at,updated_at) VALUES('memory','legacy-owner','opaque-research','message','research','preserved memory','hash','candidate',?,?)",[now,now]);
 await old.run('PRAGMA wal_checkpoint(TRUNCATE)');
 const snapshot=()=>crypto.createHash('sha256').update(fs.readFileSync(process.env.RESEARCH_DB_PATH)).digest('hex'),before=snapshot();
 const report=await importSqlite(process.env.RESEARCH_DB_PATH);assert.equal(report.verified,true);assert.equal(report.tables.chat_messages.count,1);
 assert.equal((await db.get("SELECT password_hash FROM users WHERE id='legacy-owner'")).password_hash,'preserved-hash');
 assert.equal((await db.get("SELECT content FROM chat_messages WHERE id='message'")).content,'Original message');
 assert.equal((await importSqlite(process.env.RESEARCH_DB_PATH)).replayed,true);
 assert.equal(snapshot(),before,'Importer must never write original SQLite');
 await db.run("UPDATE chat_messages SET content='corrupted target' WHERE id='message'");
 await assert.rejects(importSqlite(process.env.RESEARCH_DB_PATH,{verifyOnly:true}),/Reconciliation mismatch/);
 await db.run("UPDATE chat_messages SET content='Original message' WHERE id='message'");
 await old.run("CREATE TABLE unsupported_extra(id TEXT)");
 await assert.rejects(importSqlite(process.env.RESEARCH_DB_PATH),/Unmapped SQLite tables/);
});
test('import transaction rolls every inserted table back if the final artifact write fails',async()=>{
 await old.run('DROP TABLE unsupported_extra');
 const schema='test_import_rollback_'+Date.now();await db.getPool().query(`CREATE SCHEMA ${schema}`);await db.close();process.env.PGSCHEMA=schema;
 const original=db.transaction;
 db.transaction=work=>original(tx=>work({...tx,run:async(sql,params)=>{
  const result=await tx.run(sql,params);if(sql.startsWith('INSERT INTO "agent_memories"'))throw Error('injected import failure');return result;
 }}));
 try{await assert.rejects(importSqlite(process.env.RESEARCH_DB_PATH),/injected import failure/);}finally{db.transaction=original;}
 assert.equal((await db.get('SELECT count(*) AS n FROM users')).n,0);
 assert.equal((await db.get('SELECT count(*) AS n FROM chat_messages')).n,0);
 assert.equal((await db.get('SELECT count(*) AS n FROM sqlite_imports')).n,0);
});
