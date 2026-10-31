const db=require('../config/database');
const renderer=require('./report-export.service');
exports.exportReport=async(id,format)=>{
 const report=await db.get('SELECT * FROM report_versions WHERE id=?',[id]);
 if(!report)throw Object.assign(new Error('Report not found'),{status:404});
 const run=await db.get('SELECT * FROM research_runs WHERE id=?',[report.run_id]);
 const input=JSON.parse(run.input_snapshot_json),{lexer}=await import('marked');
 const references=JSON.parse(report.references_json);
 const data={report:{...report,title:input.topic},request:input,references,created:report.created_at,
 body:renderer.blocks(lexer(report.content.split('## Tài liệu tham khảo')[0]))};
 return {buffer:await(format==='docx'?renderer.renderDocx(data):renderer.renderPdf(data)),filename:`research-${id}.${format}`,
 mime:format==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/pdf'};
};
