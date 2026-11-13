const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../../n8n/workflows/researchos-realigned');
const flow=id=>JSON.parse(fs.readFileSync(path.join(root,fs.readdirSync(root).find(p=>p.startsWith(id)))));
function code(w,name,body,lookup={},run=0){return new Function('$input','$','$runIndex','$vars',w.nodes.find(n=>n.name===name).parameters.jsCode)({first:()=>({json:body}),all:()=>[{json:body}]},n=>({first:()=>({json:lookup[n]}),item:{json:lookup[n]}}),run,{});}
const uuid='11111111-1111-1111-1111-111111111111';
test('five agreed workflow topologies stay intact and credentials remain references only',()=>{
 for(const [id,count] of [['WF01',33],['WF02',13],['WF03',10],['WF04',5],['WF05',7]]){
  const w=flow(id);assert.equal(w.nodes.length,count);assert.equal(w.active,false);
  const names=new Set(w.nodes.map(n=>n.name));assert.equal(names.size,count);
  for(const [source,outputs] of Object.entries(w.connections)){assert.ok(names.has(source));for(const branch of outputs.main||[])for(const edge of branch)assert.ok(names.has(edge.node));}
  assert.equal(w.settings.saveDataSuccessExecution,'none');assert.equal(w.settings.saveDataErrorExecution,'none');
 }
});
test('WF01 rejects malformed options and selects canonical orchestration on resume',()=>{
 const w=flow('WF01');assert.equal(code(w,'02 - Validate Request',{body:{requestId:uuid,idempotencyKey:'k',options:[]}})[0].json.valid,false);
 const normalized=code(w,'09 - Normalize Run',{success:true,data:{runId:uuid,orchestration:'n8n'}},{'02 - Validate Request':{requestId:uuid,options:{orchestration:'backend'}}})[0].json;
 assert.equal(normalized.orchestration,'n8n');
 assert.ok(!w.nodes.find(n=>n.name==='27 - Poll Job').parameters.url.includes("Dispatch Scheduled Job').first()"));
});
test('WF03 accepts real UUIDs and never retries ambiguous POST Chat',()=>{
 const w=flow('WF03');const result=code(w,'02 - Validate Chat Input',{body:{requestId:uuid,chatId:uuid,content:'question',clientToken:'token',ownerId:'spoof'}})[0].json;
 assert.equal(result.valid,true);assert.equal(result.ownerId,undefined);
 assert.notEqual(w.nodes.find(n=>n.name==='06 - Ask Backend RAG').retryOnFail,true);
 assert.equal(w.nodes.find(n=>n.name==='06 - Ask Backend RAG').onError,'continueErrorOutput');
});
module.exports={flow,code};
test('WF02 never promotes pending/processing to ready; schedule exports fail closed without an ID',()=>{
 const w=flow('WF02');for(const status of ['pending','processing','ready','failed'])assert.equal(code(w,'08 - Document Status',{data:{status}},{'02 - Validate Input':{documentId:uuid,jobId:uuid}})[0].json.status,status);
 const schedule=flow('WF05');assert.equal(code(schedule,'02 - Build Schedule Window',{})[0].json.valid,false);
 assert.ok(!JSON.stringify(schedule).includes('REPLACE_WITH_BACKEND_SCHEDULE_UUID'));
 assert.throws(()=>code(schedule,'04 - Configuration Missing',{}),/SCHEDULE_NOT_CONFIGURED/);
});
test('Cloud bundling rejects secret-bearing/local URLs and preserves five inactive graphs',()=>{
 const {spawnSync}=require('node:child_process'),os=require('node:os');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cloud-bundle-fixture-'));
 const script=path.join(__dirname,'../../scripts/make-n8n-cloud-bundle.py');
 for(const url of ['http://backend:3000','https://localhost','https://user:fixture@gateway.test','https://gateway.test?api_key=fixture'])assert.notEqual(spawnSync('python3',[script,'--base-url',url,'--output-dir',path.join(dir,'bad')],{cwd:path.join(__dirname,'../..')}).status,0);
 const out=path.join(dir,'valid');const r=spawnSync('python3',[script,'--base-url','https://gateway.example.test/researchos','--output-dir',out],{cwd:path.join(__dirname,'../..'),encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 for(const file of fs.readdirSync(out)){const w=JSON.parse(fs.readFileSync(path.join(out,file)));assert.equal(w.active,false);for(const n of w.nodes.filter(n=>n.type.endsWith('httpRequest')))assert.ok(n.parameters.url.includes('https://gateway.example.test/researchos'));}
});
