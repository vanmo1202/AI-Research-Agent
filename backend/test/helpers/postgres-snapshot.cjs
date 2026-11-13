const {createHash}=require('node:crypto');
async function snapshot(db,requestId){
 const identity=await db.get('SELECT current_database() AS database, current_schema() AS schema');
 const count=await db.get('SELECT count(*) AS count FROM sources WHERE request_id=$1',[requestId]);
 const request=await db.get('SELECT status,owner_id FROM requests WHERE id=$1',[requestId]);
 const sources=await db.all('SELECT id,normalized_url,content FROM sources WHERE request_id=$1 ORDER BY id',[requestId]);
 return {...identity,count:count.count,request,sources:sources.map(s=>({id:s.id,normalizedUrl:s.normalized_url,contentHash:createHash('sha256').update(s.content||'').digest('hex')}))};
}
module.exports={snapshot};
if(require.main===module){
 const db=require('../../src/config/database');
 db.getPool().query('BEGIN READ ONLY').then(()=>snapshot(db,process.argv[3])).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.code||e.message);process.exitCode=1}).finally(()=>db.close());
}
