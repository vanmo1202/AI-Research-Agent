// Offline ownership transfer for PostgreSQL. Original SQLite CLI is retained in test/legacy.
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const db=require('../src/config/database');
async function main(){
 process.umask(0o077);const [email,confirmation]=process.argv.slice(2);
 if(!email||confirmation!=='--transfer-all-workspace'||!process.env.PGDATABASE||!process.env.PG_BACKUP_DIR)throw Error('Usage: PG_BACKUP_DIR=/private/backups node scripts/transfer-legacy.js email --transfer-all-workspace (stop writers first)');
 const user=await db.get("SELECT id FROM users WHERE lower(email)=lower($1) AND status='active'",[email]);if(!user)throw Error('Active target user not found');
 const backup=path.join(process.env.PG_BACKUP_DIR,'ownership-'+randomUUID()+'.dump');
 const env={...process.env};if(env.PGPASSWORD_FILE)env.PGPASSWORD=fs.readFileSync(env.PGPASSWORD_FILE,'utf8').trimEnd();
 const fd=fs.openSync(backup,'wx',0o600);try{execFileSync('pg_dump',['--format=custom','--no-owner','--no-acl'],{env,stdio:['ignore',fd,'pipe']});}catch{throw Error('PostgreSQL backup failed; transfer not started');}finally{fs.closeSync(fd);}
 await db.transaction(tx=>transferWorkspace(tx,user.id));console.log('Transferred workspace; backup:',backup);
}
async function transferWorkspace(tx,userId){
  for(const table of ['requests','documents','research_documents','chat_sessions','agent_memories'])await tx.run(`UPDATE ${table} SET owner_id=$1 WHERE owner_id='workspace'`,[userId]);
  const bad=await tx.get(`SELECT 1 FROM research_documents d JOIN requests r ON r.id=d.request_id JOIN documents p ON p.id=d.document_id WHERE d.owner_id<>r.owner_id OR d.owner_id<>p.owner_id
   UNION ALL SELECT 1 FROM chat_sessions c JOIN requests r ON r.id=c.request_id WHERE c.owner_id<>r.owner_id
   UNION ALL SELECT 1 FROM agent_memories m JOIN requests r ON r.id=m.request_id WHERE m.owner_id<>r.owner_id
   UNION ALL SELECT 1 FROM agent_memories m JOIN chat_messages v ON v.id=m.message_id JOIN chat_sessions c ON c.id=v.chat_id WHERE m.owner_id<>c.owner_id OR m.request_id IS DISTINCT FROM c.request_id
   UNION ALL SELECT 1 FROM memory_evidence_links l JOIN agent_memories m ON m.id=l.memory_id JOIN documents d ON d.id=l.document_id WHERE m.owner_id<>d.owner_id
   UNION ALL SELECT 1 FROM memory_evidence_links l JOIN agent_memories m ON m.id=l.memory_id JOIN sources s ON s.id=l.source_id JOIN requests r ON r.id=s.request_id WHERE m.owner_id<>r.owner_id LIMIT 1`);
  if(bad)throw Error('Ownership relationship mismatch; transaction rolled back');

}
module.exports={transferWorkspace};
if(require.main===module)main().catch(e=>{console.error(e.code||e.message);process.exitCode=1}).finally(()=>db.close());
