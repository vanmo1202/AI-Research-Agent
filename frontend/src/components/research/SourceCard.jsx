import { sourceDisplay } from '../../utils/sourceDisplay';
import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, FileText } from 'lucide-react';
import Badge from '../ui/Badge';
import { formatDate, providerLabel, safeExternalUrl } from '../../utils/format';
import { Link } from 'react-router-dom';
export default function SourceCard({ source, index }) {
  const [expanded, setExpanded] = useState(false);
  const href = safeExternalUrl(source.url);
  const display = sourceDisplay(source);
  const title = display.title;
  return (
    <article className="source-card" aria-label={title}>
      <div className="source-row">
        <span className="source-index">{String(index + 1).padStart(2, '0')}</span>
        <div className="source-information">
          <div className="source-title-row">
            <span className="document-icon">
              <FileText size={19} />
            </span>
            <h3>{title}</h3>
          </div>
          {href ? (
            <a className="source-url" href={href} target="_blank" rel="noopener noreferrer">
              {source.url}
            </a>
          ) : (
            <span className="muted">URL không hợp lệ</span>
          )}
          <p className="source-snippet">{display.snippet}</p>
          {display.notice && <p className="muted">{display.notice}</p>}
          <small className="source-date">Thu thập {formatDate(source.collectedAt)}</small>
        </div>
        <div className="source-provider">
          <Badge tone={source.provider === 'mock' ? 'violet' : 'blue'}>
            {providerLabel(source.provider)}
          </Badge>
        </div>
        <div className="source-status">
          <Badge tone={display.ready ? 'green' : 'neutral'}>
            <span className="status-dot" />
            {display.ready ? 'Có nội dung' : 'Chưa có nội dung'}
          </Badge>
        </div>
        <div className="source-preview">
          <p>{display.content}</p>
          <button
            type="button"
            className="text-button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Thu gọn' : 'Xem chi tiết'}
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {source.id && <Link className="text-button" to={`/sources/${encodeURIComponent(source.id)}`}>Mở trang chi tiết</Link>}
        </div>
        <div className="source-actions">
          {href && (
            <a
              className="icon-button"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Mở nguồn: ${title}`}
            >
              <ExternalLink size={17} />
            </a>
          )}
          <button
            type="button"
            className="icon-button mobile-preview"
            aria-label={`Xem chi tiết: ${title}`}
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDown size={17} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="source-detail">
          <div>
            <strong>Truy vấn tìm kiếm</strong>
            <p>{source.query}</p>
          </div>
          <div>
            <strong>Nội dung đã thu thập</strong>
            <p className="full-content">
              {display.content}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}
