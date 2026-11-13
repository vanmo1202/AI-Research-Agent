const {Pool,types}=require('pg');
const {AsyncLocalStorage}=require('node:async_hooks');
const fs=require('node:fs');
// Existing services/API consume JSON strings, ISO strings, numeric counts and 0/1 flags.
// Keep that boundary while PostgreSQL stores typed values.
types.setTypeParser(20,value=>{const n=Number(value);if(!Number.isSafeInteger(n))throw Error('Unsafe BIGINT result');return n;});
types.setTypeParser(1700,value=>{const n=Number(value);if(!Number.isFinite(n))throw Error('Invalid numeric result');return n;});
types.setTypeParser(1184,value=>new Date(value).toISOString());
types.setTypeParser(114,value=>value);
types.setTypeParser(3802,value=>value);
types.setTypeParser(16,value=>value==='t'?1:0);
const context=new AsyncLocalStorage();
let pool;
function getPool(){
 if(!pool){
  const password=process.env.PGPASSWORD_FILE?fs.readFileSync(process.env.PGPASSWORD_FILE,'utf8').trimEnd():process.env.PGPASSWORD;
  const schema=process.env.PGSCHEMA||'public';
  if(!/^[a-z_][a-z0-9_]{0,62}$/.test(schema))throw Error('Invalid PGSCHEMA');
  const max=Number(process.env.PGPOOL_MAX||5);
  if(!Number.isInteger(max)||max<1||max>30)throw Error('Invalid PGPOOL_MAX');
  if(!process.env.PGDATABASE)throw Error('PGDATABASE must be configured; SQLite fallback is disabled');
  pool=new Pool({host:process.env.PGHOST||'127.0.0.1',port:Number(process.env.PGPORT||5432),user:process.env.PGUSER||'researchos',database:process.env.PGDATABASE,password,max,
   options:`-c search_path=${schema},public -c timezone=UTC`,connectionTimeoutMillis:5000,idleTimeoutMillis:1000,statement_timeout:30000,idle_in_transaction_session_timeout:30000,
   ssl:process.env.PGSSLROOTCERT?{ca:fs.readFileSync(process.env.PGSSLROOTCERT,'utf8'),rejectUnauthorized:true}:undefined,
   application_name:'researchos'});
  pool.on('error',e=>console.error('PostgreSQL idle client:',e.code||e.name));
 }
 return pool;
}
function rows(result){return result.rows.map(row=>{delete row.search_vector;delete row.legacy_position;return row;});}
function api(client){return {
 async run(sql,params=[]){const r=await client.query(sql,params);return {changes:r.rowCount,id:r.rows?.[0]?.id};},
 async get(sql,params=[]){return rows(await client.query(sql,params))[0];},
 async all(sql,params=[]){return rows(await client.query(sql,params));},
 query:(sql,params=[])=>client.query(sql,params),
};}
const connection=()=>context.getStore()||getPool();
const run=(sql,params)=>context.getStore()?api(context.getStore()).run(sql,params):transaction(tx=>tx.run(sql,params));
const get=(sql,params)=>api(connection()).get(sql,params);
const all=(sql,params)=>api(connection()).all(sql,params);
async function transaction(work,{readOnly=false}={}){
 if(context.getStore())throw Error('Nested transaction is unsupported; pass the transaction client');
 const client=await getPool().connect();
 try{
  await client.query(readOnly?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN');
  // Preserve legacy serialized RMW semantics across backend AND worker processes.
  // This lock is held only for database work; never call providers while holding it.
  if(!readOnly)await client.query("SELECT pg_advisory_xact_lock(hashtextextended('researchos:'||current_schema(),0))");
  const result=await context.run(client,()=>work(api(client)));
  await client.query('COMMIT');return result;
 }catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{client.release();}
}
async function initializeDatabase(){return require('../db/migrate').migrate(getPool());}
async function close(){if(pool){const p=pool;pool=undefined;await p.end();}}
module.exports={run,get,all,transaction,initializeDatabase,getPool,close};
