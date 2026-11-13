require('../config/environment').loadEnvironment();
const fs=require('node:fs'), db=require('../config/database');
(async()=>{try{
 const stamp=fs.statSync('/tmp/research-worker-heartbeat');
 if(Date.now()-stamp.mtimeMs>=45000)throw Error('stale heartbeat');
 if(!await db.get("SELECT version FROM postgres_schema_migrations WHERE version='002_search_and_integrity.sql'"))throw Error('missing migration');
}catch{process.exitCode=1;}finally{await db.close();}})();
