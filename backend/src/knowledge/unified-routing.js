// Deterministic routing: no planner call, no private text in search queries.
const fold = value => String(value).normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/g,'d').toLowerCase();
const followupIntent = q => /^(noi (ro|chi tiet)|chi tiet hon|tiep tuc|tom tat lai|giai thich them|cho (toi )?vi du|con |vay |no |chung |why|what about|tell me more|continue)/.test(q);
const webIntent = q => /moi nhat|hien nay|hien tai|hom nay|gan day|cap nhat|latest|current|today|recent|\b20\d{2}\b|\b(ceo|president|exchange rate|weather|stock price)\b|gia (vang|co phieu|bitcoin)|gia .{0,50}(bao nhieu|hien)|thoi tiet|ty gia|tong thong|thu tuong|tim (kiem )?(them )?(nguon|tren)|nguon bo sung|kiem chung|xac minh|dan nguon|nguon (web|internet)|\b(search for|search the web|browse|find (additional )?sources|cite sources|verify|citations|internet sources)\b|^(search|tim kiem)\b/.test(q);
const documentIntent = q => /\b(pdf|tai lieu|tep|file|document|attachment)\b/.test(q);
function subject(history) {
  const resolved = history.filter(m => m.role === 'assistant').at(-1)?.research?.question;
  return resolved || history.filter(m => m.role === 'user' && !followupIntent(fold(m.content))).at(-1)?.content || history.filter(m => m.role === 'user').at(-1)?.content || '';
}
function route(question, session, local = [], history = []) {
  const q = fold(question);
  const previous = fold(subject(history));
  const followup = followupIntent(q);
  const only = /(?:chi|chi duoc|only|solely|exclusively).{0,35}(?:pdf|tai lieu|tep|file|document)|(?:khong|dung).{0,12}(?:tim|dung|su dung).{0,12}(?:web|internet)|do not (?:search|browse)/.test(q);
  const inheritedOnly = followup && (history.filter(m => m.role === 'assistant').at(-1)?.research?.onlyDocuments || /(?:chi|only|solely).{0,35}(pdf|tai lieu|file|document)/.test(previous));
  const docs = only || inheritedOnly || documentIntent(q) || (followup && documentIntent(previous));
  const web = webIntent(q) || (followup && webIntent(previous));
  const privateOnly = !session.auto_research;
  const wantsWeb = web && !(only || inheritedOnly || privateOnly);
  const useDocs = docs || local.some(c => c.kind === 'document');
  return {
    strategy: privateOnly ? 'DOCUMENT_RAG' : wantsWeb ? (useDocs ? 'HYBRID' : 'WEB_SEARCH') : useDocs ? 'DOCUMENT_RAG' : 'DIRECT',
    blockedWeb: wantsWeb && !session.internet_enabled,
    onlyDocuments: only || inheritedOnly,
  };
}
module.exports = {route, fold, followupIntent, subject};
