const service=require('../services/run.service');
const db=require('../config/database');
const model=require('../models/run.model');
const ok=(res,data,status=200)=>res.status(status).json({success:true,data});
exports.list=async(req,res)=>ok(res,await db.all(`SELECT r.*, (SELECT id FROM research_runs WHERE request_id=r.id ORDER BY rowid DESC LIMIT 1) latestRunId,
 (SELECT status FROM research_runs WHERE request_id=r.id ORDER BY rowid DESC LIMIT 1) runStatus FROM requests r ORDER BY r.created_at DESC LIMIT 200`));
exports.create=async(req,res)=>{const r=await service.create(req.params.requestId,req.body,req.get('Idempotency-Key'));ok(res,{requestId:r.request_id,runId:r.id,status:r.status},202);};
exports.progress=async(req,res)=>ok(res,await service.progress(req.params.requestId,req.params.runId));
exports.retry=async(req,res)=>ok(res,service.publicJob(await service.retry(req.params.runId,req.body?.stage,req.get('Idempotency-Key'))),202);
exports.cancel=async(req,res)=>{const r=await service.cancel(req.params.runId);ok(res,{runId:r.id,status:r.status});};
exports.sources=async(req,res)=>{await service.requireRun(req.params.runId);ok(res,await db.all('SELECT * FROM source_versions WHERE run_id=? ORDER BY rowid',[req.params.runId]));};
exports.evidence=async(req,res)=>{await service.requireRun(req.params.runId);const a=await model.latestAnalysis(req.params.runId);ok(res,a?{...a,evidence:JSON.parse(a.evidence_json),gaps:JSON.parse(a.gaps_json)}:{evidence:[],coverage_status:'unavailable'});};
exports.reports=async(req,res)=>{await service.requireRun(req.params.runId);ok(res,(await db.all('SELECT * FROM report_versions WHERE run_id=? ORDER BY rowid DESC',[req.params.runId])).map(r=>({...r,references:JSON.parse(r.references_json),citationValidation:JSON.parse(r.citation_validation_json)})));};
exports.dispatch=async(req,res)=>ok(res,service.publicJob(await service.dispatch(req.params.runId,req.body?.stage,req.get('Idempotency-Key'))),202);
exports.job=async(req,res)=>{const j=await db.get('SELECT * FROM stage_jobs WHERE id=?',[req.params.jobId]);if(!j||j.run_id!==req.query.runId)throw Object.assign(new Error('Job not found for run'),{status:404});ok(res,service.publicJob(j));};
