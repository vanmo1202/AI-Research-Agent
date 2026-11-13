// Read-only lexical regression benchmark against the old FTS index; no PDF text is logged.
const {DatabaseSync}=require('node:sqlite');
const db=require('../../src/config/database');
async function check(filename){
 const source=new DatabaseSync(filename,{readOnly:true});
 try{
  source.exec('PRAGMA query_only=ON; BEGIN');
  if(!source.prepare("SELECT sqlite_compileoption_used('ENABLE_FTS5') AS enabled").get().enabled)throw Error('SQLite FTS5 is unavailable in this node:sqlite build; run this offline audit tool with Node.js 24. PostgreSQL runtime is unaffected.');
  const chunks=source.prepare('SELECT content FROM document_chunks ORDER BY rowid').all();
  const terms=[...new Set(chunks.flatMap(c=>(c.content.normalize('NFC').match(/[\p{L}]{4,20}/gu)||[]).slice(0,6)))].slice(0,64);
  let expected=0,recalled=0,queries=0,top24Overlap=0,top24Expected=0;
  for(const term of terms){
   const old=source.prepare('SELECT c.id FROM document_chunks_fts f JOIN document_chunks c ON c.rowid=f.rowid WHERE document_chunks_fts MATCH ? ORDER BY bm25(document_chunks_fts),c.rowid').all('"'+term+'"');
   if(!old.length)continue;
   const current=await db.all('SELECT id FROM document_chunks WHERE search_vector @@ research_query($1) ORDER BY ts_rank_cd(search_vector,research_query($1)) DESC,legacy_position',[term]);
   const ids=new Set(current.map(r=>r.id)),top=new Set(current.slice(0,24).map(r=>r.id));
   expected+=old.length;recalled+=old.filter(r=>ids.has(r.id)).length;queries++;
   top24Expected+=old.slice(0,24).length;top24Overlap+=old.slice(0,24).filter(r=>top.has(r.id)).length;
  }
  const result={queries,legacyMatches:expected,recalledMatches:recalled,lexicalRecall:expected?recalled/expected:null,top24Overlap:top24Expected?top24Overlap/top24Expected:null};
  if(!queries||result.lexicalRecall<0.95)throw Error('Retrieval recall below 0.95: '+JSON.stringify(result));return result;
 }finally{source.close();}
}
module.exports={check};
if(require.main===module)check(process.argv[2]).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.code||e.message);process.exitCode=1}).finally(()=>db.close());
