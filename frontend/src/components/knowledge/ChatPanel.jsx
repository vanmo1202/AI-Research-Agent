import { useEffect, useRef, useState } from 'react';
import { BookOpen, RefreshCw, Send, Sparkles } from 'lucide-react';
import useKnowledge, { pollMessages } from '../../hooks/useKnowledge';
import { knowledgeApi, resourcePath } from '../../services/knowledgeApi';
import ChatMessage from './ChatMessage';
import Button from '../ui/Button';
import ErrorMessage from '../ui/ErrorMessage';

export default function ChatPanel({ chatId, session }) {
  const path = `${resourcePath('chats', chatId)}/messages`;
  const [busy, setBusy] = useState(false);
  const result = useKnowledge(path, busy ? true : pollMessages);
  const [internet, setInternet] = useState(!!session?.internet_enabled);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const settingsLock = useRef(false);
  const lock = useRef(false);
  const turn = useRef(null);
  const [notice, setNotice] = useState('');
  const [older, setOlder] = useState([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyEnd, setHistoryEnd] = useState(false);
  const historyLock = useRef(false);
  const [question, setQuestion] = useState(''),
    [error, setError] = useState(null);
  useEffect(() => {
    setQuestion('');
    setError(null);
    turn.current = null;
    setNotice('');
    setOlder([]);
    setHistoryEnd(false);
    setHistoryError(null);
  }, [chatId]);
  useEffect(() => {
    const submitted = turn.current;
    if (!submitted) return;
    const reply = result.data?.find((m) => m.turn_id === submitted.token && m.role === 'assistant');
    if (reply && reply.status !== 'pending') {
      turn.current = null;
      setError(null);
      if (reply.status === 'complete') setQuestion((q) => (q === submitted.content ? '' : q));
      setNotice(
        reply.status === 'complete'
          ? 'Đã xác nhận lượt trả lời trong lịch sử.'
          : reply.research?.error?.message ||
              'Lượt trước đã thất bại. Bạn có thể chủ động gửi lại.',
      );
    }
  }, [result.data]);
  async function send(e) {
    e.preventDefault();
    if (lock.current || !question.trim()) return;
    if (turn.current && turn.current.content !== question.trim()) return;
    turn.current ||= { content: question.trim(), token: crypto.randomUUID() };
    const submitted = turn.current;
    lock.current = true;
    setBusy(true);
    setNotice('');
    setError(null);
    try {
      await knowledgeApi(path, {
        method: 'POST',
        body: { content: submitted.content, clientToken: submitted.token },
      });
      setQuestion('');
      turn.current = null;
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
      result.reload();
    }
  }
  const messages = [
    ...new Map([...older, ...(result.data || [])].map((m) => [m.id, m])).values(),
  ].sort((a, b) => a.position - b.position);
  async function loadOlder() {
    if (historyLock.current || !messages.length) return;
    historyLock.current = true;
    setHistoryBusy(true);
    setHistoryError(null);
    try {
      const batch = await knowledgeApi(`${path}?before=${messages[0].position}`);
      setOlder((previous) => [...batch, ...previous]);
      setHistoryEnd(batch.length < 100);
    } catch (e) {
      setHistoryError(e);
    } finally {
      historyLock.current = false;
      setHistoryBusy(false);
    }
  }
  async function changeInternet(value) {
    if (settingsLock.current || busy) return;
    settingsLock.current = true;
    const previous = internet;
    setInternet(value);
    setSettingsBusy(true);
    setError(null);
    try {
      const updated = await knowledgeApi(`/chats/${encodeURIComponent(chatId)}/preferences`, {
        method: 'PATCH',
        body: { internetEnabled: value },
      });
      setInternet(!!updated.internet_enabled);
    } catch (e) {
      setInternet(previous);
      setError(e);
    } finally {
      settingsLock.current = false;
      setSettingsBusy(false);
    }
  }
  const pending = result.data?.some((m) => m.status === 'pending');
  const citations = [
    ...new Map(
      messages
        .flatMap((m) => m.citations || [])
        .map((c) => [JSON.stringify([c.referenceId, c.documentId, c.sourceId, c.page]), c]),
    ).values(),
  ];
  return (
    <div className="ro-chat-workspace">
      <section className="chat-panel" aria-label="Hội thoại">
        <div className="ro-chat-panel-bar">
          <h2>
            <Sparkles size={16} /> Trợ lý nghiên cứu
          </h2>
          <button
            type="button"
            className="ro-icon-btn"
            onClick={result.reload}
            aria-label="Làm mới hội thoại"
          >
            <RefreshCw size={17} />
          </button>
        </div>
        <label className="knowledge-checkbox">
          <input
            type="checkbox"
            checked={internet}
            disabled={busy || pending || settingsBusy}
            onChange={(e) => changeInternet(e.target.checked)}
          />
          Tự tìm Internet khi cần (Tavily)
        </label>
        <p>
          {internet
            ? 'Auto có thể gửi truy vấn từ câu hỏi của bạn tới Tavily; nguồn riêng vẫn được kiểm tra trước.'
            : 'Internet đã tắt. Chỉ sử dụng nội dung riêng, không gửi truy vấn Tavily.'}
        </p>
        <ErrorMessage error={result.error || error} />
        {notice && <p role="status">{notice}</p>}
        {error && (
          <div className="knowledge-actions">
            <Button variant="secondary" onClick={result.reload}>
              Kiểm tra trạng thái lượt gửi
            </Button>
            <p>Không tự gửi lại. Nếu thử lại, hệ thống dùng cùng mã lượt để tránh trả lời trùng.</p>
          </div>
        )}
        {busy && <p role="status">Đang tìm đoạn nguồn phù hợp và kiểm tra trích dẫn...</p>}
        {result.loading && <p role="status">Đang tải hội thoại...</p>}
        {!result.loading && !result.data?.length && (
          <div className="ro-empty">
            <BookOpen size={30} />
            <h3>Hỏi đáp cùng tài liệu</h3>
            <p>Đặt câu hỏi về nguồn đã chọn. Mỗi câu trả lời sẽ kèm trích dẫn để đối chiếu.</p>
          </div>
        )}
        {!historyEnd && (older.length > 0 || result.data?.length === 100) && (
          <Button variant="ghost" onClick={loadOlder} disabled={historyBusy}>
            Tải tin nhắn cũ
          </Button>
        )}
        <ErrorMessage error={historyError} />
        <div className="chat-messages" aria-live="polite">
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}
        </div>
        <form className="ro-chat-composer" onSubmit={send}>
          <label className="sr-only" htmlFor="ro-chat-question">
            Câu hỏi
          </label>
          <textarea
            id="ro-chat-question"
            required
            maxLength={2000}
            rows={2}
            placeholder="Nhập câu hỏi tiếp theo..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={busy || pending || (!!error && !!turn.current)}
          />
          <Button
            type="submit"
            aria-label="Gửi câu hỏi"
            loading={busy}
            disabled={busy || pending || settingsBusy || !!result.error}
          >
            <Send size={16} />
            <span>Gửi</span>
          </Button>
        </form>
      </section>
      <aside className="ro-chat-sources" aria-label="Nguồn trích dẫn">
        <h2>Nguồn trích dẫn ({citations.length})</h2>
        {citations.length ? (
          citations.map((citation, i) => {
            const page = citation.page || citation.pageNumber;
            const documentId = citation.documentId || citation.document_id;
            const sourceId = citation.sourceId || citation.source_id;
            const href = documentId
              ? `/documents/${encodeURIComponent(documentId)}${page ? `?page=${encodeURIComponent(page)}` : ''}`
              : null;
            return (
              <div
                key={`${citation.referenceId || documentId || sourceId || 'citation'}-${i}`}
                className="ro-citation-summary"
              >
                <strong>
                  {citation.title ||
                    citation.documentName ||
                    citation.referenceId ||
                    `Nguồn ${i + 1}`}
                </strong>
                <p>
                  {page ? `Trang ${page} · ` : ''}
                  {citation.quote || citation.text || 'Trích dẫn đã được lưu cùng câu trả lời.'}
                </p>
                {href && <a href={href}>Mở tài liệu</a>}
              </div>
            );
          })
        ) : (
          <p>Nguồn trích dẫn từ các câu trả lời sẽ xuất hiện tại đây.</p>
        )}
      </aside>
    </div>
  );
}
