const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('WF03 projects only request/chat/content/token and never forwards webhook identity or cookies',()=>{
 const flow=JSON.parse(fs.readFileSync(path.join(__dirname,'../../n8n/workflows/researchos-realigned/WF03-research-chat.json')));
 const http=flow.nodes.find(n=>n.name==='06 - Ask Backend RAG');
 assert.match(http.parameters.url,/\/internal\/knowledge\/chats\//);
 assert.equal(http.parameters.genericAuthType,'httpHeaderAuth');assert.notEqual(http.retryOnFail,true);
 const validate=new Function('$input',flow.nodes.find(n=>n.name==='02 - Validate Chat Input').parameters.jsCode);
 const body={requestId:'11111111-1111-1111-1111-111111111111',chatId:'22222222-2222-2222-2222-222222222222',content:'Question',clientToken:'turn',ownerId:'spoof',userId:'spoof',cookie:'private-cookie'};
 const value=validate({first:()=>({json:{body}})})[0].json;
 assert.equal(value.valid,true);assert.equal(value.ownerId,undefined);assert.equal(value.cookie,undefined);
 const outbound=new Function('$json','return ('+http.parameters.jsonBody.slice(3,-2).trim()+')')(value);
 assert.deepEqual(outbound,{requestId:body.requestId,content:'Question',clientToken:'turn'});
 assert.equal(validate({first:()=>({json:{body:{...body,requestId:''}}})})[0].json.valid,false);
 assert.equal(flow.nodes[0].parameters.authentication,'headerAuth');
});
