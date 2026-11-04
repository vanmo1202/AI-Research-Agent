import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ErrorMessage from '../ui/ErrorMessage';
import { knowledgeApi, resourcePath } from '../../services/knowledgeApi';
const labels = {
  candidate: 'Chờ duyệt',
  verified: 'Đã xác minh',
  rejected: 'Đã từ chối',
  stale: 'Nguồn không còn hợp lệ',
};
export default function MemoryCard({ memory, onChange }) {
  const [cross, setCross] = useState(memory.kind === 'cross_research'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const lock = useRef(false);
  async function act(action) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await knowledgeApi(
        `${resourcePath('memories', memory.id)}${action === 'delete' ? '' : `/${action}`}`,
        {
          method: action === 'delete' ? 'DELETE' : 'POST',
          body: action === 'approve' ? { crossResearch: cross } : {},
        },
      );
      onChange?.();
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Card className="memory-card">
      <Badge tone={memory.status === 'verified' ? 'teal' : 'amber'}>{labels[memory.status]}</Badge>
      <p className="chat-content">{memory.content}</p>
      <small>
        Nghiên cứu: {memory.request_id} ·{' '}
        {memory.kind === 'cross_research'
          ? 'Có thể đề xuất giữa các nghiên cứu'
          : 'Trong nghiên cứu'}
      </small>
      {memory.links?.map((link) => (
        <div className="memory-provenance" key={link.id}>
          {link.document_id ? (
            <Link to={`/documents/${encodeURIComponent(link.document_id)}?page=${link.page}`}>
              PDF · Trang {link.page}
            </Link>
          ) : (
            <Link to={`/research/${encodeURIComponent(memory.request_id)}/sources`}>
              Nguồn nghiên cứu · {link.source_id}
            </Link>
          )}
          <code title={link.version_hash}>Phiên bản: {link.version_hash.slice(0, 16)}</code>
        </div>
      ))}
      {['candidate', 'verified'].includes(memory.status) && (
        <label className="knowledge-checkbox">
          <input
            type="checkbox"
            checked={cross}
            onChange={(e) => setCross(e.target.checked)}
            disabled={busy}
          />
          Cho phép đề xuất dùng ở nghiên cứu khác
        </label>
      )}
      <div className="knowledge-actions">
        {['candidate', 'verified'].includes(memory.status) && (
          <Button disabled={busy} onClick={() => act('approve')}>
            Phê duyệt
          </Button>
        )}
        {memory.status !== 'rejected' && (
          <Button variant="secondary" disabled={busy} onClick={() => act('reject')}>
            Từ chối
          </Button>
        )}
        <Button variant="ghost" disabled={busy} onClick={() => act('delete')}>
          Xóa bộ nhớ
        </Button>
      </div>
      <ErrorMessage error={error} />
    </Card>
  );
}
