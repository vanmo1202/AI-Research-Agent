// Offline/rehearsal tool only. The server and worker never import node:sqlite.
const {DatabaseSync}=require('node:sqlite');
const {createHash}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
const tables=require('./tables.json');
const db=require('../../src/config/database');
const digest=v=>createHash('sha256').update(v).digest('hex');
function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
 return value;
}
function canonical(row,columns){return columns.map(c=>{
 const v=row[c.column_name];if(v===null)return null;
 if(c.data_type==='jsonb')return stable(typeof v==='string'?JSON.parse(v):v);
 if(c.data_type==='timestamp with time zone'){
  const raw=String(v);const t=new Date(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d+)?$/.test(raw)?raw.replace(' ','T')+'Z':raw);
  if(!Number.isFinite(t.getTime()))throw Error('Invalid timestamp in '+c.column_name);return t.toISOString();
 }
 if(c.data_type==='boolean'){
  if(![0,1,false,true].includes(v))throw Error('Invalid boolean');return v?1:0;
 }
 if(['integer','bigint','double precision'].includes(c.data_type)){
  const n=Number(v);if(!Number.isFinite(n)||c.data_type!=='double precision'&&!Number.isSafeInteger(n))throw Error('Unsafe numeric value');return n;
 }
 return v;
});}
function hashRows(rows,columns){return digest(JSON.stringify(rows.map(r=>canonical(r,columns))));}
async function importSqlite(filename,{verifyOnly=false,documentRoot}={}){
 if(!path.isAbsolute(filename)||!fs.statSync(filename).isFile())throw Error('Existing absolute SQLite path required');
 const source=new DatabaseSync(filename,{readOnly:true});
 try{
  source.exec('PRAGMA query_only=ON; BEGIN');
  if(source.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||source.prepare('PRAGMA foreign_key_check').all().length)throw Error('SQLite integrity check failed');
  const objects=source.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  const unknown=objects.filter(t=>!tables.includes(t.name)&&!/^document_chunks_fts(?:_|$)|^agent_memories_fts(?:_|$)/.test(t.name));
  if(unknown.length)throw Error('Unmapped SQLite tables: '+unknown.map(t=>t.name).join(','));
  if(tables.some(t=>!objects.some(o=>o.name===t)))throw Error('SQLite schema is not at the supported 007 revision; upgrade a COPY offline first');
  const snapshots={};for(const table of tables)snapshots[table]=source.prepare(`SELECT rowid AS __position,* FROM "${table}" ORDER BY rowid`).all();
  const docs=snapshots.documents.filter(d=>!d.deleted_at);
  const files=[];
  if(docs.length&&!documentRoot)throw Error('DOCUMENT_STORAGE_PATH/--documents is required to verify PDF bytes');
  for(const doc of docs){
   if(!/^[\w.-]+$/.test(doc.storage_name)||doc.storage_name==='..')throw Error('Unsafe PDF storage name');
   const file=path.join(documentRoot,doc.storage_name),bytes=fs.readFileSync(file);
   if(bytes.length!==doc.byte_size||digest(bytes)!==doc.sha256)throw Error('PDF checksum/size mismatch for document '+doc.id);
   files.push({id:doc.id,sha256:doc.sha256,byteSize:doc.byte_size});
  }
  if(!verifyOnly)await db.initializeDatabase();
  return await db.transaction(async tx=>{
   // Lock all imported tables against app writes; operator must still freeze old SQLite writers.
   if(!verifyOnly)await tx.query('LOCK TABLE '+tables.map(t=>'"'+t+'"').join(',')+' IN SHARE ROW EXCLUSIVE MODE');
   const definitions={};const manifest={tables:{},pdfFiles:files,sourceSchemaHash:digest(JSON.stringify(objects))};
   for(const table of tables){
    const columns=(await tx.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 ORDER BY ordinal_position",[table])).rows;
    const sourceCols=source.prepare(`PRAGMA table_info("${table}")`).all().map(c=>c.name);
    const supported=columns.filter(c=>sourceCols.includes(c.column_name));
    if(supported.length!==sourceCols.length)throw Error('Unmapped columns in '+table);
    definitions[table]=supported;
    manifest.tables[table]={count:snapshots[table].length,sha256:hashRows(snapshots[table],supported)};
   }
   const sourceHash=digest(JSON.stringify(manifest)),old=await tx.get('SELECT manifest FROM sqlite_imports WHERE source_hash=$1',[sourceHash]);
   const reconcile=async()=>{
    for(const table of tables){
     const cols=definitions[table];
     const rows=(await tx.query(`SELECT ${cols.map(c=>'"'+c.column_name+'"').join(',')} FROM "${table}" ORDER BY legacy_position`)).rows;
     const expected=manifest.tables[table];
     if(rows.length!==expected.count||hashRows(rows,cols)!==expected.sha256)throw Error('Reconciliation mismatch: '+table);
    }
   };
   if(old||verifyOnly){await reconcile();return {verified:true,replayed:!!old,sourceHash,...manifest};}
   for(const table of tables)if((await tx.get(`SELECT count(*) AS n FROM "${table}"`)).n)throw Error('Target is not empty: '+table+'; refusing to overwrite/merge data');
   for(const table of tables){
    const cols=definitions[table];
    for(const row of snapshots[table]){
     // Canonical validation catches malformed JSON/dates before PostgreSQL casts.
     canonical(row,cols);
     const values=cols.map(c=>c.data_type==='timestamp with time zone'&&row[c.column_name]!==null?canonical(row,[c])[0]:row[c.column_name]);
     await tx.run(`INSERT INTO "${table}" (${cols.map(c=>'"'+c.column_name+'"').join(',')},legacy_position) VALUES(${values.map((_,i)=>'$'+(i+1)).join(',')},$${values.length+1})`,[...values,row.__position]);
    }
    // Explicit IDs and positions require sequence advancement, including empty tables.
    for(const col of ['id','legacy_position'].filter(c=>c==='legacy_position'||cols.some(v=>v.column_name===c))){
     const sequence=(await tx.get('SELECT pg_get_serial_sequence($1,$2) AS name',[table,col])).name;
     if(sequence)await tx.run(`SELECT setval($1::regclass,GREATEST(COALESCE((SELECT max("${col}") FROM "${table}"),0),1),(SELECT count(*)>0 FROM "${table}"))`,[sequence]);
    }
   }
   await reconcile();
   // PostgreSQL constraints are immediate; additionally validate polymorphic ownership links.
   const mismatch=await tx.get(`SELECT 1 FROM research_documents d JOIN requests r ON r.id=d.request_id JOIN documents p ON p.id=d.document_id WHERE d.owner_id<>r.owner_id OR d.owner_id<>p.owner_id
    UNION ALL SELECT 1 FROM chat_sessions c JOIN requests r ON r.id=c.request_id WHERE c.owner_id<>r.owner_id
    UNION ALL SELECT 1 FROM agent_memories m JOIN requests r ON r.id=m.request_id WHERE m.owner_id<>r.owner_id LIMIT 1`);
   if(mismatch)throw Error('Ownership relationship mismatch');
   await tx.run('INSERT INTO sqlite_imports(source_hash,manifest) VALUES($1,$2)',[sourceHash,JSON.stringify(manifest)]);
   return {verified:true,replayed:false,sourceHash,...manifest};
  },{readOnly:verifyOnly});
 }finally{try{source.exec('ROLLBACK');}catch{}source.close();}
}
module.exports={importSqlite,canonical,hashRows};
if(require.main===module){
 process.umask(0o077);
 const file=process.argv[2],verifyOnly=process.argv.includes('--verify-only');
 const docIndex=process.argv.indexOf('--documents'),documentRoot=docIndex<0?process.env.DOCUMENT_STORAGE_PATH:process.argv[docIndex+1];
 importSqlite(file,{verifyOnly,documentRoot}).then(report=>{
  const output=process.env.MIGRATION_REPORT_PATH;if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({verified:report.verified,replayed:report.replayed,sourceHash:report.sourceHash,tables:Object.fromEntries(Object.entries(report.tables).map(([t,v])=>[t,v.count])),pdfFiles:report.pdfFiles.length}));
 }).catch(e=>{console.error('SQLite import failed:',e.code||e.message);process.exitCode=1}).finally(()=>db.close());
}
