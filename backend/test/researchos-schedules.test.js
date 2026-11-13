const {test,after}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const db=require('../src/config/database');after(()=>db.close());
test('WF05 dispatch is atomic, owner-scoped, bounded and idempotent per window',async()=>{
 await db.initializeDatabase();const service=require('../src/schedules/service');
 const owner=randomUUID(),other=randomUUID(),request=randomUUID();
 for(const id of [owner,other])await db.run("INSERT INTO users(id,email,name,password_hash,created_at,updated_at) VALUES($1,$2,'Fixture','unused',now(),now())",[id,id+'@test.invalid']);
 await db.run("INSERT INTO requests(id,owner_id,topic,goal,created_at,updated_at) VALUES($1,$2,'Scheduled research','Verify uniqueness',now(),now())",[request,owner]);
 const schedule=await service.create(owner,{requestId:request,enabled:true,options:{searchMore:false}});
 const body={scheduleId:schedule.scheduleId,windowKey:service.windowKey()};
 await assert.rejects(service.dispatch(other,body),{status:404});
 const outcomes=await Promise.all(Array.from({length:8},()=>service.dispatch(owner,body)));
 assert.equal(new Set(outcomes.map(r=>r.runId)).size,1);assert.equal((await db.get('SELECT count(*) AS n FROM research_runs')).n,1);
 assert.equal((await db.get('SELECT count(*) AS n FROM research_schedule_dispatches')).n,1);
 await service.setEnabled(owner,schedule.scheduleId,false);assert.equal((await service.dispatch(owner,body)).runId,outcomes[0].runId);
 const disabled=await service.create(owner,{requestId:request});await assert.rejects(service.dispatch(owner,{scheduleId:disabled.scheduleId,windowKey:service.windowKey()}),{status:409});
 await db.run("UPDATE users SET status='disabled' WHERE id=$1",[owner]);await assert.rejects(service.dispatch(owner,body),{status:403});await db.run("UPDATE users SET status='active' WHERE id=$1",[owner]);
 const next=await service.create(owner,{requestId:request,enabled:true});
 process.env.SCHEDULE_USER_DAILY_LIMIT='1';await assert.rejects(service.dispatch(owner,{scheduleId:next.scheduleId,windowKey:service.windowKey()}),{status:429});delete process.env.SCHEDULE_USER_DAILY_LIMIT;
 process.env.SCHEDULE_USER_CONCURRENCY_LIMIT='1';await assert.rejects(service.dispatch(owner,{scheduleId:next.scheduleId,windowKey:service.windowKey()}),{status:429});delete process.env.SCHEDULE_USER_CONCURRENCY_LIMIT;
 await assert.rejects(service.dispatch(owner,{scheduleId:next.scheduleId,windowKey:'2000-01-01'}),{status:400});
});
test('WF05 ledger failure rolls back run, job and outbox creation',async()=>{
 const service=require('../src/schedules/service'),owner=randomUUID(),requestId=randomUUID();
 await db.run("INSERT INTO users(id,email,name,password_hash,created_at,updated_at) VALUES($1,$2,'Fixture','unused',now(),now())",[owner,owner+'@test.invalid']);
 await db.run("INSERT INTO requests(id,owner_id,topic,goal) VALUES($1,$2,'Atomicity','Rollback')",[requestId,owner]);
 const s=await service.create(owner,{requestId,enabled:true}),original=db.transaction;
 const before=(await db.get('SELECT count(*) AS n FROM stage_jobs')).n;
 db.transaction=work=>original(tx=>work({...tx,run:async(sql,args)=>{if(sql.startsWith('INSERT INTO research_schedule_dispatches'))throw Error('fixture ledger unavailable');return tx.run(sql,args);}}));
 try{await assert.rejects(service.dispatch(owner,{scheduleId:s.scheduleId,windowKey:service.windowKey()}),/fixture ledger unavailable/);}finally{db.transaction=original;}
 assert.equal((await db.get('SELECT count(*) AS n FROM research_runs WHERE request_id=$1',[requestId])).n,0);
 assert.equal((await db.get('SELECT count(*) AS n FROM stage_jobs')).n,before);
 assert.equal((await db.get('SELECT count(*) AS n FROM research_schedule_dispatches WHERE schedule_id=$1',[s.scheduleId])).n,0);
 process.env.SCHEDULE_GLOBAL_DAILY_LIMIT='1';try{await assert.rejects(service.dispatch(owner,{scheduleId:s.scheduleId,windowKey:service.windowKey()}),{status:429});}finally{delete process.env.SCHEDULE_GLOBAL_DAILY_LIMIT;}
 await assert.rejects(service.create(owner,{requestId,options:{orchestration:'n8n'}}),{status:400});
});

test('WF05 uses Vietnam midnight boundaries and reuses an existing canonical run without another job',async()=>{
 const service=require('../src/schedules/service'),runs=require('../src/services/run.service');
 assert.equal(service.windowKey(new Date('2026-11-08T16:59:59Z')),'2026-11-08');
 assert.equal(service.windowKey(new Date('2026-11-08T17:00:00Z')),'2026-11-09');
 const owner=randomUUID(),requestId=randomUUID();
 await db.run("INSERT INTO users(id,email,name,password_hash,created_at,updated_at) VALUES($1,$2,'Fixture','unused',now(),now())",[owner,owner+'@test.invalid']);
 await db.run("INSERT INTO requests(id,owner_id,topic,goal) VALUES($1,$2,'Reuse scheduled run','No duplicate jobs')",[requestId,owner]);
 const schedule=await service.create(owner,{requestId,enabled:true,options:{searchMore:false}}),windowKey=service.windowKey();
 const existing=await runs.create(requestId,schedule.options,`schedule:${schedule.scheduleId}:${windowKey}`);
 const accepted=await service.dispatch(owner,{scheduleId:schedule.scheduleId,windowKey});
 assert.equal(accepted.runId,existing.id);
 assert.equal((await db.get('SELECT count(*) AS n FROM research_runs WHERE request_id=$1',[requestId])).n,1);
 assert.equal((await db.get('SELECT count(*) AS n FROM stage_jobs WHERE run_id=$1',[existing.id])).n,1);
});
