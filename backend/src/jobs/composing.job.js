module.exports=async ctx=>{
 const evidence=ctx.analysis?JSON.parse(ctx.analysis.evidence_json):[];
 const evaluation=ctx.previousEvaluation||{coverage:'unavailable',gaps:[]};
 const references=ctx.sources.filter(s=>evidence.some(e=>e.sourceVersionId===s.id)).map((s,i)=>({sourceVersionId:s.id,runId:ctx.run.id,citationLabel:`[${i+1}]`,title:s.title,url:s.url}));
 const sections=ctx.plan.researchQuestions.map(q=>{
    const items=evidence.filter(e=>e.questionId===q.id);
    return `### ${q.question}\n\n`+(items.length?items.map(e=>`${e.evidenceText} ${references.find(r=>r.sourceVersionId===e.sourceVersionId).citationLabel}`).join('\n\n'):'Chưa có bằng chứng phù hợp.');
 });
 const partial=evaluation.coverage!=='sufficient';
 const content=`# ${ctx.input.topic}\n\n## Tóm tắt\n\nPhân tích ${evidence.length} bằng chứng từ ${references.length} nguồn. ${partial?'Chưa đủ bằng chứng để kết luận đầy đủ.':'Các câu hỏi đều có bằng chứng truy xuất được.'}\n\n## Nội dung chính\n\n${sections.join('\n\n')}\n\n## Kết luận\n\n${partial?'Cần bổ sung bằng chứng trước khi đưa ra kết luận chắc chắn.':'Các phát hiện ở trên được liên kết trực tiếp với nguồn và đoạn trích; đây là tổng hợp bằng chứng, không phải khẳng định quan hệ nhân quả.'}\n\n## Giới hạn nghiên cứu\n\nĐộ phủ: ${evaluation.coverage}. Nguồn web có thể thay đổi; chưa có đánh giá phản biện độc lập. ${evaluation.gaps.map(g=>g.question).join('; ')}\n\n## Tài liệu tham khảo\n\n${references.map(r=>`${r.citationLabel} ${r.title} — ${r.url}`).join('\n\n')}`;
 return {analysisVersionId:ctx.analysis.id,content,references,partial};
};
