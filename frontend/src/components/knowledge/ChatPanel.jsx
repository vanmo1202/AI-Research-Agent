import { useEffect, useRef, useState } from 'react';
import { BookOpen, RefreshCw, Send, Sparkles, Paperclip } from 'lucide-react';
import useKnowledge, { pollMessages, pollDocuments } from '../../hooks/useKnowledge';
import { knowledgeApi, resourcePath } from '../../services/knowledgeApi';
import ChatMessage from './ChatMessage';
import Button from '../ui/Button';
import ErrorMessage from '../ui/ErrorMessage';

export default function ChatPanel({
  chatId,
  session,
  onEnsureChat,
  onCreated,
  initialDocumentIds = [],
}) {
  const path = chatId ? `${resourcePath('chats', chatId)}/messages` : null;
  const [busy, setBusy] = useState(false);
  const result = useKnowledge(path, busy ? true : pollMessages);
  const fileInput = useRef(null);
  const scrollArea = useRef(null);
  const followBottom = useRef(true);
  const uploadLock = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const settingsLock = useRef(false);
  const [internet, setInternet] = useState(session ? !!session.internet_enabled : true);
  const [uploadError, setUploadError] = useState(null);
  const [attached, setAttached] = useState(() =>
    session ? JSON.parse(session.document_ids_json) : initialDocumentIds,
  );
  const documents = useKnowledge(attached.length ? '/documents' : null, pollDocuments);
  const config = useKnowledge('/knowledge/config');
  async function updatePreferences(body) {
    if (settingsLock.current || busy || pending || uploading) return;
    settingsLock.current = true;
    setSettingsBusy(true);
    setUploadError(null);
    try {
      const id = chatId || (await onEnsureChat());
      const updated = await knowledgeApi(`/chats/${encodeURIComponent(id)}/preferences`, {
        method: 'PATCH',
        body,
      });
      setAttached(JSON.parse(updated.document_ids_json));
      setInternet(!!updated.internet_enabled);
      if (!chatId) onCreated?.(id);
    } catch (error) {
      setUploadError(error);
    } finally {
      settingsLock.current = false;
      setSettingsBusy(false);
    }
  }

  const attachments = attached.map((id) => documents.data?.find((d) => d.id === id));
  const documentsBlocked =
    attached.length > 0 &&
    (documents.loading || documents.error || attachments.some((d) => !d || d.status !== 'ready'));
  async function upload(file) {
    if (
      !file ||
      uploadLock.current ||
      settingsLock.current ||
      lock.current ||
      pending ||
      attached.length >= 12
    )
      return;
    if (
      !/\.pdf$/i.test(file.name) ||
      file.size > (config.data?.maxUploadBytes || 20 * 1024 * 1024)
    ) {
      setUploadError(new Error('Chọn PDF trong giới hạn dung lượng cho phép.'));
      return;
    }
    uploadLock.current = true;
    setUploading(true);
    setUploadError(null);
    let uploaded;
    try {
      const id = chatId || (await onEnsureChat());
      const persisted = await knowledgeApi(`/chats/${encodeURIComponent(id)}`);
      if (!persisted.request_id) throw new Error('Chọn nghiên cứu trước khi tải PDF.');
      const body = new FormData();
      body.append('file', file);
      const result = await knowledgeApi('/documents', { method: 'POST', body });
      uploaded = result.document;
      if (persisted.request_id)
        await knowledgeApi(`/research/${encodeURIComponent(persisted.request_id)}/documents`, {
          method: 'POST',
          body: { documentId: uploaded.id },
        });
      const updated = await knowledgeApi(`/chats/${encodeURIComponent(id)}/preferences`, {
        method: 'PATCH',
        body: {
          documentIds: [...new Set([...JSON.parse(persisted.document_ids_json), uploaded.id])],
        },
      });
      setAttached(JSON.parse(updated.document_ids_json));
      documents.reload();
      if (!chatId) onCreated?.(id);
    } catch (error) {
      setUploadError(
        new Error(
          uploaded
            ? `PDF đã lưu trong thư viện nhưng chưa gắn vào hội thoại: ${error.message}`
            : error.message,
        ),
      );
    } finally {
      uploadLock.current = false;
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }
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
  async function send(e, retryContent) {
    e.preventDefault();
    const content = (retryContent ?? question).trim();
    if (lock.current || uploading || settingsBusy || pending || documentsBlocked || !content)
      return;
    if (retryContent !== undefined) {
      turn.current = null;
      setQuestion(content);
    }
    if (turn.current && turn.current.content !== content) return;
    turn.current ||= { content, token: crypto.randomUUID() };
    const submitted = turn.current;
    lock.current = true;
    setBusy(true);
    setNotice('');
    setError(null);
    let submittedChat;
    try {
      submittedChat = chatId || (await onEnsureChat());
      await knowledgeApi(`/chats/${encodeURIComponent(submittedChat)}/messages`, {
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
      if (!chatId && submittedChat) onCreated?.(submittedChat);
    }
  }
  const messages = [
    ...new Map([...older, ...(result.data || [])].map((m) => [m.id, m])).values(),
  ].sort((a, b) => a.position - b.position);
  useEffect(() => {
    const area = scrollArea.current;
    if (area && followBottom.current) area.scrollTop = area.scrollHeight;
  }, [result.data, busy]);
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
  const pending = result.data?.some((m) => m.status === 'pending');
  const citations = [
    ...new Map(
      messages
        .flatMap((m) => m.citations || [])
        .map((c) => [JSON.stringify([c.referenceId, c.documentId, c.sourceId, c.page]), c]),
    ).values(),
  ];
  return (
    <div
      className="ro-chat-workspace unified-chat-panel"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length === 1) upload(e.dataTransfer.files[0]);
        else setUploadError(new Error('Chọn một PDF mỗi lần.'));
      }}
    >
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
        {session?.auto_research !== 0 && (
          <label className="unified-web-preference">
            <input
              type="checkbox"
              checked={internet}
              disabled={busy || pending || uploading || settingsBusy}
              onChange={(e) => updatePreferences({ internetEnabled: e.target.checked })}
            />{' '}
            Cho phép tìm nguồn web khi cần
          </label>
        )}
        <ErrorMessage error={result.error || error} />
        {notice && <p role="status">{notice}</p>}
        {result.paused && (
          <p role="status">Đã dừng theo dõi tự động. Làm mới hội thoại để kiểm tra lượt trả lời.</p>
        )}
        {error && (
          <div className="knowledge-actions">
            <Button variant="secondary" onClick={result.reload}>
              Kiểm tra trạng thái lượt gửi
            </Button>
            <p>Không tự gửi lại. Nếu thử lại, hệ thống dùng cùng mã lượt để tránh trả lời trùng.</p>
          </div>
        )}
        {busy && <p role="status">Đang xử lý câu hỏi…</p>}
        {result.loading && <p role="status">Đang tải hội thoại...</p>}
        {!result.loading && !result.data?.length && (
          <div className="ro-empty">
            <BookOpen size={30} />
            <h3>Bạn muốn hiểu rõ điều gì về nghiên cứu?</h3>
            <p>
              Hỏi về khái niệm, kết luận, bằng chứng hoặc đính kèm PDF liên quan. Enter để gửi,
              Shift+Enter để xuống dòng.
            </p>
          </div>
        )}
        {!historyEnd && (older.length > 0 || result.data?.length === 100) && (
          <Button variant="ghost" onClick={loadOlder} disabled={historyBusy}>
            Tải tin nhắn cũ
          </Button>
        )}
        <ErrorMessage error={historyError} />
        <div
          className="chat-messages"
          ref={scrollArea}
          onScroll={(e) => {
            const el = e.currentTarget;
            followBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
          }}
          aria-live="polite"
        >
          {messages.map((m) => (
            <ChatMessage
              key={m.id}
              message={m}
              onRetry={
                m.role === 'assistant' && m.status === 'failed' && !busy && !pending
                  ? (e) => {
                      const original = messages.find(
                        (v) => v.role === 'user' && v.turn_id === m.turn_id,
                      );
                      if (original) send(e, original.content);
                    }
                  : undefined
              }
            />
          ))}
        </div>
        <ErrorMessage error={uploadError || documents.error} />
        <div className="unified-attachments" aria-live="polite">
          {uploading && <p role="status">Đang tải PDF…</p>}
          {attached.map((id, i) => {
            const doc = attachments[i];
            return (
              <span key={id}>
                <a href={`/documents/${encodeURIComponent(id)}`}>{doc?.filename || 'PDF'}</a>
                {' · '}
                {doc?.status === 'ready'
                  ? 'Sẵn sàng'
                  : doc?.status === 'failed'
                    ? 'Xử lý thất bại — mở tài liệu để thử lại'
                    : 'Đang xử lý…'}
                <button
                  type="button"
                  aria-label={`Bỏ đính kèm ${doc?.filename || 'PDF'}`}
                  disabled={busy || pending || uploading || settingsBusy}
                  onClick={() =>
                    updatePreferences({ documentIds: attached.filter((value) => value !== id) })
                  }
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
        <form className="ro-chat-composer" onSubmit={send}>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            aria-label="Đính kèm PDF"
            disabled={busy || pending || uploading || settingsBusy || attached.length >= 12}
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip size={18} />
          </Button>
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form.requestSubmit();
              }
            }}
            disabled={busy || pending || (!!error && !!turn.current)}
          />
          <Button
            type="submit"
            aria-label="Gửi câu hỏi"
            loading={busy}
            disabled={
              busy || pending || uploading || settingsBusy || documentsBlocked || !!result.error
            }
          >
            <Send size={16} />
            <span>Gửi</span>
          </Button>
        </form>
      </section>
      {citations.length > 0 && (
        <aside className="ro-chat-sources" aria-label="Nguồn trích dẫn">
          <h2>Nguồn trích dẫn ({citations.length})</h2>
          {citations.length ? (
            citations.map((citation, i) => {
              const page = citation.page || citation.pageNumber;
              const documentId = citation.documentId || citation.document_id;
              const sourceId = citation.sourceId || citation.source_id;
              const href = documentId
                ? `/documents/${encodeURIComponent(documentId)}${page ? `?page=${encodeURIComponent(page)}` : ''}`
                : citation.url && /^https?:\/\//i.test(citation.url)
                  ? citation.url
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
                  {href && (
                    <a
                      href={href}
                      rel="noopener noreferrer"
                      target={documentId ? undefined : '_blank'}
                    >
                      {documentId ? 'Mở tài liệu' : 'Mở nguồn'}
                    </a>
                  )}
                </div>
              );
            })
          ) : (
            <p>Nguồn trích dẫn từ các câu trả lời sẽ xuất hiện tại đây.</p>
          )}
        </aside>
      )}
    </div>
  );
}
