const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const db=require('../src/config/database'),runs=require('../src/services/run.service'),model=require('../src/models/run.model');
after(()=>db.close());
test('WF01 progress observes one consistent stage/job snapshot during worker advancement',async()=>{
  await db.initializeDatabase();
  const owner=randomUUID(),requestId=randomUUID();
  await db.run("INSERT INTO users(id,email,name,password_hash,created_at,updated_at) VALUES($1,$2,'Fixture','unused',now(),now())",[owner,owner+'@test.invalid']);
  await db.run("INSERT INTO requests(id,owner_id,topic,goal) VALUES($1,$2,'Snapshot','Keep job and stage aligned')",[requestId,owner]);
  const run=await runs.create(requestId,{orchestration:'n8n'},'create');
  const original=model.jobs;
  model.jobs=async id=>{
    // A separate PostgreSQL connection commits a complete worker stage transition
    // after progress reads the run, before it reads jobs. No provider calls.
    const writer=await db.getPool().connect();
    try {
      await writer.query('BEGIN');
      await writer.query("UPDATE stage_jobs SET status='succeeded' WHERE run_id=$1 AND stage='planning'",[id]);
      await writer.query("UPDATE research_runs SET current_stage='collecting' WHERE id=$1",[id]);
      await writer.query("INSERT INTO stage_jobs(id,run_id,stage,status,idempotency_key,input_json,created_at,available_at) VALUES($1,$2,'collecting','queued','collecting:0','{}',now(),now())",[randomUUID(),id]);
      await writer.query('COMMIT');
    } catch(error){await writer.query('ROLLBACK');throw error;} finally{writer.release();}
    return original(id);
  };
  try {
    const progress=await runs.progress(requestId,run.id);
    assert.equal(progress.currentStage,progress.currentJob.stage);
    assert.equal(progress.currentJob.status,'queued');
    assert.equal(progress.currentJob.run_id,run.id);
  } finally {model.jobs=original;}
});
