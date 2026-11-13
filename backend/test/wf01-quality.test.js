const {test}=require('node:test');
const assert=require('node:assert/strict');
const provider=require('../src/providers/research.provider');
const quality=require('../src/services/source-quality.service');
const topic={topic:'Dao động điều hòa',goal:'Ứng dụng và phương pháp giải bài tập',language:'vi',numberOfSources:3};
const text='Simple harmonic motion occurs when the restoring force is proportional to displacement. A mass on a spring obeys Hooke law and oscillates with a period determined by its mass and spring constant. The differential equation describes displacement, velocity, acceleration, and mechanical energy.';
test('WF01 rejects reserved/mock URLs, placeholders and title-only relevance',()=>{
 for(const url of ['https://example.com/mock/a','https://sub.example.org/a','http://localhost/a','http://127.0.0.1/a'])assert.equal(quality.isResearchUrl(url),false);
 assert.equal(quality.acceptContent(topic,{title:topic.topic,original_content:'An investor trades stocks and currencies in financial markets. '.repeat(10)}).accepted,false);
 assert.equal(quality.acceptContent(topic,{title:topic.topic,original_content:''}).accepted,false);
 assert.equal(quality.acceptContent(topic,{original_content:'Access denied. Checking your browser. '.repeat(10)}).accepted,false);
 assert.equal(quality.acceptContent(topic,{original_content:text}).accepted,true);
});
test('WF01 mock configuration fails closed, without generating placeholder sources',async t=>{
 t.mock.method(global,'fetch',()=>assert.fail('No network expected'));const previous=process.env.MOCK_LLM;process.env.MOCK_LLM='true';t.after(()=>{if(previous===undefined)delete process.env.MOCK_LLM;else process.env.MOCK_LLM=previous;});
 await assert.rejects(provider.plan({input:topic}),{code:'MOCK_PROVIDER_DISABLED'});
});
test('no-evidence report cannot be marked verified or completed',async()=>{
 const result=await require('../src/jobs/verifying.job')({run:{id:'run'},input:topic,provider,report:{content:'# X\n## Tóm tắt\n## Nội dung chính\n## Kết luận\n## Giới hạn nghiên cứu\n## Tài liệu tham khảo',references_json:'[]',analysis_version_id:'a'},analysis:{id:'a',evidence_json:'[]'},sources:[],chunks:[],previousEvaluation:{coverage:'unavailable'}});
 assert.equal(result.valid,false);assert.equal(result.status,'partial');assert.ok(result.reasonCodes.includes('NO_VERIFIABLE_EVIDENCE'));
});
test('citation verification rejects invented quotes even with a matching URL and label',async()=>{
 const s={id:'s',url:'https://openstax.org/books/physics/pages/oscillations',provider:'tavily',original_content:text};
 const e={id:'e',runId:'run',sourceVersionId:'s',chunkId:'c',originalQuote:'This quote was invented.',evidenceText:'Claim'};
 const result=await require('../src/jobs/verifying.job')({run:{id:'run'},input:topic,provider,report:{content:'# X\n## Tóm tắt\n## Nội dung chính\nClaim [1]\n## Kết luận\n## Giới hạn nghiên cứu\n## Tài liệu tham khảo\n[1]',references_json:JSON.stringify([{sourceVersionId:'s',runId:'run',url:s.url,citationLabel:'[1]'}]),analysis_version_id:'a'},analysis:{id:'a',evidence_json:JSON.stringify([e])},sources:[s],chunks:[{id:'c',source_version_id:'s',content:text}],previousEvaluation:{coverage:'sufficient'}});
 assert.equal(result.valid,false);assert.equal(result.status,'partial');
});
test('extraction batches questions once and discards only invalid provenance items',async t=>{
 for(const key of ['MOCK_LLM','MOCK_SEARCH','GEMINI_API_KEY','TAVILY_API_KEY']){const old=process.env[key];process.env[key]=key.startsWith('MOCK')?'false':'offline-fixture';t.after(()=>old===undefined?delete process.env[key]:process.env[key]=old);}
 t.mock.method(require('../src/config/database'),'run',async()=>({changes:1}));let calls=0;
 t.mock.method(global,'fetch',async url=>{assert.ok(url.includes('generativelanguage.googleapis.com'));calls++;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({evidence:[{questionId:'Q1',chunkId:'c',sourceVersionId:'s',originalQuote:'Simple harmonic motion occurs when the restoring force is proportional to displacement.',evidenceText:'Lực phục hồi tỷ lệ với li độ.',reason:'Đoạn trích trực tiếp.'},{questionId:'Q1',chunkId:'missing',sourceVersionId:'fake',originalQuote:'fabricated',evidenceText:'fabricated',reason:'fabricated'}]})}}]}));});
 const result=await provider.extract({input:topic,run:{id:'run'},signal:new AbortController().signal,check(){},sources:[{id:'s',provider:'tavily',url:'https://openstax.org/physics',original_content:text}]},[{id:'Q1',question:'Dao động điều hòa có lực phục hồi như thế nào?'}],[{id:'c',provider:'tavily',source_version_id:'s',content:text}]);
 assert.equal(calls,1);assert.equal(result.evidence.length,1);assert.equal(result.evidence[0].sourceId,'s');assert.equal(result.evidence[0].verificationStatus,'unverified');assert.ok(result.warnings.some(w=>w.code==='INVALID_EVIDENCE_PROVENANCE'));
});
test('verified citation requires an exact source quote and semantic support',async()=>{
 const quote='Simple harmonic motion occurs when the restoring force is proportional to displacement.';
 const source={id:'s',provider:'tavily',url:'https://openstax.org/physics',original_content:text};
 const e={id:'e',runId:'run',questionId:'Q1',sourceVersionId:'s',chunkId:'c',originalQuote:quote,evidenceText:quote};
 const ctx={run:{id:'run'},input:topic,plan:{researchQuestions:[{id:'Q1'}]},sources:[source],chunks:[{id:'c',source_version_id:'s',content:text}],analysis:{id:'a',evidence_json:JSON.stringify([e])},previousEvaluation:{coverage:'sufficient'},report:{analysis_version_id:'a',content:`# X\n## Summary\n## Findings\n${quote} [1]\n## Conclusion\n## Research limitations\n## References\n[1]`,references_json:JSON.stringify([{runId:'run',sourceVersionId:'s',url:source.url,citationLabel:'[1]',claims:[{evidenceId:'e',text:quote}]}])},provider:{...provider,json:async()=>({verdicts:[{evidenceId:'e',status:'verified'}]})}};
 const result=await require('../src/jobs/verifying.job')(ctx);assert.equal(result.status,'completed');assert.equal(result.verifiedCount,1);
 ctx.provider.json=async()=>({verdicts:[{evidenceId:'e',status:'unsupported'}]});const unsupported=await require('../src/jobs/verifying.job')(ctx);assert.equal(unsupported.status,'partial');assert.equal(unsupported.citations[0].status,'unsupported');
});
test('placeholder provider keys are rejected before any paid request',async t=>{
 const values={MOCK_LLM:'false',MOCK_SEARCH:'false',GEMINI_API_KEY:'your_gemini_api_key',TAVILY_API_KEY:'your_tavily_api_key'};
 for(const [k,v] of Object.entries(values)){const old=process.env[k];process.env[k]=v;t.after(()=>old===undefined?delete process.env[k]:process.env[k]=old);}
 t.mock.method(global,'fetch',()=>assert.fail('Placeholder credentials must never reach a provider'));
 await assert.rejects(provider.plan({input:topic}),{code:'PROVIDER_CONFIGURATION'});
});
