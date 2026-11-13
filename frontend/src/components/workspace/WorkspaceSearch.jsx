import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search } from 'lucide-react';
import useKnowledge from '../../hooks/useKnowledge';
import { runUrl } from '../../services/runApi';
import ErrorMessage from '../ui/ErrorMessage';
export default function WorkspaceSearch({ onClose }) {
  const researches = useKnowledge('/research'),
    docs = useKnowledge('/documents');
  const [query, setQuery] = useState(''),
    results = useRef(null);
  const all = [
    ...(researches.data || []).map((r) => ({
      id: `r-${r.id}`,
      title: r.topic,
      type: 'Nghiên cứu',
      url: r.latestRunId ? runUrl(r.id, r.latestRunId) : `/research/${encodeURIComponent(r.id)}`,
    })),
    ...(docs.data || []).map((d) => ({
      id: `d-${d.id}`,
      title: d.filename,
      type: 'PDF',
      url: `/documents/${encodeURIComponent(d.id)}`,
    })),
  ];
  const matches = all
    .filter((r) =>
      `${r.title} ${r.id}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')),
    )
    .slice(0, 12);
  return (
    <div
      className="ref-search-content"
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const links = [...results.current.querySelectorAll('a')];
          const i = links.indexOf(document.activeElement);
          links[(i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length]?.focus();
        }
      }}
    >
      <label className="sr-only" htmlFor="workspace-search-query">
        Tìm kiếm nghiên cứu hoặc PDF
      </label>
      <input
        autoFocus
        id="workspace-search-query"
        type="search"
        className="ref-search-input"
        placeholder="Tìm nghiên cứu, tài liệu PDF…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ErrorMessage error={researches.error || docs.error} />
      {researches.loading || docs.loading ? (
        <p role="status" className="ref-empty">
          Đang tải dữ liệu tài khoản…
        </p>
      ) : null}
      <div className="ref-search-results" ref={results}>
        {matches.map((r) => (
          <Link className="ref-search-result" key={r.id} to={r.url} onClick={onClose}>
            {r.type === 'PDF' ? <FileText size={18} /> : <Search size={18} />}
            <span>{r.title}</span>
            <small>{r.type}</small>
          </Link>
        ))}
        {!researches.loading && !docs.loading && !matches.length && (
          <p className="ref-empty">Không tìm thấy kết quả phù hợp.</p>
        )}
      </div>
      <p className="ref-search-shortcuts">
        ↑ ↓ chuyển kết quả · Enter để mở · Esc để đóng. Tìm trong tối đa 200 nghiên cứu và 200 PDF
        gần nhất; báo cáo được mở từ nghiên cứu.
      </p>
    </div>
  );
}
