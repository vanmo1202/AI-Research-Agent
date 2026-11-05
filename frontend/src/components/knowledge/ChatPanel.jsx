import { useEffect, useRef, useState } from 'react';
import { BookOpen, RefreshCw, Send, Sparkles } from 'lucide-react';
import useKnowledge from '../../hooks/useKnowledge';
import { knowledgeApi, resourcePath } from '../../services/knowledgeApi';
import ChatMessage from './ChatMessage';
import Button from '../ui/Button';
import ErrorMessage from '../ui/ErrorMessage';

export default function ChatPanel({ chatId }) {
  const path=`${resourcePath('chats',chatId)}/messages`;
  const result=useKnowledge(path,true);
  const lock=useRef(false);
  const [question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(null);
  useEffect(()=>{setQuestion('');setError(null);},[chatId]);
  async function send(e){
    e.preventDefault();
    if(lock.current||!question.trim())return;
    lock.current=true;setBusy(true);setError(null);
    try{
      await knowledgeApi(path,{method:'POST',body:{content:question.trim(),clientToken:crypto.randomUUID()}});
      setQuestion('');
    }catch(e){setError(e);}
    finally{lock.current=false;setBusy(false);result.reload();}
  }
  const pending=result.data?.some(m=>m.status==='pending');
  const citations=[...new Map((result.data||[]).flatMap(m=>m.citations||[]).map(c=>[JSON.stringify([c.referenceId,c.documentId,c.sourceId,c.page]),c])).values()];
  return <div className="ro-chat-workspace">
    <section className="chat-panel" aria-label="Hội thoại">
      <div className="ro-chat-panel-bar"><h2><Sparkles size={16}/> Trợ lý nghiên cứu</h2>
        <button type="button" className="ro-icon-btn" onClick={result.reload} aria-label="Làm mới hội thoại"><RefreshCw size={17}/></button>
      </div>
      <ErrorMessage error={result.error||error}/>
      {result.loading && <p role="status">Đang tải hội thoại...</p>}
      {!result.loading&&!result.data?.length&&<div className="ro-empty"><BookOpen size={30}/><h3>Hỏi đáp cùng tài liệu</h3><p>Đặt câu hỏi về nguồn đã chọn. Mỗi câu trả lời sẽ kèm trích dẫn để đối chiếu.</p></div>}
      <div className="chat-messages" aria-live="polite">
        {result.data?.map(m=><ChatMessage key={m.id} message={m}/>)}
      </div>
      <form className="ro-chat-composer" onSubmit={send}>
        <label className="sr-only" htmlFor="ro-chat-question">Câu hỏi</label>
        <textarea id="ro-chat-question" required maxLength={2000} rows={2} placeholder="Nhập câu hỏi tiếp theo..."
          value={question} onChange={e=>setQuestion(e.target.value)} disabled={busy||pending}/>
        <Button type="submit" loading={busy} disabled={busy||pending||!!result.error}><Send size={16}/><span>Gửi</span></Button>
      </form>
    </section>
    <aside className="ro-chat-sources" aria-label="Nguồn trích dẫn">
      <h2>Nguồn trích dẫn ({citations.length})</h2>
      {citations.length?citations.map((citation,i)=>{
        const page=citation.page||citation.pageNumber;
        const documentId=citation.documentId||citation.document_id;
        const sourceId=citation.sourceId||citation.source_id;
        const href=documentId?`/documents/${encodeURIComponent(documentId)}${page?`?page=${encodeURIComponent(page)}`:''}`:null;
        return <div key={`${citation.referenceId||documentId||sourceId||'citation'}-${i}`} className="ro-citation-summary">
          <strong>{citation.title||citation.documentName||citation.referenceId||`Nguồn ${i+1}`}</strong>
          <p>{page?`Trang ${page} · `:''}{citation.quote||citation.text||'Trích dẫn đã được lưu cùng câu trả lời.'}</p>
          {href&&<a href={href}>Mở tài liệu</a>}
        </div>;
      }):<p>Nguồn trích dẫn từ các câu trả lời sẽ xuất hiện tại đây.</p>}
    </aside>
  </div>;
}