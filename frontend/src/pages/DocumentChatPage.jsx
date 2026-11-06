import { useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, MessageSquareText, Plus } from 'lucide-react';
import useKnowledge, { pollDocuments } from '../hooks/useKnowledge';
import { knowledgeApi } from '../services/knowledgeApi';
import ChatPanel from '../components/knowledge/ChatPanel';
import MemoryReviewPanel from '../components/knowledge/MemoryReviewPanel';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ErrorMessage from '../components/ui/ErrorMessage';
import useResearchHistory from '../hooks/useResearchHistory';

export default function DocumentChatPage() {
  const { chatId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const browserHistory = useResearchHistory();
  const researches = useKnowledge('/research');
  const history = [
    ...new Map(
      [
        ...(researches.data || []).map((r) => ({ requestId: r.id, topic: r.topic })),
        ...browserHistory,
      ].map((r) => [r.requestId, r]),
    ).values(),
  ];
  const docs = useKnowledge('/documents', pollDocuments);
  const chats = useKnowledge('/chats');
  const current = useKnowledge(chatId ? `/chats/${encodeURIComponent(chatId)}` : null);
  const verified = useKnowledge('/memories?status=verified');
  const [selected, setSelected] = useState(
    params.get('documentId') ? [params.get('documentId')] : [],
  );
  const [memories, setMemories] = useState(params.get('memoryId') ? [params.get('memoryId')] : []);
  const [mode, setMode] = useState('auto');
  const [internet, setInternet] = useState(true);
  const [scope, setScope] = useState(params.get('memoryId') ? 'combined' : 'documents');
  const [requestId, setRequestId] = useState('');
  const [creating, setCreating] = useState(!chatId);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const lock = useRef(false);
  const ready = (docs.data || []).filter((d) => d.status === 'ready');
  const reusable = (verified.data || []).filter(
    (m) => m.request_id === null || m.kind === 'cross_research',
  );
  async function create(e) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const chat = await knowledgeApi('/chats', {
        method: 'POST',
        body: {
          ...(title.trim() ? { title: title.trim() } : {}),
          mode,
          internetEnabled: internet,
          scope,
          documentIds: selected,
          memoryIds: scope === 'combined' ? memories : [],
        },
      });
      setCreating(false);
      chats.reload();
      navigate(`/chat/${encodeURIComponent(chat.id)}`);
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const invalidSelection =
    selected.some((id) => !ready.some((d) => d.id === id)) ||
    (scope === 'combined' && memories.some((id) => !reusable.some((m) => m.id === id)));
  const canCreate =
    !invalidSelection &&
    (mode === 'auto' || selected.length || (scope === 'combined' && memories.length));
  return (
    <div className="page-enter ro-chat-page">
      <div className="ro-page-heading">
        <div>
          <p className="ro-kicker">TRI THỨC / ĐỐI THOẠI</p>
          <h1>Chat với tài liệu</h1>
          <p>
            Auto kiểm tra tri thức riêng và tự tìm Internet khi cần, đọc nguồn rồi trả lời có trích
            dẫn. Không cần tạo kế hoạch nghiên cứu.
          </p>
        </div>
        <Button to="/documents" variant="secondary">
          Thư viện PDF
        </Button>
      </div>
      <ErrorMessage error={error || chats.error || docs.error || verified.error} />
      <div className="knowledge-chat-layout ro-chat-layout">
        <aside className="ro-chat-sidebar">
          <Card className="knowledge-card">
            <Button onClick={() => setCreating((v) => !v)}>
              <Plus size={16} /> Hội thoại PDF mới
            </Button>
            {creating && (
              <form className="knowledge-form" onSubmit={create}>
                <label>
                  Chế độ trả lời
                  <select value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="auto">Auto · Tự nghiên cứu khi cần</option>
                    <option value="private">Chỉ nguồn riêng được chọn</option>
                  </select>
                </label>
                {mode === 'auto' && (
                  <label className="knowledge-checkbox">
                    <input
                      type="checkbox"
                      checked={internet}
                      onChange={(e) => setInternet(e.target.checked)}
                    />
                    Tự tìm Internet khi cần (Tavily)
                  </label>
                )}
                <p>
                  Câu hỏi/truy vấn có thể được gửi tới Tavily khi bật Internet. Không gửi văn bản
                  PDF hoặc bộ nhớ riêng vào truy vấn tìm kiếm. Tối đa 2 lượt tìm kiếm và 3 lượt
                  Gemini mỗi câu hỏi.
                </p>
                <label>
                  Tên hội thoại
                  <input
                    maxLength={150}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: Ôn tập vật lý"
                  />
                </label>
                <label>
                  Phạm vi nguồn
                  <select value={scope} onChange={(e) => setScope(e.target.value)}>
                    <option value="documents">PDF được chọn</option>
                    <option value="combined">PDF và bộ nhớ đã xác minh</option>
                  </select>
                </label>
                {invalidSelection && !docs.loading && !verified.loading && (
                  <p role="status">
                    Lựa chọn chưa sẵn sàng hoặc không còn hợp lệ.{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(selected.filter((id) => ready.some((d) => d.id === id)));
                        setMemories(memories.filter((id) => reusable.some((m) => m.id === id)));
                      }}
                    >
                      Bỏ lựa chọn không hợp lệ
                    </button>
                  </p>
                )}
                <fieldset>
                  <legend>Chọn PDF sẵn sàng (tối đa 12)</legend>
                  {docs.loading && <p role="status">Đang tải tài liệu...</p>}
                  {ready.map((d) => (
                    <label className="knowledge-checkbox" key={d.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(d.id)}
                        disabled={busy || (!selected.includes(d.id) && selected.length >= 12)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, d.id]
                              : selected.filter((id) => id !== d.id),
                          )
                        }
                      />
                      {d.filename}
                    </label>
                  ))}
                  {!docs.loading && !ready.length && (
                    <p>
                      Chưa có PDF sẵn sàng. <Link to="/documents">Tải PDF lên</Link> hoặc chờ xử lý
                      xong.
                    </p>
                  )}
                </fieldset>
                {scope === 'combined' && (
                  <MemoryReviewPanel
                    memories={reusable}
                    selected={memories}
                    onChange={setMemories}
                  />
                )}
                <Button
                  type="submit"
                  loading={busy}
                  disabled={!canCreate || !!docs.error || !!verified.error}
                >
                  {selected.length || memories.length ? 'Tạo hội thoại PDF' : 'Bắt đầu Auto Chat'}
                </Button>
              </form>
            )}
            <h2>Hội thoại của bạn</h2>
            <Button variant="ghost" onClick={chats.reload}>
              Làm mới lịch sử
            </Button>
            {chats.loading && <p role="status">Đang tải hội thoại...</p>}
            <ul className="chat-session-list">
              {chats.data?.map((c) => (
                <li key={c.id}>
                  <Link
                    aria-current={c.id === chatId ? 'page' : undefined}
                    to={
                      c.request_id
                        ? `/research/${encodeURIComponent(c.request_id)}/chat/${encodeURIComponent(c.id)}`
                        : `/chat/${encodeURIComponent(c.id)}`
                    }
                  >
                    <MessageSquareText size={15} />
                    <span>
                      {c.title}
                      <small>{c.request_id ? ' · Nghiên cứu' : ' · PDF / bộ nhớ'}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {!chats.loading && !chats.data?.length && (
              <p>Chưa có hội thoại. Chọn PDF để bắt đầu.</p>
            )}
          </Card>
          <Card className="knowledge-card">
            <h2>Chat theo nghiên cứu</h2>
            <ErrorMessage error={researches.error} />
            <form
              className="knowledge-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (requestId) navigate(`/research/${encodeURIComponent(requestId)}/chat`);
              }}
            >
              <label>
                Chọn nghiên cứu
                <select required value={requestId} onChange={(e) => setRequestId(e.target.value)}>
                  <option value="">Chọn nghiên cứu đã có</option>
                  {history.map((r) => (
                    <option key={r.requestId} value={r.requestId}>
                      {r.topic}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="secondary">
                Mở chat nghiên cứu
              </Button>
            </form>
            <p>Nguồn web, PDF đã gắn và bộ nhớ được chọn vẫn hoạt động trong nghiên cứu.</p>
          </Card>
        </aside>
        <div className="ro-chat-main">
          {chatId ? (
            <>
              <ErrorMessage error={current.error} />
              {current.loading ? (
                <p role="status">Đang kiểm tra hội thoại...</p>
              ) : (
                current.data && (
                  <Card className="knowledge-card ro-chat-content">
                    <h2>{current.data.title}</h2>
                    {current.data.request_id ? (
                      <Button
                        to={`/research/${encodeURIComponent(current.data.request_id)}/chat/${encodeURIComponent(chatId)}`}
                      >
                        Mở trong nghiên cứu
                      </Button>
                    ) : (
                      <ChatPanel key={chatId} chatId={chatId} session={current.data} />
                    )}
                  </Card>
                )
              )}
            </>
          ) : (
            <Card className="knowledge-card ro-chat-intro">
              <BookOpen size={34} />
              <h2>Hỏi từ tài liệu, kiểm tra từng trích dẫn</h2>
              <p>Tải PDF → Xem trang → Chat → Kiểm tra trích dẫn → Duyệt bộ nhớ → Dùng lại.</p>
              <p>
                Auto tự tìm kiếm Internet khi tri thức riêng chưa đủ. Tắt Internet để chỉ dùng dữ
                liệu riêng; PDF scan chưa hỗ trợ OCR.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
