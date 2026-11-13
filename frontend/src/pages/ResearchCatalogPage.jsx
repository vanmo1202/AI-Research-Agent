import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, FileText, Search, RefreshCw } from 'lucide-react';
import useKnowledge from '../hooks/useKnowledge';
import { runUrl } from '../services/runApi';
import { StatusBadge } from '../components/ui/Badge';
import ErrorMessage from '../components/ui/ErrorMessage';
import { formatDate } from '../utils/format';
export default function ResearchCatalogPage({ kind = 'evidence' }) {
  const result = useKnowledge('/research'),
    [query, setQuery] = useState(''),
    report = kind === 'report';
  const rows = (result.data || []).filter((r) =>
    r.topic.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')),
  );
  const title = report ? 'Báo cáo nghiên cứu' : 'Phân tích bằng chứng';
  const Icon = report ? FileText : Layers;
  return (
    <section className="ref-subpage">
      <div className="ref-page-heading">
        <div>
          <p className="ref-eyebrow">NGHIÊN CỨU / {report ? 'BÁO CÁO' : 'BẰNG CHỨNG'}</p>
          <h1>{title}</h1>
          <p>
            {report
              ? 'Mở nghiên cứu để xem báo cáo đã lưu, kết quả xác minh và xuất PDF/DOCX.'
              : 'Chọn nghiên cứu để xem nguồn, bằng chứng và khoảng trống cần đối chiếu.'}
          </p>
        </div>
        <Link className="ref-primary" to="/workflow-1">
          Nghiên cứu mới
        </Link>
      </div>
      <div className="ref-toolbar">
        <label className="ref-catalog-search">
          <Search size={17} />
          <span className="sr-only">Tìm nghiên cứu</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo chủ đề…"
          />
        </label>
        <button className="ref-ghost" onClick={result.reload}>
          <RefreshCw size={16} />
          Làm mới
        </button>
      </div>
      <ErrorMessage error={result.error} />
      {result.loading ? (
        <p role="status" className="ref-empty">
          Đang tải nghiên cứu…
        </p>
      ) : !result.error && !rows.length ? (
        <div className="ref-card ref-empty">
          Chưa có nghiên cứu phù hợp.{' '}
          <Link className="ref-text-link" to="/workflow-1">
            Bắt đầu nghiên cứu
          </Link>
        </div>
      ) : (
        <div className="ref-tile-grid">
          {rows.map((r) => (
            <article className="ref-card ref-tile" key={r.id}>
              <div className="ref-tile-top">
                <span className="ref-doc-icon">
                  <Icon size={22} />
                </span>
                <StatusBadge status={r.runStatus || r.status} />
              </div>
              <h2>{r.topic}</h2>
              <p>
                {formatDate(r.created_at)} ·{' '}
                {r.latestRunId ? 'Kết quả theo lượt chạy gần nhất' : 'Nghiên cứu đã lưu'}
              </p>
              <Link
                className="ref-secondary ref-btn-sm"
                to={
                  r.latestRunId
                    ? `${runUrl(r.id, r.latestRunId)}?tab=${report ? 'report' : 'evidence'}`
                    : `/workflow-${report ? '4' : '3'}/${encodeURIComponent(r.id)}`
                }
              >
                {report ? 'Mở báo cáo' : 'Xem bằng chứng'} →
              </Link>
            </article>
          ))}
        </div>
      )}
      <p className="ref-small-note">
        Danh sách tối đa 200 nghiên cứu mới nhất. Kết quả chỉ xuất hiện sau khi máy chủ lưu thành
        công; trạng thái trên thẻ là trạng thái lượt chạy/nghiên cứu, không phải xác nhận đã có báo cáo.
      </p>
    </section>
  );
}
