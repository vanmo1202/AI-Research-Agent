import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import WorkspaceAccess from '../components/knowledge/WorkspaceAccess';
import ChatPanel from '../components/knowledge/ChatPanel';
import MemoryReviewPanel from '../components/knowledge/MemoryReviewPanel';
import useKnowledge from '../hooks/useKnowledge';
import useResearchHistory from '../hooks/useResearchHistory';
import { knowledgeApi, resourcePath } from '../services/knowledgeApi';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ErrorMessage from '../components/ui/ErrorMessage';
function Chat() {
  const { requestId, chatId } = useParams(),
    navigate = useNavigate(),
    history = useResearchHistory();
  const [lookup, setLookup] = useState(''),
    [scope, setScope] = useState('documents'),
    [selected, setSelected] = useState([]),
    [memories, setMemories] = useState([]),
    [accepted, setAccepted] = useState([]),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    lock = useRef(false);
  const encoded = encodeURIComponent(requestId || '');
  const chats = useKnowledge(requestId ? `/research/${encoded}/chats` : null);
  const docs = useKnowledge(requestId ? `/documents?researchId=${encoded}` : null);
  async function create(e) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const session = await knowledgeApi(`/research/${encoded}/chats`, {
        method: 'POST',
        body: {
          scope,
          documentIds: scope === 'research' ? [] : selected,
          memoryIds: scope === 'combined' ? accepted : [],
        },
      });
      chats.reload();
      navigate(`/research/${encoded}/chat/${session.id}`);
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function recall() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      setMemories(
        await knowledgeApi(`/research/${encoded}/memory-recall`, { method: 'POST', body: {} }),
      );
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function remove(id) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await knowledgeApi(resourcePath('chats', id), { method: 'DELETE' });
      chats.reload();
      if (chatId === id) navigate(`/research/${encoded}/chat`);
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!requestId)
    return (
      <Card className="knowledge-card">
        <h1>Chat với nghiên cứu</h1>
        <form
          className="knowledge-form"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/research/${encodeURIComponent(lookup.trim())}/chat`);
          }}
        >
          <label>
            Request ID
            <input
              required
              list="chat-research-list"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
            />
          </label>
          <datalist id="chat-research-list">
            {history.map((r) => (
              <option key={r.requestId} value={r.requestId}>
                {r.topic}
              </option>
            ))}
          </datalist>
          <Button type="submit">Mở nghiên cứu để chat</Button>
        </form>
      </Card>
    );
  return (
    <div className="page-enter">
      <div className="page-intro">
        <div>
          <h1>Chat với nghiên cứu</h1>
          <Link to={`/research/${encoded}`}>Xem kế hoạch & nguồn</Link>
        </div>
      </div>
      <ErrorMessage error={error || chats.error || docs.error} />
      <Button
        variant="ghost"
        onClick={() => {
          chats.reload();
          docs.reload();
        }}
      >
        Tải lại danh sách chat
      </Button>
      <div className="knowledge-chat-layout">
        <aside>
          <Card className="knowledge-card">
            <h2>Hội thoại</h2>
            <ul className="chat-session-list">
              {chats.data?.map((c) => (
                <li key={c.id}>
                  <Link
                    aria-current={c.id === chatId ? 'page' : undefined}
                    to={`/research/${encoded}/chat/${c.id}`}
                  >
                    {c.title} · {c.scope} · {new Date(c.created_at).toLocaleString('vi-VN')}
                  </Link>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => remove(c.id)}
                    aria-label={`Xóa hội thoại ${c.id}`}
                  >
                    Xóa
                  </button>
                </li>
              ))}
            </ul>
            <h2>Hội thoại mới</h2>
            <form onSubmit={create} className="knowledge-form">
              <label>
                Phạm vi
                <select value={scope} onChange={(e) => setScope(e.target.value)}>
                  <option value="documents">PDF được chọn</option>
                  <option value="research">Nguồn & bằng chứng nghiên cứu</option>
                  <option value="combined">PDF + nghiên cứu + bộ nhớ được chọn</option>
                </select>
              </label>
              {scope !== 'research' && (
                <fieldset>
                  <legend>PDF đã gắn</legend>
                  {docs.data
                    ?.filter((d) => d.status === 'ready')
                    .map((d) => (
                      <label className="knowledge-checkbox" key={d.id}>
                        <input
                          type="checkbox"
                          checked={selected.includes(d.id)}
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
                  <Link to="/documents">Tải hoặc gắn tài liệu</Link>
                </fieldset>
              )}
              {scope === 'combined' && (
                <>
                  <Button variant="ghost" onClick={recall} disabled={busy}>
                    Tìm bộ nhớ liên quan
                  </Button>
                  <MemoryReviewPanel
                    memories={memories}
                    selected={accepted}
                    onChange={setAccepted}
                  />
                </>
              )}
              <Button
                type="submit"
                disabled={busy || !!chats.error || (scope === 'documents' && !selected.length)}
              >
                Tạo hội thoại
              </Button>
            </form>
          </Card>
        </aside>
        {chatId ? (
          <Card className="knowledge-card">
            {chats.loading ? (
              <p role="status">Đang kiểm tra hội thoại...</p>
            ) : chats.data?.some((c) => c.id === chatId) ? (
              <ChatPanel key={chatId} chatId={chatId} />
            ) : (
              <ErrorMessage
                error={
                  new Error('Hội thoại không thuộc danh sách nghiên cứu này hoặc chưa tải được.')
                }
              />
            )}
          </Card>
        ) : (
          <Card className="knowledge-card">
            <h2>Bắt đầu từ nguồn đã chọn</h2>
            <p>
              Tạo hoặc mở hội thoại. Trợ lý chỉ trả lời từ các đoạn truy xuất; chưa đủ nguồn sẽ
              thông báo rõ ràng.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
export default function ResearchChatPage() {
  const { requestId } = useParams();
  return (
    <WorkspaceAccess>
      <Chat key={requestId || 'picker'} />
    </WorkspaceAccess>
  );
}
