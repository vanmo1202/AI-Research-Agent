import { useState } from 'react';
import WorkspaceAccess from '../components/knowledge/WorkspaceAccess';
import MemoryCard from '../components/knowledge/MemoryCard';
import useKnowledge from '../hooks/useKnowledge';
import Button from '../components/ui/Button';
import ErrorMessage from '../components/ui/ErrorMessage';
function Memory() {
  const [query, setQuery] = useState(''),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('');
  const result = useKnowledge(
    search
      ? `/memories/search?q=${encodeURIComponent(search)}${status ? `&status=${status}` : ''}`
      : `/memories${status ? `?status=${status}` : ''}`,
  );
  return (
    <div className="page-enter">
      <div className="page-intro">
        <div>
          <h1>Bộ nhớ AI</h1>
          <p>
            Trích đoạn có nguồn gốc rõ ràng. Chỉ bộ nhớ được phê duyệt và còn hợp lệ mới được đề
            xuất.
          </p>
        </div>
      </div>
      <form
        className="knowledge-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query);
          result.reload();
        }}
      >
        <label>
          Tìm bộ nhớ
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          Trạng thái
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="candidate">Chờ duyệt</option>
            <option value="verified">Đã xác minh</option>
            <option value="rejected">Đã từ chối</option>
            <option value="stale">Nguồn không còn hợp lệ</option>
          </select>
        </label>
        <Button type="submit">Tìm kiếm</Button>
        <Button variant="ghost" onClick={result.reload}>
          Tải lại bộ nhớ
        </Button>
      </form>
      <ErrorMessage error={result.error} />
      {result.loading && <p role="status">Đang tải bộ nhớ...</p>}
      {!result.loading && !result.data?.length && (
        <p>Chưa có bộ nhớ phù hợp. Các trích dẫn từ chat sẽ tạo đề xuất để bạn duyệt.</p>
      )}
      <div className="document-grid">
        {result.data?.map((m) => (
          <MemoryCard key={m.id} memory={m} onChange={result.reload} />
        ))}
      </div>
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
