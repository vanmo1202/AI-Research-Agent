const router=require('express').Router();
const c=require('../controllers/run.controller');
const {timingSafeEqual}=require('node:crypto');
const windows=new Map();
function limit(req,res,next){
 const id=req.ip,now=Date.now(),entry=windows.get(id);
 if(windows.size>10000)for(const [key,v] of windows)if(v.until<now)windows.delete(key);
 if(!entry||entry.until<now)windows.set(id,{until:now+60000,count:1});
 else if(++entry.count>20)return res.status(429).set('Retry-After','60').json({success:false,error:'Too many run requests'});
 next();
}
router.get('/',c.list);
router.post('/:requestId/runs',limit,c.create);
router.get('/:requestId/runs/:runId/progress',c.progress);
router.post('/runs/:runId/retry',limit,c.retry);
router.post('/runs/:runId/cancel',c.cancel);
router.get('/runs/:runId/sources',c.sources);
router.get('/runs/:runId/evidence',c.evidence);
router.get('/runs/:runId/reports',c.reports);
for(const format of ['docx','pdf'])router.get(`/reports/:reportId/export/${format}`,async(req,res)=>{
 const file=await require('../services/run-export.service').exportReport(req.params.reportId,format);
 res.set('Content-Type',file.mime).set('Content-Disposition',`attachment; filename="${file.filename}"`).send(file.buffer);
});
const internal=require('express').Router();
internal.use((req,res,next)=>{const expected=process.env.INTERNAL_API_KEY,actual=req.get('X-Internal-Api-Key')||'';
 if(!expected||Buffer.byteLength(expected)!==Buffer.byteLength(actual)||!timingSafeEqual(Buffer.from(expected),Buffer.from(actual)))return res.status(401).json({success:false,error:'Unauthorized'});
 next();
});
internal.post('/runs/:runId/jobs',c.dispatch);
internal.get('/jobs/:jobId',c.job);
module.exports={router,internal};
