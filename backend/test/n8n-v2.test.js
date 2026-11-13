const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const folder=path.join(__dirname,'../../n8n/workflows/researchos-realigned');
test('five current ResearchOS workflows have bounded credential-based HTTP and real error outputs',()=>{
 const files=fs.readdirSync(folder).filter(f=>f.endsWith('.json'));assert.equal(files.length,5);
 for(const file of files){
  const workflow=JSON.parse(fs.readFileSync(path.join(folder,file))),names=new Set(workflow.nodes.map(n=>n.name));
  assert.equal(names.size,workflow.nodes.length);assert.equal(workflow.active,false);
  assert.ok(workflow.nodes.some(n=>/\.(webhook|scheduleTrigger)$/.test(n.type)));
  assert.ok(!workflow.nodes.some(n=>n.type.endsWith('.manualTrigger')));
  for(const [source,c] of Object.entries(workflow.connections)){assert.ok(names.has(source));for(const output of c.main)for(const edge of output)assert.ok(names.has(edge.node));}
  for(const n of workflow.nodes.filter(n=>n.type.endsWith('.httpRequest'))){
   assert.ok(n.parameters.options.timeout>0&&n.parameters.options.timeout<=40000);
   assert.equal(n.onError,'continueErrorOutput');assert.ok(workflow.connections[n.name].main[1]?.length);
   assert.equal(n.parameters.genericAuthType,'httpHeaderAuth');
   assert.ok(!(n.parameters.headerParameters?.parameters||[]).some(h=>/authorization|api.key|cookie/i.test(h.name)));
  }
 }
});
test('every shipped webhook requires inbound auth distinct from outbound internal credentials',()=>{
 let hooks=0;
 for(const file of fs.readdirSync(folder).filter(f=>f.endsWith('.json'))){
  const workflow=JSON.parse(fs.readFileSync(path.join(folder,file)));
  const outbound=new Set(workflow.nodes.filter(n=>n.type.endsWith('.httpRequest')).map(n=>n.credentials?.httpHeaderAuth?.id).filter(Boolean));
  for(const node of workflow.nodes.filter(n=>n.type.endsWith('.webhook'))){
   hooks++;assert.equal(node.parameters.authentication,'headerAuth');
   if(node.credentials?.httpHeaderAuth?.id)assert.ok(!outbound.has(node.credentials.httpHeaderAuth.id));
  }
 }
 assert.equal(hooks,3);
});
