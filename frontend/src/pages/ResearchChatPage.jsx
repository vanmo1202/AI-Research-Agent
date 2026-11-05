import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, MessageSquareText, Plus, RefreshCw, Trash2 } from 'lucide-react';
import WorkspaceAccess from '../components/knowledge/WorkspaceAccess';
import ChatPanel from '../components/knowledge/ChatPanel';
import MemoryReviewPanel from '../components/knowledge/MemoryReviewPanel';
import useKnowledge from '../hooks/useKnowledge';
import useResearchHistory from '../hooks/useResearchHistory';
import { knowledgeApi, resourcePath } from '../services/knowledgeApi';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ErrorMessage from '../components/ui/ErrorMessage';

function Chat(){
  const {requestId,chatId}=useParams(),navigate=useNavigate(),history=useResearchHistory();
  const [lookup,setLookup]=useState(''),[scope,setScope]=useState('documents'),[selected,setSelected]=useState([]),
    [memories,setMemories]=useState([]),[accepted,setAccepted]=useState([]),[error,setError]=useState(null),
    [busy,setBusy]=useState(false),[creating,setCreating]=useState(!chatId),lock=useRef(false);
  const encoded=encodeURIComponent(requestId||'');
  const chats=useKnowledge(requestId?`/research/${encoded}/chats`:null);
  const docs=useKnowledge(requestId?`/documents?researchId=${encoded}`:null);
  async function create(e){
    e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError(null);
    try{
      const session=await knowledgeApi(`/research/${encoded}/chats`,{method:'POST',body:{
        scope,documentIds:scope==='research'?[]:selected,memoryIds:scope==='combined'?accepted:[]
      }});
      chats.reload();setCreating(false);navigate(`/research/${encoded}/chat/${session.id}`);
    }catch(e){setError(e);}
    finally{lock.current=false;setBusy(false);}
  }
  async function recall(){
    if(lock.current)return;lock.current=true;setBusy(true);setError(null);
    try{setMemories(await knowledgeApi(`/research/${encoded}/memory-recall`,{method:'POST',body:{}}));}
    catch(e){setError(e);}finally{lock.current=false;setBusy(false);}
  }
  async function remove(id){
    if(lock.current)return;
    if(!window.confirm('Xóa cuộc hội thoại này?'))return;
    lock.current=true;setBusy(true);setError(null);
    try{await knowledgeApi(resourcePath('chats',id),{method:'DELETE'});chats.reload();if(chatId===id)navigate(`/research/${encoded}/chat`);}
    catch(e){setError(e);}finally{lock.current=false;setBusy(false);}
  }
  if(!requestId)return <div className="page-enter ro-chat-page">
    <div className="ro-page-heading"><div><p className="ro-kicker">KNOWLEDGE / AI CHAT</p><h1>Chat với tài liệu</h1><p>Chọn nghiên cứu để bắt đầu hỏi đáp với PDF, nguồn web và bộ nhớ AI.</p></div></div>
    <Card className="knowledge-card ro-chat-picker"><MessageSquareText size={30}/>
      <h2>Mở không gian chat nghiên cứu</h2>
      <form className="knowledge-form" onSubmit={e=>{e.preventDefault();if(lookup.trim())navigate(`/research/${encodeURIComponent(lookup.trim())}/chat`);}}>
        <label>Chọn nghiên cứu
          <input required list="chat-research-list" value={lookup} onChange={e=>setLookup(e.target.value)} placeholder="Chọn chủ đề hoặc nhập Request ID"/>
        </label>
        <datalist id="chat-research-list">{history.map(r=><option key={r.requestId} value={r.requestId}>{r.topic}</option>)}</datalist>
        <Button type="submit">Mở nghiên cứu để chat</Button>
      </form>
      {!history.length&&<p>Chưa có nghiên cứu trong lịch sử trình duyệt. <Link to="/workflow-1">Tạo nghiên cứu mới</Link></p>}
    </Card>
  </div>;
  return <div className="page-enter ro-chat-page">
    <div className="ro-page-heading"><div><p className="ro-kicker">KNOWLEDGE / AI CHAT</p><h1>Chat với tài liệu</h1><p>Hỏi đáp dựa trên tài liệu, nghiên cứu và tri thức đã được xác minh.</p></div>
      <Link className="button button-secondary" to={`/research/${encoded}`}><ArrowLeft size={15}/> Xem nghiên cứu</Link></div>
    <ErrorMessage error={error||chats.error||docs.error}/>
    <div className="knowledge-chat-layout ro-chat-layout">
      <aside className="ro-chat-sidebar">
        <Card className="knowledge-card">
          <Button className="w-full" onClick={()=>setCreating(v=>!v)}><Plus size={16}/> Hội thoại mới</Button>
          {creating&&<form onSubmit={create} className="knowledge-form ro-new-chat-form">
            <label>Phạm vi nguồn
              <select value={scope} onChange={e=>setScope(e.target.value)}>
                <option value="documents">PDF được chọn</option>
                <option value="research">Nguồn & bằng chứng nghiên cứu</option>
                <option value="combined">PDF + nghiên cứu + bộ nhớ được chọn</option>
              </select>
            </label>
            {scope!=='research'&&<fieldset><legend>PDF đã gắn</legend>
              {docs.data?.filter(d=>d.status==='ready').map(d=><label className="knowledge-checkbox" key={d.id}>
                <input type="checkbox" checked={selected.includes(d.id)} onChange={e=>setSelected(e.target.checked?[...selected,d.id]:selected.filter(id=>id!==d.id))}/>{d.filename}
              </label>)}
              <Link to="/documents">Tải hoặc gắn tài liệu</Link>
            </fieldset>}
            {scope==='combined'&&<><Button variant="ghost" onClick={recall} disabled={busy}>Tìm bộ nhớ liên quan</Button>
              <MemoryReviewPanel memories={memories} selected={accepted} onChange={setAccepted}/></>}
            <Button type="submit" loading={busy} disabled={busy||!!chats.error||(scope==='documents'&&!selected.length)}>Tạo hội thoại</Button>
          </form>}
          <div className="ro-chat-sidebar-heading"><h2>Hội thoại</h2>
            <button type="button" className="ro-icon-btn" aria-label="Làm mới danh sách chat" onClick={()=>{chats.reload();docs.reload();}}><RefreshCw size={15}/></button>
          </div>
          <ul className="chat-session-list">
            {chats.data?.map(c=><li key={c.id}>
              <Link aria-current={c.id===chatId?'page':undefined} to={`/research/${encoded}/chat/${c.id}`}>
                <MessageSquareText size={15}/><span>{c.title||'Hội thoại mới'}</span>
              </Link>
              <button type="button" disabled={busy} className="ro-chat-delete" aria-label={`Xóa hội thoại ${c.title||c.id}`} onClick={()=>remove(c.id)}><Trash2 size={14}/></button>
            </li>)}
            {!chats.loading&&!chats.data?.length&&<li className="ro-chat-hint">Chưa có hội thoại nào.</li>}
          </ul>
        </Card>
      </aside>
      <div className="ro-chat-main">
        {chatId?<Card className="knowledge-card ro-chat-content">
          {chats.loading?<p role="status">Đang kiểm tra hội thoại...</p>:
          chats.data?.some(c=>c.id===chatId)?<ChatPanel key={chatId} chatId={chatId}/>:
          <ErrorMessage error={new Error('Hội thoại không thuộc danh sách nghiên cứu này hoặc chưa tải được.')}/>}
        </Card>:<Card className="knowledge-card ro-chat-intro"><BookOpen size={34}/><h2>Bắt đầu hội thoại với tri thức của bạn</h2><p>Chọn hội thoại ở bên trái hoặc tạo hội thoại mới. Trợ lý chỉ sử dụng nguồn đã chọn và cung cấp trích dẫn để kiểm tra.</p>
          <Button onClick={()=>setCreating(true)}><Plus size={16}/> Tạo hội thoại mới</Button></Card>}
      </div>
    </div>
  </div>;
}
export default function ResearchChatPage(){
  const {requestId}=useParams();
  return <WorkspaceAccess><Chat key={requestId||'picker'}/></WorkspaceAccess>;
}