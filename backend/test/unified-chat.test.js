const {test}=require('node:test');const assert=require('node:assert/strict');
Object.assign(process.env,{RESEARCH_LOAD_ENV:'false',MOCK_LLM:'false',MOCK_SEARCH:'false',AUTO_CHAT_DAILY_GEMINI_LIMIT:'100'});
const db=require('../src/config/database'),chat=require('../src/knowledge/chat'),rc=require('../src/knowledge/research-context');
const llm=require('../src/services/llm.service'),search=require('../src/services/search.service'),content=require('../src/services/content.service');
const {hash,now}=require('../src/knowledge/common');
const text='Solar energy efficiency depends on irradiance and solar panel temperature. Photovoltaic solar energy research measures electricity conversion performance under controlled conditions.';
async function request(id,owner='alice',topic='Solar energy efficiency') {await db.run("INSERT INTO requests(id,owner_id,topic,goal,status,created_at) VALUES($1,$2,$3,'Explain mechanisms and assess evidence','created',$4)",[id,owner,topic,now()]);}
async function pdf(id,requestId,owner='alice',body=text,status='ready') {
 await db.run("INSERT INTO documents(id,owner_id,filename,storage_name,sha256,byte_size,page_count,status,created_at,updated_at) VALUES($1,$2,$3,'test.pdf',$4,100,1,$5,$6,$6)",[id,owner,id+'.pdf',hash(id),status,now()]);
 await db.run('INSERT INTO document_pages VALUES($1,1,$2)',[id,body]);await db.run('INSERT INTO document_chunks VALUES($1,$2,1,0,$3,$4)',[id+'-chunk',id,body,hash(body)]);
 await db.run('INSERT INTO research_documents VALUES($1,$2,$3,$4)',[requestId,id,owner,now()]);
}
function noNetwork(t){t.mock.method(global,'fetch',()=>assert.fail('No live provider calls'));}
function grounded(payload,type) {const c=payload.context.find(c=>!type||c.recordType===type);assert.ok(c);return {related:true,claims:[{text:'Solar performance depends on temperature.',citations:[{contextId:c.contextId,quote:c.content.includes(text)?text:c.content.slice(0,80)}]}]};}
test('research required; owned scope; explanation one Gemini/no Tavily; unrelated refused; history and WF01 unchanged',async t=>{
 await db.initializeDatabase();await request('solar');await request('other','bob');await request('own-other');noNetwork(t);
 await assert.rejects(chat.create('alice',null,{}),{status:409});await assert.rejects(chat.create('alice','other',{}),{status:404});
 const calls=[];t.mock.method(llm,'generateJson',async(prompt,payload)=>{calls.push(payload);return {related:true,content:'Photovoltaics convert solar energy to electricity.'};});
 t.mock.method(search,'searchWeb',()=>assert.fail('No Tavily for explanation or refusal'));
 const s=await chat.create('alice','solar',{});assert.equal(s.request_id,'solar');
 const before=(await db.get('SELECT COUNT(*) n FROM research_runs')).n;
 const answer=await chat.send(s.id,'alice',{content:'Explain photovoltaic solar energy efficiency',clientToken:'explain'});
 assert.equal(answer.research.strategy,'RESEARCH_EXPLANATION');assert.match(answer.content,/chưa phải kết quả/);assert.equal(calls.length,1);assert.equal(calls[0].research.topic,'Solar energy efficiency');
 await chat.send(s.id,'alice',{content:'Cho ví dụ dễ hiểu hơn',clientToken:'follow'});assert.equal(calls.length,2);assert.ok(calls[1].history[0].content.includes('photovoltaic'));
 const refused=await chat.send(s.id,'alice',{content:'Viết bài thơ tình yêu',clientToken:'outside'});assert.equal(refused.research.outcome,'out_of_scope');assert.equal(calls.length,2);
 await assert.rejects(chat.messages(s.id,'bob'),{status:404});assert.equal((await chat.messages(s.id,'alice')).length,6);
 assert.equal((await db.get('SELECT COUNT(*) n FROM research_runs')).n,before);
 await assert.rejects(chat.send(s.id,'alice',{content:'Cho ví dụ',clientToken:'follow'}),{status:409});
});
test('PDF belongs to both research and owner; related PDF grounded, unrelated PDF not assumed relevant',async t=>{
 noNetwork(t);await pdf('solar-pdf','solar');await pdf('foreign','other','bob');await pdf('wrong-research','own-other');await pdf('irrelevant','solar','alice','Database indexes improve SQL queries and optimize software performance.');
 t.mock.method(search,'searchWeb',()=>assert.fail('PDF only must not search'));
 t.mock.method(llm,'generateJson',async(prompt,payload)=>grounded(payload));
 const s=await chat.create('alice','solar',{documentIds:['solar-pdf']});
 const answer=await chat.send(s.id,'alice',{content:'Chỉ dùng PDF: tóm tắt solar energy efficiency mới nhất',clientToken:'pdf'});
 assert.equal(answer.research.strategy,'DOCUMENT_RAG');assert.equal(answer.citations[0].documentId,'solar-pdf');assert.equal(answer.citations[0].page,1);
 await assert.rejects(chat.preferences(s.id,'alice',{documentIds:['foreign']}),{status:404});
 await assert.rejects(chat.preferences(s.id,'alice',{documentIds:['wrong-research']}),{status:403});
 await chat.preferences(s.id,'alice',{documentIds:['irrelevant']});
 const no=await chat.send(s.id,'alice',{content:'Chỉ dùng PDF: tóm tắt tài liệu',clientToken:'unrelated-pdf'});assert.deepEqual(no.citations,[]);assert.match(no.content,/Chưa đủ dữ liệu/);
 await pdf('processing','solar','alice',text,'pending');await chat.preferences(s.id,'alice',{documentIds:['processing']});
 await assert.rejects(chat.send(s.id,'alice',{content:'Tóm tắt PDF',clientToken:'processing'}),{status:409});
});
async function runData() {
 const date=now();await db.run("INSERT INTO research_runs(id,request_id,input_snapshot_json,status,created_at,updated_at,idempotency_key) VALUES('run-solar','solar','{}','completed',$1,$1,'run-one')",[date]);
 for(const stage of ['planning','analyzing','composing'])await db.run("INSERT INTO stage_jobs(id,run_id,stage,status,idempotency_key,input_json,output_json,created_at,available_at) VALUES($1,'run-solar',$2,'succeeded',$2,'{}',$3,$4,$4)",['job-'+stage,stage,JSON.stringify(stage==='planning'?{plan:{researchQuestions:[{id:'Q1',question:'What affects solar energy efficiency?'}],searchQueries:[]}}:{}),date]);
 await db.run("INSERT INTO source_versions(id,run_id,query,title,url,normalized_url,provider,original_content,content_hash,collected_at) VALUES('sv','run-solar','solar','Solar energy research','https://energy.gov/solar','https://energy.gov/solar','tavily',$1,$2,$3)",[text,hash(text),date]);
 await db.run("INSERT INTO source_chunks_v2 VALUES('chunk','run-solar','sv',0,$1)",[text]);
 const e={id:'ev1',chunkId:'chunk',sourceVersionId:'sv',originalQuote:text,evidenceText:'Solar efficiency depends on temperature.',verificationStatus:'unverified',reason:'Measured under controlled conditions.'};
 await db.run("INSERT INTO analysis_versions(id,run_id,job_id,source_snapshot_hash,evidence_json,coverage_status,gaps_json,created_at) VALUES('analysis','run-solar','job-analyzing','hash',$1,'partial','[\"Independent evidence missing\"]',$2)",[JSON.stringify([e]),date]);
 await db.run("INSERT INTO report_versions(id,run_id,job_id,analysis_version_id,content,references_json,citation_validation_json,status,created_at) VALUES('report','run-solar','job-composing','analysis',$1,$2,'{}','draft',$3)",['Solar energy efficiency: '+text,JSON.stringify([{sourceVersionId:'sv',url:'https://energy.gov/solar'}]),date]);
}
test('WF01 sources/evidence/report retrieved read-only, provenance revalidated, no cross-research leakage',async t=>{
 noNetwork(t);await runData();t.mock.method(search,'searchWeb',()=>assert.fail('Stored evidence needs no web'));
 const s=await chat.create('alice','solar',{documentIds:[]});const study=await rc.load('solar','alice');
 assert.equal(study.questions[0],'What affects solar energy efficiency?');
 const contexts=await rc.retrieve(study,'solar energy efficiency evidence','alice');
 for(const kind of ['run_source','run_evidence','run_report'])assert.ok(contexts.some(c=>c.recordType===kind));
 await assert.rejects(rc.retrieve(study,'solar energy','bob'),{status:404});
 const wrong={...study,id:'own-other'};assert.deepEqual(await rc.retrieve(wrong,'solar energy','alice'),[]);
 for(const type of ['run_evidence','run_report']) {
  t.mock.method(llm,'generateJson',async(prompt,payload)=>grounded(payload,type));
  const reply=await chat.send(s.id,'alice',{content:type==='run_evidence'?'Nguồn nào hỗ trợ kết luận solar energy efficiency?':'Giải thích báo cáo solar energy efficiency',clientToken:type});
  assert.equal(reply.research.strategy,'RESEARCH_RAG');assert.equal(reply.citations[0].recordType,type);assert.equal(reply.citations[0].requestId,'solar');
 }
 const before=await db.get("SELECT content,status FROM report_versions WHERE id='report'");assert.equal(before.status,'draft');assert.equal(before.content,'Solar energy efficiency: '+text);
});
test('supplemental web only on request, actual page verification, no modification of WF01 sources',async t=>{
 noNetwork(t);let searches=0;
 t.mock.method(search,'searchWeb',async()=>{searches++;return [{url:'https://energy.gov/new-solar',title:'Solar energy efficiency research',content:text,provider:'tavily'}];});
 t.mock.method(content,'checkPublicUrl',async()=>['93.184.216.34']);t.mock.method(content,'fetchPageContent',async()=>text+' New supplemental source.');
 t.mock.method(llm,'generateJson',async(prompt,payload)=>grounded(payload));
 const s=await chat.create('alice','solar',{documentIds:[]});const before=(await db.get('SELECT COUNT(*) n FROM source_versions')).n;
 const answer=await chat.send(s.id,'alice',{content:'Tìm nguồn bổ sung về solar energy efficiency mới nhất',clientToken:'web'});assert.equal(answer.research.strategy,'RESEARCH_WEB_SEARCH');assert.equal(searches,1);assert.ok(answer.citations.length);
 assert.equal((await db.get('SELECT COUNT(*) n FROM source_versions')).n,before);
});
test('legacy standalone remains readable; send blocked; provider failure never becomes mock',async t=>{
 noNetwork(t);const date=now();await db.run("INSERT INTO chat_sessions(id,owner_id,request_id,title,scope,document_ids_json,created_at) VALUES('old','alice',NULL,'Old PDF chat','documents','[]',$1)",[date]);
 await db.run("INSERT INTO chat_messages(id,chat_id,role,content,status,created_at) VALUES('old-message','old','user','Preserved history','complete',$1)",[date]);
 assert.equal((await chat.messages('old','alice'))[0].content,'Preserved history');await assert.rejects(chat.send('old','alice',{content:'hello'}),{status:409});
 await request('fresh-study');const s=await chat.create('alice','fresh-study',{});
 t.mock.method(llm,'generateJson',async()=>{throw Object.assign(new Error('Gemini API quota or rate limit exceeded'),{provider:'gemini',status:429});});
 await assert.rejects(chat.send(s.id,'alice',{content:'Explain solar energy efficiency',clientToken:'failure'}));assert.equal((await chat.messages(s.id,'alice')).at(-1).status,'failed');
});
test('public session APIs enforce research/chat/PDF ownership and CSRF',async t=>{
 const crypto=require('node:crypto');const date=now();
 for(const owner of ['alice','bob']) {
  await db.run('INSERT INTO users(id,email,name,password_hash,created_at,updated_at) VALUES($1,$2,$1,\'unused\',$3,$3)',[owner,owner+'@research.test',date]);
  await db.run('INSERT INTO user_sessions(id,user_id,token_hash,created_at,expires_at) VALUES($1,$2,$3,$4,$5)',[owner+'-session',owner,crypto.createHash('sha256').update(crypto.createHash('sha256').update(owner).digest('hex')).digest('hex'),date,new Date(Date.now()+3600000).toISOString()]);
 }
 const {app}=require('../src/server');const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}/api`;
 async function api(path,owner='alice',body,origin='http://localhost:5173',method=body?'POST':'GET') {
  const res=await fetch(base+path,{method,headers:{Cookie:`research_session=${crypto.createHash('sha256').update(owner).digest('hex')}`,Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  return {status:res.status,...await res.json()};
 }
 assert.equal((await api('/chats','alice',{})).status,409);
 assert.equal((await api('/research/solar/chats','bob',{})).status,404);
 assert.equal((await api('/research/solar/chats','alice',{},'https://evil.invalid')).status,403);
 const created=await api('/research/solar/chats','alice',{mode:'auto',scope:'combined',documentIds:[]});assert.equal(created.status,201);const id=created.data.id;
 assert.equal((await api('/chats/'+id,'bob')).status,404);
 assert.equal((await api('/documents/solar-pdf/file','bob')).status,404);
 assert.equal((await api('/chats/'+id+'/preferences','alice',{documentIds:['wrong-research']},undefined,'PATCH')).status,403);
 assert.equal((await api('/research/solar/chats')).data.every(c=>c.request_id==='solar'),true);
});
test('semantic scope supports related extensions without title keywords and never emits unrelated answers',async t=>{
 noNetwork(t);await request('semantic');const s=await chat.create('alice','semantic',{documentIds:[]});let calls=0;
 t.mock.method(search,'searchWeb',()=>assert.fail('No search for a conceptual extension'));
 t.mock.method(llm,'generateJson',async(prompt,payload)=>{calls++;assert.equal(payload.research.id,'semantic');return {related:!payload.question.includes('itinerary'),content:payload.question.includes('itinerary')?'Must not be emitted':'A p-n junction separates photo-generated charge carriers.'};});
 const yes=await chat.send(s.id,'alice',{content:'How does a p-n junction work?',clientToken:'extension'});assert.match(yes.content,/p-n junction/);assert.equal(calls,1);
 const no=await chat.send(s.id,'alice',{content:'Plan a vacation itinerary',clientToken:'semantic-no'});assert.equal(no.research.outcome,'out_of_scope');assert.ok(!no.content.includes('Must not be emitted'));assert.deepEqual(no.citations,[]);
 const webNo=await chat.send(s.id,'alice',{content:'Find additional sources for a vacation itinerary',clientToken:'web-semantic-no'});assert.equal(webNo.research.outcome,'out_of_scope');assert.equal(calls,3);
});
test('actual analysis gaps are available with a revalidated internal citation',async()=>{
 const study=await rc.load('solar','alice');const found=await rc.retrieve(study,'Có bằng chứng nào còn thiếu?','alice');
 const c=found.find(c=>c.recordType==='run_analysis');assert.ok(c);assert.match(c.content,/Independent evidence missing/);
 await db.transaction(async tx=>assert.equal((await rc.resolve(c,'solar','alice',tx)).versionHash,c.versionHash));
});
test('persisted mock WF01 source/evidence/report never become real chat citations',async()=>{
 const study=await rc.load('solar','alice');const previous=await rc.retrieve(study,'solar energy efficiency evidence report','alice');
 const report=previous.find(c=>c.recordType==='run_report');assert.ok(report);
 await db.run("UPDATE source_versions SET provider='mock' WHERE id='sv'");
 const rows=await rc.retrieve(study,'solar energy efficiency evidence report','alice');assert.deepEqual(rows,[]);
 await db.transaction(async tx=>assert.equal(await rc.resolve(report,'solar','alice',tx),null));
 await db.run("UPDATE source_versions SET provider='tavily' WHERE id='sv'");
});
