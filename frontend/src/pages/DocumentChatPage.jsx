import { useRef } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, MessageSquareText } from 'lucide-react';
import useKnowledge from '../hooks/useKnowledge';
import { knowledgeApi } from '../services/knowledgeApi';
import ChatPanel from '../components/knowledge/ChatPanel';
import ChatMessage from '../components/knowledge/ChatMessage';
import Button from '../components/ui/Button';
import ErrorMessage from '../components/ui/ErrorMessage';
import '../styles/unified-chat.css';
export default function DocumentChatPage() {
  const { chatId, requestId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const current = useKnowledge(chatId ? `/chats/${encodeURIComponent(chatId)}` : null);
  const selected =
    current.data?.request_id || (!chatId ? requestId || params.get('researchId') : null);
  const researches = useKnowledge('/research');
  const research = useKnowledge(selected ? `/research/${encodeURIComponent(selected)}` : null);
  const chats = useKnowledge(
    selected ? `/research/${encodeURIComponent(selected)}/chats` : '/chats',
  );
  const legacy = chatId && current.data && !current.data.request_id;
  const oldMessages = useKnowledge(legacy ? `/chats/${encodeURIComponent(chatId)}/messages` : null);
  const draft = useRef(null);
  async function ensureChat() {
    if (chatId && !legacy) return chatId;
    if (!selected) throw new Error('Chọn nghiên cứu trước khi Chat.');
    if (!draft.current)
      draft.current = (async () => {
        const documentId = params.get('documentId');
        if (documentId)
          await knowledgeApi(`/research/${encodeURIComponent(selected)}/documents`, {
            method: 'POST',
            body: { documentId },
          });
        return knowledgeApi(`/research/${encodeURIComponent(selected)}/chats`, {
          method: 'POST',
          body: {
            mode: 'auto',
            scope: 'combined',
            ...(documentId ? { documentIds: [documentId] } : {}),
          },
        });
      })().catch((error) => {
        draft.current = null;
        throw error;
      });
    return (await draft.current).id;
  }
  function opened(id) {
    draft.current = null;
    chats.reload();
    navigate(`/research/${encodeURIComponent(selected)}/chat/${encodeURIComponent(id)}`, {
      replace: true,
    });
  }
  const study = research.data?.request;
  return (
    <div className="page-enter unified-chat">
      <div className="ro-page-heading">
        <div>
          <h1>AI Research Chat</h1>
          <p>{study?.topic || 'Chọn nghiên cứu để hỏi AI về khái niệm, kết quả và bằng chứng.'}</p>
        </div>
        {selected && (
          <Button variant="secondary" to="/chat">
            Chọn nghiên cứu khác
          </Button>
        )}
      </div>
      <ErrorMessage error={current.error || research.error || researches.error} />
      {chatId && current.loading ? (
        <p role="status">Đang tải hội thoại…</p>
      ) : (
        <>
          {!selected && (
            <section className="os-panel" aria-label="Chọn nghiên cứu">
              <h2>Nghiên cứu của bạn</h2>
              {researches.loading && <p role="status">Đang tải nghiên cứu…</p>}
              <ul className="chat-session-list">
                {researches.data?.map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/research/${encodeURIComponent(r.id)}/chat${params.get('documentId') ? `?documentId=${encodeURIComponent(params.get('documentId'))}` : ''}`}
                    >
                      {r.topic}
                    </Link>
                  </li>
                ))}
              </ul>
              {!researches.loading && !researches.data?.length && (
                <p>
                  Chưa có nghiên cứu. <Link to="/workflow-1">Tạo nghiên cứu</Link>
                </p>
              )}
            </section>
          )}
          <div className="unified-chat-layout">
            <aside className="unified-chat-history" aria-label="Lịch sử hội thoại">
              {selected && (
                <Button
                  onClick={() => {
                    draft.current = null;
                    navigate(`/research/${encodeURIComponent(selected)}/chat`);
                  }}
                >
                  <Plus size={16} />
                  Chat mới trong nghiên cứu
                </Button>
              )}
              <ErrorMessage error={chats.error} />
              <ul className="chat-session-list">
                {chats.data?.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={
                        c.request_id
                          ? `/research/${encodeURIComponent(c.request_id)}/chat/${encodeURIComponent(c.id)}`
                          : `/chat/${encodeURIComponent(c.id)}`
                      }
                      aria-current={c.id === chatId ? 'page' : undefined}
                    >
                      <MessageSquareText size={16} />
                      <span>
                        {c.title}
                        {!c.request_id ? ' · Lịch sử cũ' : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
            <section className="unified-chat-main" aria-label="Hội thoại nghiên cứu">
              {selected && study && (!chatId || current.data) && (
                <>
                  <p className="unified-study">
                    <strong>{study.topic}</strong>
                    <br />
                    {study.goal}
                  </p>
                  {!chatId && (
                    <p className="unified-suggestions">
                      Gợi ý: Giải thích rõ hơn kết luận này · Nguồn nào hỗ trợ nhận định trên? · Cho
                      ví dụ dễ hiểu hơn · Có bằng chứng nào còn thiếu?
                    </p>
                  )}
                  <ChatPanel
                    key={`${selected}/${chatId || 'new'}`}
                    chatId={chatId}
                    session={current.data}
                    onEnsureChat={ensureChat}
                    onCreated={opened}
                    initialDocumentIds={params.get('documentId') ? [params.get('documentId')] : []}
                  />
                </>
              )}
              {legacy && (
                <>
                  <p>
                    Hội thoại cũ được giữ để đọc lại. Chọn nghiên cứu để tạo Chat mới có ngữ cảnh.
                  </p>
                  <ErrorMessage error={oldMessages.error} />
                  {oldMessages.data?.map((m) => (
                    <ChatMessage key={m.id} message={m} />
                  ))}
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
