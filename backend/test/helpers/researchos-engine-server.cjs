// Explicitly isolated fixture service for n8n CLI engine checks; never production.
const fs=require('node:fs'),{randomUUID}=require('node:crypto');
if(!/^researchos_(migration_test|test_)/.test(process.env.PGDATABASE||''))throw Error('Test database required');
Object.assign(process.env,{PGSCHEMA:'engine_'+randomUUID().replaceAll('-',''),MOCK_LLM:'true',MOCK_SEARCH:'true',MOCK_RAG:'true',MOCK_REPORT:'true',RESEARCH_LOAD_ENV:'false',INTERNAL_API_KEY:'fixture-engine-internal-key'});
const db=require('../../src/config/database');
(async()=>{
 await db.getPool().query('CREATE SCHEMA '+process.env.PGSCHEMA);await db.initializeDatabase();
 const owner=randomUUID(),requestId=randomUUID(),doc=randomUUID(),job=randomUUID();process.env.INTERNAL_RESEARCH_USER_ID=owner;
 await db.run("INSERT INTO users(id,email,name,password_hash,created_at,updated_at) VALUES($1,$2,'Engine fixture','unused',now(),now())",[owner,owner+'@test.invalid']);
 await db.run("INSERT INTO requests(id,owner_id,topic,goal,status,created_at,updated_at) VALUES($1,$2,'Engine integration','Verify six-stage orchestration','created',now(),now())",[requestId,owner]);
 await db.run("INSERT INTO documents(id,owner_id,filename,storage_name,sha256,byte_size,status,created_at,updated_at) VALUES($1,$2,'fixture.pdf','fixture','hash',1,'ready',now(),now())",[doc,owner]);
 await db.run("INSERT INTO document_ingestion_jobs(id,document_id,status,created_at,updated_at) VALUES($1,$2,'ready',now(),now())",[job,doc]);
 const chat=await require('../../src/knowledge/chat').create(owner,requestId,{scope:'research'});
 const schedule=await require('../../src/schedules/service').create(owner,{requestId,enabled:true});
 const server=require('../../src/server').app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 fs.writeFileSync(process.env.ENGINE_CONTEXT_PATH,JSON.stringify({base:'http://127.0.0.1:'+server.address().port,requestId,documentId:doc,jobId:job,chatId:chat.id,scheduleId:schedule.scheduleId,schema:process.env.PGSCHEMA}));
 let busy=false;const timer=setInterval(async()=>{if(busy)return;busy=true;try{await require('../../src/workers/runner').runOnce();}finally{busy=false;}},100);
 process.on('SIGTERM',()=>{clearInterval(timer);server.close(async()=>{await db.close();process.exit(0)});});
 console.log('Isolated PostgreSQL fixture server ready');
})().catch(e=>{console.error(e.code||e.message);process.exit(1)});
