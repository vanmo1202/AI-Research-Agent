const quality=require('../services/source-quality.service');
module.exports=async ctx=>{
 if(!ctx.report)throw ctx.provider.fail('REPORT_MISSING');
 const references=JSON.parse(ctx.report.references_json),evidence=JSON.parse(ctx.analysis.evidence_json);
 const labels=new Set(references.map(r=>r.citationLabel));
 const invalidReferences=references.filter(r=>r.runId!==ctx.run.id || !ctx.sources.some(s=>s.id===r.sourceVersionId && s.url===r.url) || !evidence.some(e=>e.sourceVersionId===r.sourceVersionId));
 const missingCitations=[...ctx.report.content.matchAll(/\[\d+\]/g)].map(m=>m[0]).filter(l=>!labels.has(l));
 const rejectedEvidence=evidence.some(e=>!quality.traceable(e,ctx));
 const stale=ctx.report.analysis_version_id!==ctx.analysis.id;
 const body=ctx.report.content.split(/## (?:Tài liệu tham khảo|References)/)[0];
 const unusedReferences=references.filter(r=>!body.includes(r.citationLabel)).map(r=>r.sourceVersionId);
 const noReferences=!references.length;
 const missingSections=!/^# /m.test(ctx.report.content) || [/(?:Tóm tắt|Summary)/,/(?:Nội dung chính|Findings)/,/(?:Kết luận|Conclusion)/,/(?:Giới hạn nghiên cứu|Research limitations)/,/(?:Tài liệu tham khảo|References)/].some(p=>!p.test(ctx.report.content));
 const reasonCodes=[];
 if(!evidence.length)reasonCodes.push('NO_VERIFIABLE_EVIDENCE');
 if(rejectedEvidence)reasonCodes.push('INVALID_EVIDENCE_PROVENANCE');
 if(noReferences)reasonCodes.push('NO_REPORT_CITATIONS');
 if(invalidReferences.length || missingCitations.length || stale || unusedReferences.length || missingSections)reasonCodes.push('CITATION_STRUCTURE_INVALID');
 const claims=references.flatMap(r=>(r.claims || []).map(c=>({...c,sourceVersionId:r.sourceVersionId})));
 const structurallyValid=!!evidence.length && !rejectedEvidence && !noReferences && !invalidReferences.length && !missingCitations.length && !stale && !unusedReferences.length && !missingSections;
 let verdicts=[];
 if(structurallyValid && claims.length && claims.every(c=>evidence.some(e=>e.id===c.evidenceId && e.sourceVersionId===c.sourceVersionId) && body.includes(c.text))){
  try{
   const result=await ctx.provider.json(ctx,'Check each report claim against its exact source quote and evidence. Mark verified ONLY if the quote directly supports the entire claim. Return {"verdicts":[{"evidenceId":"","status":"verified|unsupported|unverified","reason":"short explanation"}]}. Do not add facts or use outside knowledge.',{claims:claims.map(c=>{const e=evidence.find(e=>e.id===c.evidenceId);return {evidenceId:e.id,claim:c.text,quote:e.originalQuote,evidence:e.evidenceText,question:e.researchQuestion};})});
   if(Array.isArray(result.verdicts))verdicts=result.verdicts;
  }catch{reasonCodes.push('SEMANTIC_VERIFICATION_UNAVAILABLE');}
 }
 const citations=references.map(r=>{
  const s=ctx.sources.find(s=>s.id===r.sourceVersionId),items=claims.filter(c=>c.sourceVersionId===r.sourceVersionId);
  let status='unverified';
  if(!s || !quality.isResearchUrl(r.url))status='inaccessible';
  else if(structurallyValid && items.length){
   const decisions=items.map(c=>verdicts.filter(v=>v.evidenceId===c.evidenceId));
   status=decisions.some(v=>v.some(d=>d.status==='unsupported'))?'unsupported':decisions.every(v=>v.length===1 && v[0].status==='verified')?'verified':'unverified';
  }
  return {citationLabel:r.citationLabel,sourceVersionId:r.sourceVersionId,url:r.url,status,evidenceIds:items.map(c=>c.evidenceId)};
 });
 const missingQuestionCoverage=ctx.plan?.researchQuestions?.some(q=>!claims.some(c=>evidence.some(e=>e.id===c.evidenceId && e.questionId===q.id))) || false;
 if(missingQuestionCoverage)reasonCodes.push('REPORT_QUESTION_COVERAGE_GAP');
 const verifiedCount=citations.filter(c=>c.status==='verified').length;
 const valid=structurallyValid && citations.length>0 && verifiedCount===citations.length;
 if(!valid && !reasonCodes.length)reasonCodes.push('CITATIONS_UNVERIFIED');
 if(ctx.previousEvaluation?.coverage!=='sufficient')reasonCodes.push('INSUFFICIENT_EVIDENCE_COVERAGE');
 return {valid,rejectedEvidence,invalidReferences:invalidReferences.map(r=>r.sourceVersionId),missingCitations,stale,unusedReferences,noReferences,missingSections,citations,claimVerdicts:verdicts,verifiedCount,reasonCodes,status:valid && !missingQuestionCoverage && ctx.previousEvaluation?.coverage==='sufficient'?'completed':'partial'};
};
