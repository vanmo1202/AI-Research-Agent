const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const db = require('../src/config/database');
const runs = require('../src/services/run.service');
const memory = require('../src/knowledge/memory');
let server, base, owner, other;
const key = 'fixture-service-key-not-a-live-secret';
before(async () => {
  Object.assign(process.env, { INTERNAL_API_KEY:key, MOCK_LLM:'true', MOCK_SEARCH:'true', MOCK_RAG:'true', MOCK_REPORT:'true' });
  await db.initializeDatabase();
  owner=randomUUID(); other=randomUUID(); process.env.INTERNAL_RESEARCH_USER_ID=owner;
  for (const user of [owner,other]) await db.run("INSERT INTO users(id,email,name,password_hash,created_at,updated_at) VALUES($1,$2,'Automation fixture','unused',now(),now())",[user,user+'@test.invalid']);
  server=require('../src/server').app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{if(server) await new Promise(resolve=>server.close(resolve)); await db.close();});
async function call(path,method='GET',body,headers={}) {
  const response=await fetch(base+path,{method,headers:{'X-Internal-Api-Key':key,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,body:await response.json()};
}
async function request(user=owner) {
  const id=randomUUID();
  await db.run("INSERT INTO requests(id,owner_id,topic,goal,status,created_at,updated_at) VALUES($1,$2,'Automation isolation','Check owner boundary','created',now(),now())",[id,user]);
  return id;
}
async function run(user=owner) { return runs.create(await request(user),{orchestration:'n8n',searchMore:false},randomUUID()); }
async function staleCandidate(user, checked=null) {
  const id=randomUUID(), content='Missing source must be checked without leaking this text '+id;
  await db.run("INSERT INTO agent_memories(id,owner_id,kind,content,content_hash,status,last_checked_at,created_at,updated_at) VALUES($1,$2,'research',$3,$4,'verified',$5,now(),now())",[id,user,content,createHash('sha256').update(content).digest('hex'),checked]);
  return id;
}
test('WF01 configured service identity cannot create/read/resume another user research',async()=>{
  const foreign=await run(other), count=(await db.get('SELECT count(*) AS n FROM research_runs')).n;
  assert.equal((await call(`/internal/research/${foreign.request_id}/runs`,'POST',{orchestration:'n8n',ownerId:other},{'Idempotency-Key':'foreign-create'})).status,404);
  assert.equal((await call(`/internal/research/${foreign.request_id}/runs/${foreign.id}/progress`)).status,404);
  assert.equal((await db.get('SELECT count(*) AS n FROM research_runs')).n,count);
});
test('WF01 dispatch/poll cannot release or read a foreign outbox',async()=>{
  const foreign=await run(other), job=(await require('../src/models/run.model').jobs(foreign.id))[0];
  assert.equal((await call(`/internal/runs/${foreign.id}/jobs`,'POST',{stage:'planning',ownerId:other},{'Idempotency-Key':job.idempotency_key})).status,404);
  assert.equal((await call(`/internal/jobs/${job.id}?runId=${foreign.id}`)).status,404);
  assert.equal((await db.get('SELECT status FROM dispatch_outbox WHERE job_id=$1',[job.id])).status,'pending');
});
test('WF01 missing/disabled automation user fails closed for all four endpoints',async()=>{
  const own=await run(), job=(await require('../src/models/run.model').jobs(own.id))[0];
  const endpoints=[
    [`/internal/research/${own.request_id}/runs`,'POST',{}, {'Idempotency-Key':randomUUID()}],
    [`/internal/research/${own.request_id}/runs/${own.id}/progress`],
    [`/internal/runs/${own.id}/jobs`,'POST',{stage:'planning'},{'Idempotency-Key':job.idempotency_key}],
    [`/internal/jobs/${job.id}?runId=${own.id}`],
  ];
  try {
    delete process.env.INTERNAL_RESEARCH_USER_ID;
    for(const args of endpoints) assert.equal((await call(...args)).status,503);
    process.env.INTERNAL_RESEARCH_USER_ID=owner;
    await db.run("UPDATE users SET status='disabled' WHERE id=$1",[owner]);
    for(const args of endpoints) assert.equal((await call(...args)).status,503);
  } finally {process.env.INTERNAL_RESEARCH_USER_ID=owner;await db.run("UPDATE users SET status='active' WHERE id=$1",[owner]);}
});
test('WF04 scopes maintenance to configured user and preserves array summary without content',async()=>{
  const own=await staleCandidate(owner), foreign=await staleCandidate(other);
  const result=await call('/internal/knowledge/maintenance','POST',{});
  assert.equal(result.status,200); assert.ok(Array.isArray(result.body.data));
  assert.equal((await db.get('SELECT status FROM agent_memories WHERE id=$1',[own])).status,'stale');
  assert.equal((await db.get('SELECT status FROM agent_memories WHERE id=$1',[foreign])).status,'verified');
  assert.deepEqual(Object.keys(result.body.data[0]).sort(),['checked','stale']);
  assert.ok(!JSON.stringify(result.body).includes('Missing source'));
  assert.deepEqual((await call('/internal/knowledge/status')).body.data.memories,[{status:'stale',count:1}]);
  delete process.env.INTERNAL_RESEARCH_USER_ID;
  try {
    assert.equal((await call('/internal/knowledge/maintenance','POST',{})).status,503);
    process.env.INTERNAL_RESEARCH_USER_ID=owner;
    await db.run("UPDATE users SET status='disabled' WHERE id=$1",[owner]);
    assert.equal((await call('/internal/knowledge/maintenance','POST',{})).status,503);
    assert.equal((await call('/internal/knowledge/status')).status,503);
  } finally {process.env.INTERNAL_RESEARCH_USER_ID=owner;await db.run("UPDATE users SET status='active' WHERE id=$1",[owner]);}
});
test('WF04 rolls back complete batch on PostgreSQL failure and safely retries',async()=>{
  const first=await staleCandidate(owner,'2000-01-01'), second=await staleCandidate(owner,'2001-01-01');
  await db.run(`CREATE FUNCTION fixture_reject_maintenance() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${second}' AND NEW.last_checked_at IS DISTINCT FROM OLD.last_checked_at THEN RAISE EXCEPTION 'fixture maintenance database failure'; END IF; RETURN NEW; END $$`);
  await db.run('CREATE TRIGGER fixture_reject_maintenance BEFORE UPDATE ON agent_memories FOR EACH ROW EXECUTE FUNCTION fixture_reject_maintenance()');
  await assert.rejects(memory.maintain(owner),/fixture maintenance database failure/);
  for(const id of [first,second]) assert.equal((await db.get('SELECT status FROM agent_memories WHERE id=$1',[id])).status,'verified');
  await db.run('ALTER TABLE agent_memories DISABLE TRIGGER fixture_reject_maintenance');
  assert.equal((await memory.maintain(owner)).stale,2);
  assert.equal((await memory.maintain(owner)).stale,0);
});

test('WF03 internal PDF RAG keeps citations, request/document ownership and concurrent token deduplication',async()=>{
  const requestId=await request(), documentId=randomUUID(), chunkId=randomUUID();
  const content='Automation isolation requires grounded PDF citations with reliable document evidence.';
  const sha=createHash('sha256').update(content).digest('hex');
  await db.run("INSERT INTO documents(id,owner_id,filename,storage_name,sha256,byte_size,status,page_count,created_at,updated_at) VALUES($1,$2,'fixture.pdf','fixture',$3,100,'ready',1,now(),now())",[documentId,owner,sha]);
  await db.run('INSERT INTO document_pages(document_id,page,content) VALUES($1,1,$2)',[documentId,content]);
  await db.run('INSERT INTO document_chunks(id,document_id,page,chunk_index,content,content_hash) VALUES($1,$2,1,0,$3,$4)',[chunkId,documentId,content,sha]);
  await db.run('INSERT INTO research_documents VALUES($1,$2,$3,now())',[requestId,documentId,owner]);
  const session=await require('../src/knowledge/chat').create(owner,requestId,{scope:'documents',documentIds:[documentId]});
  const payload={requestId,content:'Explain grounded PDF citations',clientToken:'pdf-turn'};
  const path=`/internal/knowledge/chats/${session.id}/messages`;
  const results=await Promise.all([call(path,'POST',payload),call(path,'POST',payload)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  const answer=results.find(r=>r.status===201).body.data;
  assert.equal(answer.citations[0].referenceId,chunkId);assert.equal(answer.citations[0].documentId,documentId);assert.equal(answer.citations[0].page,1);
  assert.ok(content.includes(answer.citations[0].quote));
  assert.equal((await db.get('SELECT count(*) AS n FROM chat_messages WHERE chat_id=$1',[session.id])).n,2);
  // A caller that lost the completed response may retry, but must not generate another turn.
  assert.equal((await call(path,'POST',payload)).status,409);
  assert.equal((await db.get('SELECT count(*) AS n FROM chat_messages WHERE chat_id=$1',[session.id])).n,2);
  const candidate=await db.get('SELECT status FROM agent_memories WHERE message_id=$1',[answer.id]);assert.equal(candidate.status,'candidate');
  assert.equal((await call(path,'POST',{...payload,requestId:await request(),clientToken:'wrong-request'})).status,404);
  const foreignDoc=randomUUID();
  await db.run("INSERT INTO documents(id,owner_id,filename,storage_name,sha256,byte_size,status,created_at,updated_at) VALUES($1,$2,'private.pdf','private','foreign',1,'ready',now(),now())",[foreignDoc,other]);
  await db.run('UPDATE chat_sessions SET document_ids_json=$1 WHERE id=$2',[JSON.stringify([foreignDoc]),session.id]);
  assert.equal((await call(path,'POST',{...payload,clientToken:'wrong-document'})).status,404);
});
test('WF03 provider timeout leaves one failed turn; same-token retry cannot duplicate it or leak secrets',async()=>{
  const requestId=await request(), documentId=randomUUID(), chunkId=randomUUID(),content='Automation isolation timeout document citations require grounded document citations and valid source evidence.';
  const sha=createHash('sha256').update(content).digest('hex');
  await db.run("INSERT INTO documents(id,owner_id,filename,storage_name,sha256,byte_size,status,page_count,created_at,updated_at) VALUES($1,$2,'timeout.pdf','timeout',$3,100,'ready',1,now(),now())",[documentId,owner,sha]);
  await db.run('INSERT INTO document_pages(document_id,page,content) VALUES($1,1,$2)',[documentId,content]);
  await db.run('INSERT INTO document_chunks(id,document_id,page,chunk_index,content,content_hash) VALUES($1,$2,1,0,$3,$4)',[chunkId,documentId,content,sha]);
  await db.run('INSERT INTO research_documents VALUES($1,$2,$3,now())',[requestId,documentId,owner]);
  const session=await require('../src/knowledge/chat').create(owner,requestId,{scope:'documents',documentIds:[documentId]});
  const llm=require('../src/services/llm.service'),original=llm.generateJson,path=`/internal/knowledge/chats/${session.id}/messages`,payload={requestId,content:'Automation isolation timeout document citations',clientToken:'timeout-turn'};
  process.env.MOCK_LLM='false';llm.generateJson=async()=>{throw Object.assign(new Error('fixture-provider-secret-must-never-leak'),{name:'TimeoutError'});};
  try{
    const failed=await call(path,'POST',payload);assert.ok(failed.status>=500);assert.ok(!JSON.stringify(failed.body).includes('fixture-provider-secret'));
    assert.equal((await call(path,'POST',payload)).status,409);
    const messages=await require('../src/knowledge/chat').messages(session.id,owner);
    assert.equal(messages.length,2);assert.equal(messages.find(m=>m.role==='assistant').status,'failed');
  }finally{llm.generateJson=original;process.env.MOCK_LLM='true';}
});
