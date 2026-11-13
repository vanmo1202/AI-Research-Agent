const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../src/config/database');
after(async()=>{if(db.close)await db.close()});
test('PostgreSQL runtime has no SQLite fallback, uses bound parameters and rolls back nested calls',async()=>{
  await db.initializeDatabase();
  assert.equal((await db.get('SELECT current_database() AS name')).name,process.env.PGDATABASE);
  await assert.rejects(db.transaction(async tx=>{
    await tx.run("INSERT INTO requests(id,topic,goal) VALUES($1,$2,$3)",['rollback',"x'); DROP TABLE users;--",'g']);
    assert.ok(await db.get('SELECT id FROM requests WHERE id=$1',['rollback']));
    throw Error('rollback probe');
  }),/rollback probe/);
  assert.equal(await db.get('SELECT id FROM requests WHERE id=$1',['rollback']),undefined);
});
test('Vietnamese full text search handles accent/đ, updates and deletion',async()=>{
  await db.initializeDatabase();
  await db.run("INSERT INTO documents(id,owner_id,filename,storage_name,sha256,byte_size,status,created_at,updated_at) VALUES('fts-doc','alice','x.pdf','x','sha',10,'ready',now(),now())");
  await db.run("INSERT INTO document_pages(document_id,page,content) VALUES('fts-doc',1,'Chuyển đổi dữ liệu PostgreSQL bảo đảm tính toàn vẹn')");
  await db.run("INSERT INTO document_chunks(id,document_id,page,chunk_index,content,content_hash) VALUES('fts-chunk','fts-doc',1,0,'Chuyển đổi dữ liệu PostgreSQL bảo đảm tính toàn vẹn','h')");
  const find=q=>db.all("SELECT id FROM document_chunks WHERE search_vector @@ research_query($1)",[q]);
  for(const query of ['chuyển','chuyen','đổi','doi','toan ven'])assert.equal((await find(query)).length,1);
  await db.run("UPDATE document_chunks SET content='trí tuệ nhân tạo' WHERE id='fts-chunk'");
  assert.equal((await find('chuyen')).length,0);assert.equal((await find('tri tue')).length,1);
  await db.run("DELETE FROM document_pages WHERE document_id='fts-doc'");assert.equal((await find('tri tue')).length,0);
});
test('dashboard retains camelCase fields and nullable memory maintenance ordering works',async()=>{
 let output;await require('../src/auth/dashboard')({owner:'alice'},{json:value=>{output=value;}});
 assert.equal(output.data.verifiedMemoryCount,0);
 assert.equal(Object.hasOwn(output.data,'verifiedmemorycount'),false);
 const result=await require('../src/knowledge/memory').maintain('alice');assert.ok(result);
});
test('FTS preserves Unicode61-style word boundaries for domains, email and decomposed Vietnamese',async()=>{
 await db.run("INSERT INTO document_pages(document_id,page,content) VALUES('fts-doc',2,'lexical boundary fixture')");
 await db.run('INSERT INTO document_chunks(id,document_id,page,chunk_index,content,content_hash) VALUES($1,$2,2,0,$3,$4)',['fts-boundary','fts-doc','PostgreSQL.com contact@example.org '+ 'chuyển đổi'.normalize('NFD'),'boundary']);
 for(const term of ['PostgreSQL','example','contact','chuyen','đổi']){
  const rows=await db.all("SELECT id FROM document_chunks WHERE id='fts-boundary' AND search_vector @@ research_query($1)",[term]);
  assert.equal(rows.length,1,`Missing lexical component: ${term}`);
 }
});
