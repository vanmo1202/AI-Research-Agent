const {readdirSync,readFileSync}=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
async function migrate(pool){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('researchos:migrate',0))");
  await client.query('CREATE TABLE IF NOT EXISTS postgres_schema_migrations(version TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const dir=process.env.PG_MIGRATIONS_DIR||path.join(__dirname,'postgres');
  for(const file of readdirSync(dir).filter(n=>/^\d{3}_[\w-]+\.sql$/.test(n)).sort()){
   const sql=readFileSync(path.join(dir,file),'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
   const old=(await client.query('SELECT checksum FROM postgres_schema_migrations WHERE version=$1',[file])).rows[0];
   if(old){if(old.checksum!==checksum)throw Error('Applied migration checksum changed: '+file);continue;}
   await client.query(sql);await client.query('INSERT INTO postgres_schema_migrations(version,checksum) VALUES($1,$2)',[file,checksum]);
  }
  await client.query('COMMIT');
 }catch(e){try{await client.query('ROLLBACK');}catch{}throw e;}finally{client.release();}
}
module.exports={migrate};
if(require.main===module){const db=require('../config/database');db.initializeDatabase().then(()=>console.log('PostgreSQL migrations verified')).catch(e=>{console.error('Migration failed:',e.code||e.message);process.exitCode=1}).finally(()=>db.close());}
