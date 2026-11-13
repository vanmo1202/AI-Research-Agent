const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../src/config/database');
after(()=>db.close());
test('dashboard counts latest v2 completion and preserves legacy fallback and owner scope',async()=>{
 await db.initializeDatabase();
 for(const [id,owner,status] of [['done','alice','created'],['retry','alice','completed'],['legacy','alice','completed'],['foreign','bob','completed']])
  await db.run('INSERT INTO requests(id,owner_id,topic,goal,status) VALUES($1,$2,$1,$1,$3)',[id,owner,status]);
 for(const [id,request,status] of [['done-run','done','completed'],['retry-old','retry','completed'],['retry-new','retry','running'],['foreign-run','foreign','completed']])
  await db.run("INSERT INTO research_runs(id,request_id,input_snapshot_json,status,created_at,updated_at,idempotency_key) VALUES($1,$2,'{}',$3,now(),now(),$1)",[id,request,status]);
 await db.run("INSERT INTO stage_jobs(id,run_id,stage,status,idempotency_key,input_json,output_json,created_at,available_at) VALUES('plan','done-run','planning','succeeded','plan','{}',$1,now(),now())",[JSON.stringify({plan:{researchQuestions:[{id:'Q1',question:'One'},{id:'Q2',question:'Two'}]}})]);
 await db.run("INSERT INTO source_versions(id,run_id,query,url,normalized_url,original_content,content_hash,collected_at) VALUES('source','done-run','q','https://openstax.org','https://openstax.org','text','hash',now())");
 await db.run("INSERT INTO plans(request_id,question_id,research_question,search_query) VALUES('legacy','Q1','Legacy','query')");
 let output;await require('../src/auth/dashboard')({owner:'alice'},{json:value=>output=value});
 assert.equal(output.data.researchCount,3);assert.equal(output.data.completedCount,2);
 const done=output.data.recentResearch.find(r=>r.requestId==='done');assert.equal(done.status,'completed');assert.equal(done.questionCount,2);assert.equal(done.sourceCount,1);
 assert.equal(output.data.recentResearch.find(r=>r.requestId==='retry').status,'running');
 assert.equal(output.data.recentResearch.find(r=>r.requestId==='legacy').questionCount,1);
 assert.ok(!output.data.recentResearch.some(r=>r.requestId==='foreign'));
});
