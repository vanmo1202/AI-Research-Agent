import { useState } from 'react';
import { BrainCircuit, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import WorkspaceAccess from '../components/knowledge/WorkspaceAccess';
import MemoryCard from '../components/knowledge/MemoryCard';
import useKnowledge from '../hooks/useKnowledge';
import Button from '../components/ui/Button';
import ErrorMessage from '../components/ui/ErrorMessage';

const tabs = [
  { value: 'candidate', label: 'Chờ duyệt' },
  { value: 'verified', label: 'Đã xác minh' },
  { value: 'stale', label: 'Cần kiểm tra' },
  { value: 'rejected', label: 'Đã từ chối' },
  { value: '', label: 'Tất cả' },
];
function Memory() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('candidate');
  const result = useKnowledge(
    search
      ? `/memories/search?q=${encodeURIComponent(search)}${status ? `&status=${status}` : ''}`
      : `/memories${status ? `?status=${status}` : ''}`,
  );
  return (
    <div className="page-enter ro-memory">
      <div className="ro-page-heading">
        <div>
          <p className="ro-kicker">TRI THỨC / BỘ NHỚ</p>
          <h1>Bộ nhớ AI</h1>
          <p>Quản lý, xác minh và tái sử dụng tri thức đã được lưu từ các nghiên cứu.</p>
        </div>
        <span className="ro-memory-icon">
          <BrainCircuit size={24} />
        </span>
      </div>
      <section className="ro-panel ro-memory-panel">
        <div className="ro-memory-tabs" role="group" aria-label="Trạng thái bộ nhớ">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={status === tab.value}
              onClick={() => setStatus(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <form
          className="ro-list-controls"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query);
            result.reload();
          }}
        >
          <label className="ro-search-field">
            <Search size={17} />
            <span className="sr-only">Tìm trong bộ nhớ</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm trong bộ nhớ..."
            />
          </label>
          <Button type="submit">Tìm kiếm</Button>
          <button
            type="button"
            className="ro-icon-btn"
            onClick={result.reload}
            aria-label="Làm mới bộ nhớ"
          >
            <RefreshCw size={17} />
          </button>
        </form>
        <ErrorMessage error={result.error} />
        {result.loading && (
          <p className="ro-state" role="status">
            Đang tải bộ nhớ...
          </p>
        )}
        {!result.loading && !result.error && !result.data?.length && (
          <div className="ro-empty">
            <ShieldCheck size={32} />
            <h3>Chưa có bộ nhớ trong nhóm này</h3>
            <p>Trích dẫn từ chat có thể tạo đề xuất mới để bạn phê duyệt.</p>
          </div>
        )}
        <div className="ro-memory-list">
          {result.data?.map((m) => (
            <MemoryCard key={m.id} memory={m} onChange={result.reload} />
          ))}
        </div>
      </section>
    </div>
  );
}
export default function AgentMemoryPage() {
  return (
    <WorkspaceAccess>
      <Memory />
    </WorkspaceAccess>
  );
}
