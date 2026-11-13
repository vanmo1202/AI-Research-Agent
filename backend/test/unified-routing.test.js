const {test}=require('node:test');
const assert=require('node:assert/strict');
const {route}=require('../src/knowledge/unified-routing');
const session={auto_research:true,internet_enabled:true,document_ids_json:'["pdf"]'};
test('normal questions are direct; current facts and explicit sources require web',()=>{
  for(const q of ['Giải thích React hooks','Dịch hello sang tiếng Việt','Viết hàm Python sắp xếp','Giải phương trình x² = 4']) assert.equal(route(q,session,[]).strategy,'DIRECT');
  for(const q of ['Giá vàng hôm nay','Ai là CEO của OpenAI?','Tìm nguồn về năng lượng mặt trời','What is the current exchange rate?']) assert.equal(route(q,session,[]).strategy,'WEB_SEARCH');
});
test('document instructions override Internet and hybrid needs explicit comparison',()=>{
 assert.equal(route('Chỉ dựa vào PDF, so sánh với dữ liệu mới nhất',session,[]).strategy,'DOCUMENT_RAG');
 assert.equal(route('Tóm tắt PDF',session,[]).strategy,'DOCUMENT_RAG');
 assert.equal(route('So sánh PDF với nguồn Internet hiện nay',session,[]).strategy,'HYBRID');
 assert.equal(route('Giải thích dao động điều hòa',session,[{kind:'document'}]).strategy,'DOCUMENT_RAG');
 assert.equal(route('Giá vàng hôm nay',{...session,internet_enabled:false},[]).blockedWeb,true);
});
test('document followups retain intent while unrelated topics are direct',()=>{
 const history=[{role:'user',content:'Tóm tắt PDF'}];
 assert.equal(route('Nói chi tiết hơn',session,[],history).strategy,'DOCUMENT_RAG');
 assert.equal(route('Viết chương trình JavaScript',session,[],history).strategy,'DIRECT');
});
test('programming search algorithms stay DIRECT; web followups retain freshness',()=>{
 assert.equal(route('Implement binary search in Python',session,[]).strategy,'DIRECT');
 assert.equal(route('Giải thích web development',session,[]).strategy,'DIRECT');
 assert.equal(route('Còn ở Việt Nam?',session,[],[{role:'user',content:'Giá vàng hôm nay'}]).strategy,'WEB_SEARCH');
});
test('successive followups retain original source requirements',()=>{
 assert.equal(route('Còn ở Mỹ?',session,[],[{role:'user',content:'Giá vàng hôm nay'},{role:'user',content:'Còn ở Việt Nam?'}]).strategy,'WEB_SEARCH');
 const history=[{role:'user',content:'Nói chi tiết hơn'},{role:'assistant',research:{question:'Chỉ dùng PDF: tóm tắt tài liệu. Nói chi tiết hơn',onlyDocuments:true}}];
 assert.equal(route('Còn dữ liệu hiện tại?',session,[],history).strategy,'DOCUMENT_RAG');
});
