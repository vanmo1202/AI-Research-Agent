import { sourceDisplay } from '../utils/sourceDisplay';
import { ArrowLeft, Copy, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ErrorMessage from '../components/ui/ErrorMessage';
import PageState from '../components/ui/PageState';
import { getSources } from '../services/researchApi';
import { getLastRequestId } from '../utils/researchStorage';
import { providerLabel, safeExternalUrl, formatDate } from '../utils/format';

export default function SourceDetailPage() {
  const { sourceId } = useParams();
  const [expanded, setExpanded] = useState(false);
  const [source, setSource] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const requestId = getLastRequestId();
    if (!requestId) {
      setError('Chưa có nghiên cứu gần đây để tìm nguồn.');
      setLoading(false);
      return;
    }
    getSources(requestId)
      .then((data) => {
        const found = data.sources.find((item) => item.id === sourceId);
        setSource(found || null);
        if (!found) setError('Không tìm thấy nguồn tài liệu này.');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sourceId]);
  if (loading) return <PageState type="loading" title="Đang tải nguồn tài liệu..." />;
  if (error || !source) return <ErrorMessage error={error || 'Không tìm thấy nguồn tài liệu.'} />;
  const display = sourceDisplay(source);
  const href = safeExternalUrl(source.url);
  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value || '');
    } catch {
      /* clipboard không khả dụng */
    }
  };
  return (
    <div className="page-enter source-detail-page">
      <Link className="back-link" to="/sources">
        <ArrowLeft size={16} /> Quay lại nguồn tài liệu
      </Link>
      <div className="page-intro">
        <div>
          <p className="eyebrow">CHI TIẾT NGUỒN</p>
          <h1>{display.title || 'Nguồn tài liệu'}</h1>
          <p>Chi tiết được tải trực tiếp từ SQLite qua backend.</p>
        </div>
        <Badge tone={source.provider === 'mock' ? 'violet' : 'blue'}>
          {providerLabel(source.provider)}
        </Badge>
      </div>
      <Card className="source-detail-card">
        <div className="detail-meta">
          <span>
            <strong>Truy vấn</strong>
            {source.query}
          </span>
          <span>
            <strong>Thu thập</strong>
            {formatDate(source.collectedAt)}
          </span>
        </div>
        <div className="detail-url">
          <LinkIcon size={17} />
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {source.url}
            </a>
          ) : (
            <span>{source.url}</span>
          )}
          <button
            className="icon-button"
            type="button"
            aria-label="Sao chép URL"
            onClick={() => copy(source.url)}
          >
            <Copy size={16} />
          </button>
        </div>
        {display.notice && (
          <p role="status" className="muted">
            {display.notice}
          </p>
        )}
        <p className="muted">
          {source.translationStatus === 'not_required' ? 'Nguồn tiếng Việt' : 'Bản dịch tự động'} ·{' '}
          {source.translationStatus === 'complete'
            ? 'Đã dịch'
            : source.translationStatus === 'partial'
              ? 'Đã dịch một phần'
              : source.translationStatus === 'not_required'
                ? 'Không cần dịch'
                : 'Chưa hoàn tất'}
        </p>
        <h2>Tóm tắt</h2>
        <p>{display.snippet || 'Không có tóm tắt.'}</p>
        <h2>Nội dung</h2>
        <div
          id="source-full-content"
          className={`full-content source-reading ${expanded || display.content.length <= 600 ? 'expanded' : 'collapsed'}`}
        >
          {display.content}
        </div>
        {display.content.length > 600 && (
          <Button
            variant="secondary"
            aria-controls="source-full-content"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Thu gọn nội dung' : 'Đọc toàn bộ nội dung'}
          </Button>
        )}
        <div className="detail-actions">
          {href && (
            <a
              className="button button-primary"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} /> Mở liên kết gốc
            </a>
          )}
          <Button variant="secondary" onClick={() => copy(display.content)}>
            <Copy size={16} /> Sao chép nội dung
          </Button>
        </div>
      </Card>
    </div>
  );
}
