const {test}=require('node:test'),assert=require('node:assert/strict');
const db=require('../src/config/database');
test('PostgreSQL migration tracking is idempotent and FK lookups have usable indexes',async()=>{
 await db.initializeDatabase();await db.initializeDatabase();
 assert.equal((await db.get('SELECT count(*) AS n FROM postgres_schema_migrations')).n,4);
 await db.transaction(async tx=>{
  await tx.run('SET LOCAL enable_seqscan=off');
  for(const table of ['research_runs','source_versions','report_versions','analysis_versions','source_chunks_v2']){
   const col=table==='research_runs'?'request_id':'run_id';
   const rows=await tx.all(`EXPLAIN SELECT * FROM ${table} WHERE ${col}=$1`,['id']);
   assert.ok(rows.some(r=>/Index|Bitmap/.test(r['QUERY PLAN'])),JSON.stringify(rows));
  }
 });
});
