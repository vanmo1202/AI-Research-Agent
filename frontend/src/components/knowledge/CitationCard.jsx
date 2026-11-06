import { Link } from 'react-router-dom';
export default function CitationCard({ citation }) {
  const target = citation.documentId
    ? `/documents/${encodeURIComponent(citation.documentId)}?page=${citation.page}`
    : citation.url;
  return (
    <div className="citation-card">
      <strong>
        {citation.label || 'Nguồn'} · {citation.title || citation.sourceId || citation.documentId}
      </strong>
      <blockquote>{citation.quote}</blockquote>
      {citation.documentId ? (
        <Link to={target}>Mở PDF · Trang {citation.page}</Link>
      ) : /^https?:\/\//i.test(target || '') ? (
        <a href={target} target="_blank" rel="noopener noreferrer">
          Mở nguồn
        </a>
      ) : (
        <span>Nguồn không có liên kết web</span>
      )}
      {citation.retrievedAt && (
        <small>Đọc nguồn lúc {new Date(citation.retrievedAt).toLocaleString('vi-VN')}</small>
      )}
      {citation.memoryId && <small>Đã tái xác minh từ bộ nhớ được chấp nhận</small>}
    </div>
  );
}
