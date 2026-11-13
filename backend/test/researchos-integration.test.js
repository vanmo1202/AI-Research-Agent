const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const db=require('../src/config/database');
let server,base,owner,other;const key='fixture-internal-key-not-a-secret';
before(async()=>{
 process.env.INTERNAL_API_KEY=key;process.env.MOCK_LLM='true';process.env.MOCK_SEARCH='true';process.env.MOCK_RAG='true';process.env.MOCK_REPORT='true';
 await db.initializeDatabase();owner=randomUUID();other=randomUUID();process.env.INTERNAL_RESEARCH_USER_ID=owner;
 for(const id of [owner,other])await db.run("INSERT INTO users(id,email,name,password_hash,created_at,updated_at) VALUES($1,$2,'Fixture','disabled-password',now(),now())",[id,id+'@test.invalid']);
 server=require('../src/server').app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{if(server)await new Promise(r=>server.close(r));await db.close()});
async function call(path,method='GET',body,headers={}){const r=await fetch(base+path,{method,headers:{'X-Internal-Api-Key':key,'content-type':'application/json',...headers},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};}
async function request(user=owner){const id=randomUUID();await db.run("INSERT INTO requests(id,topic,goal,status,owner_id,created_at,updated_at) VALUES($1,'PostgreSQL research','Check traceability','created',$2,now(),now())",[id,user]);return id;}
test('WF01 uses backend-authoritative orchestration and progresses both modes through all stages',async()=>{
 const runner=require('../src/workers/runner');
 for(const mode of ['backend','n8n']){
  const id=await request(),created=await call('/internal/research/'+id+'/runs','POST',{orchestration:mode,searchMore:false},{'Idempotency-Key':randomUUID()});
  assert.equal(created.status,202);assert.equal(created.body.data.orchestration,mode);const run=created.body.data.runId;
  if(mode==='n8n')assert.equal(await runner.runOnce(),false);
  let stages=[];
  for(let i=0;i<15;i++){
   const p=(await call(`/internal/research/${id}/runs/${run}/progress`)).body.data;assert.equal(p.orchestration,mode);
   if(['completed','partial','failed','cancelled'].includes(p.status)){assert.ok(['completed','partial'].includes(p.status));stages=p.completedStages;break;}
   if(mode==='n8n')assert.equal((await call(`/internal/runs/${run}/jobs`,'POST',{stage:p.currentStage},{'Idempotency-Key':p.currentJob.idempotency_key})).status,202);
   await runner.runOnce();
  }
  assert.equal(stages.length,6);
 }
});
test('WF02 job observer enforces active automation user, owner and document ID',async()=>{
 const doc=randomUUID(),job=randomUUID();await db.run("INSERT INTO documents(id,owner_id,filename,storage_name,sha256,byte_size,status,created_at,updated_at) VALUES($1,$2,'fixture.pdf','fixture','hash',1,'pending',now(),now())",[doc,owner]);
 await db.run("INSERT INTO document_ingestion_jobs(id,document_id,status,created_at,updated_at) VALUES($1,$2,'pending',now(),now())",[job,doc]);
 for(const status of ['pending','processing','ready','failed']){await db.run('UPDATE document_ingestion_jobs SET status=$1 WHERE id=$2',[status,job]);assert.equal((await call(`/internal/knowledge/jobs/${job}?documentId=${doc}`)).body.data.status,status);}
 assert.equal((await call(`/internal/knowledge/jobs/${job}?documentId=${randomUUID()}`)).status,409);
 process.env.INTERNAL_RESEARCH_USER_ID=other;assert.equal((await call(`/internal/knowledge/jobs/${job}`)).status,404);process.env.INTERNAL_RESEARCH_USER_ID=owner;
 assert.equal((await call('/internal/knowledge/jobs/'+randomUUID())).status,404);
});
module.exports={call,request};
test('WF03 owner/token/insufficient evidence and WF04 repeatable stale maintenance',async()=>{
 const id=await request(),chat=require('../src/knowledge/chat'),s=await chat.create(owner,id,{scope:'research'});
 const payload={requestId:id,content:'Question without supporting evidence',clientToken:'same-token',ownerId:other};
 const first=await call(`/internal/knowledge/chats/${s.id}/messages`,'POST',payload);assert.equal(first.status,201);assert.equal(first.body.data.citations.length,0);
 assert.equal((await call(`/internal/knowledge/chats/${s.id}/messages`,'POST',payload)).status,409);
 process.env.INTERNAL_RESEARCH_USER_ID=other;assert.equal((await call(`/internal/knowledge/chats/${s.id}/messages`,'POST',{...payload,clientToken:'another'})).status,404);process.env.INTERNAL_RESEARCH_USER_ID=owner;
 await db.run("INSERT INTO agent_memories(id,owner_id,request_id,kind,content,content_hash,status,created_at,updated_at) VALUES('stale-fixture',$1,$2,'research','Source removed','stale-hash','verified',now(),now())",[owner,id]);
 const before=(await db.get("SELECT count(*) AS n FROM agent_memories WHERE status='verified'")).n;
 for(let i=0;i<2;i++)assert.equal((await call('/internal/knowledge/maintenance','POST',{})).status,200);
 assert.equal((await db.get("SELECT status FROM agent_memories WHERE id='stale-fixture'")).status,'stale');
 assert.ok((await db.get("SELECT count(*) AS n FROM agent_memories WHERE status='verified'")).n<=before);
});
test('WF05 HTTP endpoint requires configured owner, auth and canonical window key',async()=>{
 const service=require('../src/schedules/service'),id=await request(),s=await service.create(owner,{requestId:id,enabled:true});
 const body={scheduleId:s.scheduleId,windowKey:service.windowKey(),ownerId:other};
 assert.equal((await call('/internal/research/schedules/dispatch','POST',body)).status,400);
 const result=await call('/internal/research/schedules/dispatch','POST',body,{'Idempotency-Key':body.scheduleId+':'+body.windowKey});assert.equal(result.status,202);
 assert.equal((await db.get('SELECT owner_id FROM requests WHERE id=$1',[result.body.data.requestId])).owner_id,owner);
 assert.equal((await call('/internal/research/schedules/dispatch','POST',body,{'X-Internal-Api-Key':'wrong','Idempotency-Key':body.scheduleId+':'+body.windowKey})).status,401);
});

test('WF04 DB errors fail closed and WF03 never accepts unauthenticated automation',async t=>{
 const original=db.transaction;db.transaction=async()=>{throw new Error('fixture database unavailable')};
 try{const r=await call('/internal/knowledge/maintenance','POST',{});assert.equal(r.status,500);assert.equal(r.body.success,false);}finally{db.transaction=original;}
 const id=await request(),chat=await require('../src/knowledge/chat').create(owner,id,{scope:'research'});
 const r=await call(`/internal/knowledge/chats/${chat.id}/messages`,'POST',{requestId:id,content:'q',clientToken:'no-auth'},{'X-Internal-Api-Key':'incorrect'});assert.equal(r.status,401);
});
