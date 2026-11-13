const db=require('../config/database');
const runs=require('../services/run.service');
const {options,invalid}=require('../validators/run.validator');
const {randomUUID}=require('node:crypto');
const fail=(message,status)=>Object.assign(new Error(message),{status});
const object=v=>{if(!v||typeof v!=='object'||Array.isArray(v))throw invalid('Expected JSON object');return v;};
const id=v=>{if(typeof v!=='string'||! /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v))throw invalid('Invalid scheduleId');return v;};
function windowKey(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
function bound(name,value,max){const n=Number(process.env[name]??value);if(!Number.isInteger(n)||n<1||n>max)throw fail('Invalid schedule limit configuration',503);return n;}
async function active(tx,owner){if(!await tx.get("SELECT id FROM users WHERE id=$1 AND status='active'",[owner]))throw fail('Active schedule owner required',403);}
function present(s){return {scheduleId:s.id,requestId:s.request_id,enabled:!!s.enabled,maxConcurrent:s.max_concurrent,options:JSON.parse(s.options_json)};}
async function create(owner,body){
 object(body);if(typeof body.requestId!=='string'||!body.requestId.length||body.requestId.length>100)throw invalid('requestId required');
 const opts=options(body.options===undefined?{}:object(body.options));if(opts.orchestration!=='backend')throw invalid('Scheduled research requires backend orchestration');
 const enabled=body.enabled??false,max=body.maxConcurrent??1;if(typeof enabled!=='boolean'||!Number.isInteger(max)||max<1||max>3)throw invalid('Invalid schedule configuration');
 return db.transaction(async tx=>{
  await active(tx,owner);
  if(!await tx.get('SELECT id FROM requests WHERE id=$1 AND owner_id=$2',[body.requestId,owner]))throw fail('Research not found',404);
  if((await tx.get('SELECT count(*) AS n FROM research_schedules WHERE owner_id=$1',[owner])).n>=10)throw fail('Schedule count limit reached',429);
  return present(await tx.get('INSERT INTO research_schedules(id,owner_id,request_id,enabled,options_json,max_concurrent) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[randomUUID(),owner,body.requestId,enabled,JSON.stringify(opts),max]));
 });
}
async function list(owner){return (await db.all('SELECT * FROM research_schedules WHERE owner_id=$1 ORDER BY created_at',[owner])).map(present);}
async function setEnabled(owner,scheduleId,enabled){
 id(scheduleId);if(typeof enabled!=='boolean')throw invalid('enabled must be boolean');
 return db.transaction(async tx=>{await active(tx,owner);const row=await tx.get('UPDATE research_schedules SET enabled=$3,updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *',[scheduleId,owner,enabled]);if(!row)throw fail('Schedule not found',404);return present(row);});
}
async function dispatch(owner,body){
 object(body);const scheduleId=id(body.scheduleId);
 if(typeof body.windowKey!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.windowKey))throw invalid('windowKey must be YYYY-MM-DD');
 const day=windowKey();
 return db.transaction(async tx=>{
  await active(tx,owner);
  const s=await tx.get('SELECT s.* FROM research_schedules s JOIN requests r ON r.id=s.request_id WHERE s.id=$1 AND s.owner_id=$2 AND r.owner_id=$2 FOR UPDATE OF s',[scheduleId,owner]);
  if(!s)throw fail('Schedule not found',404);
  const old=await tx.get('SELECT run_id FROM research_schedule_dispatches WHERE schedule_id=$1 AND window_key=$2',[s.id,body.windowKey]);
  // A replay does not consume quota or create work, including after disabling a schedule.
  if(old)return {scheduleId:s.id,windowKey:body.windowKey,requestId:s.request_id,runId:old.run_id,status:'accepted',replayed:true};
  if(!s.enabled)throw fail('Schedule disabled',409);
  if(body.windowKey!==day)throw invalid('Only the current Asia/Ho_Chi_Minh daily window may create a run');
  const quota=(await tx.get('SELECT count(*) AS n FROM research_schedule_dispatches d JOIN research_schedules s ON s.id=d.schedule_id WHERE d.dispatch_day=$1 AND s.owner_id=$2',[day,owner])).n;
  const total=(await tx.get('SELECT count(*) AS n FROM research_schedule_dispatches WHERE dispatch_day=$1',[day])).n;
  if(quota>=bound('SCHEDULE_USER_DAILY_LIMIT',5,20)||total>=bound('SCHEDULE_GLOBAL_DAILY_LIMIT',50,500))throw fail('Scheduled research daily quota exceeded',429);
  const activeRuns=(await tx.get("SELECT count(*) AS n FROM research_runs r JOIN requests q ON q.id=r.request_id WHERE q.owner_id=$1 AND r.status IN ('queued','running')",[owner])).n;
  const activeSchedule=(await tx.get("SELECT count(*) AS n FROM research_schedule_dispatches d JOIN research_runs r ON r.id=d.run_id WHERE d.schedule_id=$1 AND r.status IN ('queued','running')",[s.id])).n;
  if(activeRuns>=bound('SCHEDULE_USER_CONCURRENCY_LIMIT',2,5)||activeSchedule>=s.max_concurrent)throw fail('Scheduled research concurrency bound reached',429);
  const run=await runs.createInTransaction(tx,s.request_id,JSON.parse(s.options_json),'schedule:'+s.id+':'+body.windowKey);
  await tx.run('INSERT INTO research_schedule_dispatches(schedule_id,window_key,dispatch_day,run_id) VALUES($1,$2,$3,$4)',[s.id,body.windowKey,day,run.id]);
  return {scheduleId:s.id,windowKey:body.windowKey,requestId:s.request_id,runId:run.id,status:'accepted',replayed:false};
 });
}
module.exports={create,list,setEnabled,dispatch,windowKey};
