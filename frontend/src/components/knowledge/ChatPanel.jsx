import { useEffect, useRef, useState } from 'react';
import useKnowledge from '../../hooks/useKnowledge';
import { knowledgeApi, resourcePath } from '../../services/knowledgeApi';
import ChatMessage from './ChatMessage';
import Button from '../ui/Button';
import ErrorMessage from '../ui/ErrorMessage';
export default function ChatPanel({ chatId }) {
  const path = `${resourcePath('chats', chatId)}/messages`;
  const result = useKnowledge(path, true),
    lock = useRef(false);
  const [question, setQuestion] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  useEffect(() => {
    setQuestion('');
    setError(null);
  }, [chatId]);
  async function send(e) {
    e.preventDefault();
    if (lock.current || !question.trim()) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await knowledgeApi(path, {
        method: 'POST',
        body: { content: question.trim(), clientToken: crypto.randomUUID() },
      });
      setQuestion('');
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
      result.reload();
    }
  }
  const pending = result.data?.some((m) => m.status === 'pending');
  return (
    <section className="chat-panel" aria-label="Hội thoại">
      <ErrorMessage error={result.error || error} />
      <Button variant="ghost" onClick={result.reload}>
        Tải lại hội thoại
      </Button>
      {result.loading && <p role="status">Đang tải hội thoại...</p>}
      {!result.loading && !result.data?.length && (
        <p>Hỏi về tài liệu đã chọn. Câu trả lời sẽ kèm nguồn đối chiếu.</p>
      )}
      <div className="chat-messages">
        {result.data?.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
      </div>
      <form onSubmit={send} className="knowledge-form">
        <label>
          Câu hỏi
          <textarea
            required
            maxLength={2000}
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={busy || pending}
          />
        </label>
        <Button type="submit" loading={busy} disabled={pending || !!result.error}>
          {error ? 'Gửi lại câu hỏi' : 'Gửi câu hỏi'}
        </Button>
      </form>
    </section>
  );
}
