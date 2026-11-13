import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import useKnowledge from '../hooks/useKnowledge';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import ErrorMessage from '../components/ui/ErrorMessage';
import ResearchRows from '../components/research/ResearchRows';
import { statusLabel } from '../utils/displayLabels';

export default function ResearchHistoryPage() {
  const result = useKnowledge('/research'),
    [query, setQuery] = useState(''),
    [status, setStatus] = useState('');
  const rows = (result.data || []).filter(
    (r) =>
      `${r.topic} ${r.id}`.toLowerCase().includes(query.toLowerCase()) &&
      (!status || (r.runStatus || r.status) === status),
  );
  return (
    <div className="page-enter os-page">
      <PageHeader
        eyebrow="NGHIÊN CỨU / LỊCH SỬ"
        title="Nghiên cứu của bạn"
        description="Tiếp tục theo dõi lượt chạy gần nhất hoặc mở dữ liệu nghiên cứu đã lưu."
      >
        <Button to="/workflow-1">
          <Plus size={17} />
          Nghiên cứu mới
        </Button>
      </PageHeader>
      <section className="os-panel">
        <div className="ro-list-controls">
          <label className="ro-search-field">
            <Search size={17} />
            <span className="sr-only">Tìm nghiên cứu</span>
            <input
              aria-label="Tìm nghiên cứu"
              placeholder="Tìm theo chủ đề hoặc mã nghiên cứu"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Trạng thái lượt nghiên cứu"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            {['queued', 'running', 'completed', 'partial', 'failed', 'cancelled'].map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
          <Button variant="secondary" onClick={result.reload}>
            Làm mới
          </Button>
        </div>
        <ErrorMessage error={result.error} />
        {result.loading ? (
          <p role="status">Đang tải nghiên cứu…</p>
        ) : !result.error && !rows.length ? (
          <div className="os-empty">
            <h2>Chưa có nghiên cứu phù hợp</h2>
            <p>Tạo nghiên cứu mới hoặc thay đổi bộ lọc.</p>
          </div>
        ) : (
          <ResearchRows rows={rows} />
        )}
        <p className="os-footnote">
          API trả tối đa 200 nghiên cứu mới nhất; mỗi dòng hiển thị run gần nhất. Lịch sử toàn bộ
          lượt chạy chưa có API công khai.
        </p>
      </section>
    </div>
  );
}
