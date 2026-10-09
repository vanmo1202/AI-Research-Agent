import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, FileText } from 'lucide-react';
import Badge from '../ui/Badge';
import { formatDate, providerLabel, safeExternalUrl } from '../../utils/format';
export default function SourceCard({ source, index }) {
  const [expanded, setExpanded] = useState(false);
  const href = safeExternalUrl(source.url);
  const title = source.title || 'Nguồn chưa có tiêu đề';
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
          <p className="source-snippet">{source.snippet || 'Nguồn này chưa có mô tả.'}</p>
          <small className="source-date">Thu thập {formatDate(source.collectedAt)}</small>
        </div>
        <div className="source-provider">
          <Badge tone={source.provider === 'mock' ? 'violet' : 'blue'}>
            {providerLabel(source.provider)}
          </Badge>
        </div>
        <div className="source-status">
          <Badge tone={source.content?.trim() ? 'green' : 'neutral'}>
            <span className="status-dot" />
            {source.content?.trim() ? 'Có nội dung' : 'Chưa có nội dung'}
          </Badge>
        </div>
        <div className="source-preview">
          <p>{source.content || 'Không tải được nội dung trang. Bạn vẫn có thể mở nguồn gốc.'}</p>
          <button
            type="button"
            className="text-button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Thu gọn' : 'Xem chi tiết'}
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
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
              {source.content || 'Chưa có nội dung. Hãy truy cập nguồn gốc để đọc tài liệu.'}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}
