module.exports=async ctx=>{
 if(!ctx.report)throw ctx.provider.fail('REPORT_MISSING');
 const references=JSON.parse(ctx.report.references_json),evidence=JSON.parse(ctx.analysis.evidence_json);
 const labels=new Set(references.map(r=>r.citationLabel));
 const invalidReferences=references.filter(r=>r.runId!==ctx.run.id||!ctx.sources.some(s=>s.id===r.sourceVersionId&&s.url===r.url)||!evidence.some(e=>e.sourceVersionId===r.sourceVersionId));
 const missingCitations=[...ctx.report.content.matchAll(/\[\d+\]/g)].map(m=>m[0]).filter(label=>!labels.has(label));
 const stale=ctx.report.analysis_version_id!==ctx.analysis.id;
 const valid=!invalidReferences.length&&!missingCitations.length&&!stale;
 return {valid,invalidReferences:invalidReferences.map(r=>r.sourceVersionId),missingCitations,stale,
 status:valid&&evidence.length&&ctx.previousEvaluation?.coverage==='sufficient'?'completed':'partial'};
};
