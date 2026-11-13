const {db,research:ownedResearch,hash,normalize}=require('./common');
const topical=require('../services/source-relevance.service');
const {isResearchUrl}=require('../services/source-quality.service');
const realSource=s=>s.provider==='tavily'&&isResearchUrl(s.url);
const {followupIntent,fold}=require('./unified-routing');
const REFUSAL='Chat này chỉ hỗ trợ nghiên cứu đang chọn. Hãy đặt câu hỏi liên quan hoặc chọn nghiên cứu khác.';
// Concept families bridge bilingual terminology and related mechanisms, rather than
// requiring the research title to be repeated verbatim in every question.
const families=[
 ['harmonicmotion','springmass','hookelaw','mechanicaloscillation','pendulum','spring','restoring force','luc phuc hoi','chu ky','tan so','frequency','oscillation','physics'],
 ['ai','machinelearning','retrieval','questionanswering','rag','embedding','hallucination','ao giac','vector','neural','llm','chatbot','transformer'],
 ['react','node','software','code','algorithm','algorithmcomplexity','timecomplexity','spacecomplexity','bigo','programming','python','javascript','database','sql','index','chi muc','phan mem'],
 ['renewableenergy','solar','nang luong','climatechange','carbonpricing','photovoltaic','dien mat troi','energy'],
 ['inflation','monetarypolicy','stockmarket','crudeoil','foreignexchange','gold','gia vang','ty gia','lai suat','tai chinh','finance'],
 ['education','university','giang day','teaching','learning','sinh vien'],
 ['frenchrevolution','history','chien tranh','war','revolution'],
 ['health','suc khoe','benh','disease','medicine','medical'],
];
const contains=(value,term)=>` ${value} `.includes(` ${term} `);
function guard(question,study,history=[]) {
 const q=topical.canonical(question), scope=topical.canonical([study.topic,study.goal,...(study.questions||[])].join(' '));
 const qFamilies=families.map((terms,i)=>terms.some(t=>contains(q,t))?i:-1).filter(i=>i>=0);
 const scopeFamilies=families.map((terms,i)=>terms.some(t=>contains(scope,t))?i:-1).filter(i=>i>=0);
 const agreement=topical.match(question,topical.profile({topic:study.topic,scope:study.questions?.join(' '),goal:study.goal})).relevant;
 const expansion=qFamilies.some(i=>scopeFamilies.includes(i) || (i===1&&scopeFamilies.includes(2)) || (i===2&&scopeFamilies.includes(1)));
 const freeTask=/viet (bai )?tho|tho tinh|tam su|ke chuyen cuoi|love poem|tell (me )?a joke/.test(fold(question));
 if(freeTask&&!agreement)return 'unrelated';
 if(qFamilies.length&&scopeFamilies.length&&!expansion&&!agreement)return 'unrelated';
 if(agreement||expansion)return 'related';
 const generic=/^(giai thich (ro|them)|cho (toi )?vi du|phan tich (uu|nhuoc)|co bang chung|nguon nao|ket luan|tom tat|explain (this|the conclusion)|which sources|what evidence)/.test(fold(question));
 if(generic&&!qFamilies.length)return 'related';
 if(followupIntent(fold(question))&&!qFamilies.length&&history.some(m=>m.research?.scopeVerdict==='related'))return 'related';
 return 'uncertain'; // Semantic decision is combined with synthesis, never lexical rejection.
}
async function load(id,owner) {
 const row=await ownedResearch(id,owner);
 const run=await db.get('SELECT id FROM research_runs WHERE request_id=$1 ORDER BY created_at DESC,legacy_position DESC LIMIT 1',[id]);
 const planned=run&&await db.get("SELECT output_json FROM stage_jobs WHERE run_id=$1 AND stage='planning' AND status='succeeded' ORDER BY legacy_position DESC LIMIT 1",[run.id]);
 const legacy=await db.all('SELECT DISTINCT research_question FROM plans WHERE request_id=$1 LIMIT 12',[id]);
 const plan=planned?JSON.parse(planned.output_json)?.plan:null;
 return {id,topic:row.topic,goal:row.goal,scope:row.scope,runId:run?.id||null,
  questions:[...new Set([...(plan?.researchQuestions||[]).map(q=>typeof q==='string'?q:q.question),...legacy.map(q=>q.research_question)])].filter(Boolean).slice(0,12),
  plan:plan?{searchQueries:(plan.searchQueries||[]).slice(0,4)}:null};
}
function sourceContext(row) {
 if(!realSource(row))return null;
 return {kind:'source',recordType:'run_source',provider:row.provider,runId:row.run_id,sourceId:row.source_version_id,referenceId:row.id,content:row.content,title:row.title,url:row.url,versionHash:hash(row.content+row.content_hash+row.url),retrievedAt:row.collected_at};
}
function evidenceContext(row) {
 if(!realSource(row))return null;
 const e=typeof row.item==='string'?JSON.parse(row.item):row.item;
 if(typeof e.originalQuote!=='string'||!e.originalQuote.trim()||!row.content.includes(e.originalQuote))return null;
 const text=`${e.evidenceText || ''}\nTrích nguồn: ${e.originalQuote}\nĐánh giá: ${e.verificationStatus || 'unverified'}; ${e.reason || ''}`;
 return {kind:'evidence',recordType:'run_evidence',provider:row.provider,runId:row.run_id,sourceId:row.source_version_id,referenceId:`${row.analysis_id}:${row.ordinal}`,content:text,title:row.title,url:row.url,versionHash:hash(text+row.content_hash),verificationStatus:e.verificationStatus||'unverified'};
}
function reportContext(row) {
 return {kind:'source',recordType:'run_report',runId:row.run_id,referenceId:`${row.report_id}:${row.ordinal}`,content:row.passage,title:`Báo cáo nghiên cứu (${row.status})`,reportStatus:row.status,versionHash:hash(row.passage+row.status+row.references_json)};
}
function analysisContext(row) {
 const gaps=JSON.parse(row.gaps_json).slice(0,8);
 const content=`Mức bao phủ bằng chứng: ${row.coverage_status}. Các khoảng trống được lưu: ${gaps.join('; ') || 'Chưa ghi nhận khoảng trống; điều này không chứng minh mọi kết luận đã được xác minh.'}`;
 return {kind:'evidence',recordType:'run_analysis',runId:row.run_id,referenceId:row.id,content,title:'Đánh giá và khoảng trống bằng chứng',versionHash:hash(content)};
}
async function provenance(runId,requestId,owner,connection) {
 return runId ? connection.all('SELECT s.id,s.url,s.provider FROM source_versions s JOIN research_runs r ON r.id=s.run_id JOIN requests q ON q.id=r.request_id WHERE s.run_id=$1 AND q.id=$2 AND q.owner_id=$3 LIMIT 101',[runId,requestId,owner])
 : connection.all('SELECT s.id,s.url,s.provider FROM sources s JOIN requests q ON q.id=s.request_id WHERE q.id=$1 AND q.owner_id=$2 LIMIT 101',[requestId,owner]);
}
function reportTrusted(row,sources) {
 const refs=JSON.parse(row.references_json||'[]');
 return Array.isArray(refs)&&refs.length>0&&refs.length<=40&&refs.every(ref=>sources.some(s=>realSource(s)&&s.url===ref.url&&(!row.run_id||s.id===ref.sourceVersionId)));
}
async function retrieve(study,question,owner,connection=db) {
 await ownedResearch(study.id,owner);
 const query=topical.searchTerms(question).join(' ');
 if(!query)return [];
 const sourceMetadata=await provenance(study.runId,study.id,owner,connection);
 if(!study.runId) {
  const rows=await connection.all(`SELECT v.id AS report_id,NULL AS run_id,'legacy' AS status,COALESCE(v.references_json::text,'[]') AS references_json,p.passage,p.ordinal FROM reports v CROSS JOIN LATERAL regexp_split_to_table(v.content,E'\\n\\s*\\n') WITH ORDINALITY p(passage,ordinal) JOIN requests q ON q.id=v.request_id WHERE q.id=$1 AND q.owner_id=$2 AND length(p.passage) BETWEEN 12 AND 5000 AND to_tsvector('simple',research_normalize(p.passage)) @@ research_query($3) LIMIT 4`,[study.id,owner,query]);
  return rows.filter(row=>reportTrusted(row,sourceMetadata)).map(row=>({...reportContext(row),recordType:'legacy_report',requestId:study.id}));
 }
 const [sources,evidence,reports,assessment]=await Promise.all([
 connection.all(`SELECT c.*,s.title,s.url,s.content_hash,s.provider,s.collected_at FROM source_chunks_v2 c JOIN source_versions s ON s.id=c.source_version_id AND s.run_id=c.run_id
 JOIN research_runs r ON r.id=c.run_id JOIN requests q ON q.id=r.request_id
 WHERE r.id=$1 AND q.id=$2 AND q.owner_id=$3 AND to_tsvector('simple',research_normalize(c.content)) @@ research_query($4)
 ORDER BY ts_rank_cd(to_tsvector('simple',research_normalize(c.content)),research_query($4)) DESC LIMIT 8`,[study.runId,study.id,owner,query]),
 connection.all(`SELECT a.id AS analysis_id,a.run_id,e.item,e.ordinal,c.content,c.source_version_id,s.title,s.url,s.content_hash,s.provider
 FROM (SELECT * FROM analysis_versions WHERE run_id=$1 ORDER BY legacy_position DESC LIMIT 1) a
 CROSS JOIN LATERAL jsonb_array_elements(a.evidence_json) WITH ORDINALITY e(item,ordinal)
 JOIN source_chunks_v2 c ON c.id=e.item->>'chunkId' AND c.run_id=a.run_id AND c.source_version_id=e.item->>'sourceVersionId'
 JOIN source_versions s ON s.id=c.source_version_id AND s.run_id=a.run_id
 JOIN research_runs r ON r.id=a.run_id JOIN requests q ON q.id=r.request_id
 WHERE q.id=$2 AND q.owner_id=$3 AND to_tsvector('simple',research_normalize(e.item::text)) @@ research_query($4) LIMIT 8`,[study.runId,study.id,owner,query]),
 connection.all(`SELECT v.id AS report_id,v.run_id,v.status,v.references_json,p.passage,p.ordinal
 FROM (SELECT * FROM report_versions WHERE run_id=$1 ORDER BY legacy_position DESC LIMIT 1) v
 CROSS JOIN LATERAL regexp_split_to_table(v.content,E'\\n\\s*\\n') WITH ORDINALITY p(passage,ordinal)
 JOIN research_runs r ON r.id=v.run_id JOIN requests q ON q.id=r.request_id
 WHERE q.id=$2 AND q.owner_id=$3 AND length(p.passage) BETWEEN 12 AND 5000 AND to_tsvector('simple',research_normalize(p.passage)) @@ research_query($4) LIMIT 4`,[study.runId,study.id,owner,query]),
 /bang chung.*(thieu|chua)|con thieu|gap|missing|coverage|tin cay/.test(fold(question)) ? connection.get('SELECT id,run_id,coverage_status,gaps_json FROM analysis_versions WHERE run_id=$1 ORDER BY legacy_position DESC LIMIT 1',[study.runId]) : null,
 ]);
 return [...(assessment&&sourceMetadata.every(realSource)?[analysisContext(assessment)]:[]),...evidence.map(evidenceContext).filter(Boolean),...sources.map(sourceContext).filter(Boolean),...reports.filter(row=>reportTrusted(row,sourceMetadata)).map(reportContext)].map(c=>({...c,requestId:study.id}));
}
async function resolve(c,requestId,owner,connection) {
 const args=[c.runId,requestId,owner];let row;
 if(c.recordType==='run_analysis') {
  row=await connection.get('SELECT a.id,a.run_id,a.coverage_status,a.gaps_json FROM analysis_versions a JOIN research_runs r ON r.id=a.run_id JOIN requests q ON q.id=r.request_id WHERE r.id=$1 AND q.id=$2 AND q.owner_id=$3 AND a.id=$4',[...args,c.referenceId]);
  const metadata=await provenance(c.runId,requestId,owner,connection);
  return row&&metadata.every(realSource)?analysisContext(row):null;
 }
 if(c.recordType==='run_source') {
  row=await connection.get(`SELECT c.*,s.title,s.url,s.content_hash,s.provider,s.collected_at FROM source_chunks_v2 c JOIN source_versions s ON s.id=c.source_version_id AND s.run_id=c.run_id JOIN research_runs r ON r.id=c.run_id JOIN requests q ON q.id=r.request_id WHERE r.id=$1 AND q.id=$2 AND q.owner_id=$3 AND c.id=$4 AND s.id=$5`,[...args,c.referenceId,c.sourceId]);
  return row&&sourceContext(row);
 }
 const at=c.referenceId.lastIndexOf(':'),id=c.referenceId.slice(0,at),ordinal=Number(c.referenceId.slice(at+1));
 if(!Number.isSafeInteger(ordinal)||ordinal<1)return null;
 if(c.recordType==='run_evidence') {
  row=await connection.get(`SELECT a.id AS analysis_id,a.run_id,e.item,e.ordinal,c.content,c.source_version_id,s.title,s.url,s.content_hash,s.provider FROM analysis_versions a
 CROSS JOIN LATERAL jsonb_array_elements(a.evidence_json) WITH ORDINALITY e(item,ordinal)
 JOIN source_chunks_v2 c ON c.id=e.item->>'chunkId' AND c.run_id=a.run_id AND c.source_version_id=e.item->>'sourceVersionId'
 JOIN source_versions s ON s.id=c.source_version_id AND s.run_id=a.run_id JOIN research_runs r ON r.id=a.run_id JOIN requests q ON q.id=r.request_id
 WHERE r.id=$1 AND q.id=$2 AND q.owner_id=$3 AND a.id=$4 AND e.ordinal=$5`,[...args,id,ordinal]);
  return row&&evidenceContext(row);
 }
 if(c.recordType==='legacy_report') {
  row=await connection.get(`SELECT v.id AS report_id,NULL AS run_id,'legacy' AS status,COALESCE(v.references_json::text,'[]') AS references_json,p.passage,p.ordinal FROM reports v CROSS JOIN LATERAL regexp_split_to_table(v.content,E'\\n\\s*\\n') WITH ORDINALITY p(passage,ordinal) JOIN requests q ON q.id=v.request_id WHERE q.id=$1 AND q.owner_id=$2 AND v.id=$3 AND p.ordinal=$4`,[requestId,owner,id,ordinal]);
  const metadata=await provenance(c.runId,requestId,owner,connection);
  return row&&reportTrusted(row,metadata)?reportContext(row):null;
 }
 if(c.recordType==='run_report') {
  row=await connection.get(`SELECT v.id AS report_id,v.run_id,v.status,v.references_json,p.passage,p.ordinal FROM report_versions v CROSS JOIN LATERAL regexp_split_to_table(v.content,E'\\n\\s*\\n') WITH ORDINALITY p(passage,ordinal) JOIN research_runs r ON r.id=v.run_id JOIN requests q ON q.id=r.request_id WHERE r.id=$1 AND q.id=$2 AND q.owner_id=$3 AND v.id=$4 AND p.ordinal=$5`,[...args,id,ordinal]);
  const metadata=await provenance(c.runId,requestId,owner,connection);
  return row&&reportTrusted(row,metadata)?reportContext(row):null;
 }
 return null;
}
module.exports={guard,load,retrieve,resolve,REFUSAL};
