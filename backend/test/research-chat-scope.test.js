const {test}=require('node:test');const assert=require('node:assert/strict');
const {guard}=require('../src/knowledge/research-context');
const research={topic:'Dao động điều hòa con lắc lò xo',goal:'Phân tích chu kỳ và phương pháp giải bài tập',questions:['Ảnh hưởng của khối lượng tới chu kỳ là gì?']};
test('scope supports translated concepts, related methods and followups',()=>{
 assert.equal(guard('Explain simple harmonic motion',research,[]),'related');
 assert.equal(guard('Định luật Hooke giúp tính lực phục hồi như thế nào?',research,[]),'related');
 assert.equal(guard('Cho ví dụ dễ hiểu hơn',research,[{role:'assistant',research:{scopeVerdict:'related'}}]),'related');
});
test('clear foreign topics and arbitrary tasks are rejected without providers',()=>{
 assert.equal(guard('Viết bài thơ tình yêu',research,[]),'unrelated');
 assert.equal(guard('Giá vàng hôm nay',research,[]),'unrelated');
 assert.equal(guard('Explain database indexes',research,[]),'unrelated');
});
