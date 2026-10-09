import { useMemo, useState } from 'react';
import { Database, X } from 'lucide-react';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import SourceCard from './SourceCard';
import SourceFilters from './SourceFilters';
const initialFilters = { search: '', provider: 'all', content: 'all', sort: 'newest' };
export default function SourceList({ sources }) {
  const [filters, setFilters] = useState(initialFilters);
  const providers = useMemo(
    () => [...new Set(sources.map((source) => source.provider || ''))],
    [sources],
  );
  const filtered = useMemo(
    () =>
      sources
        .filter((source) => {
          const matches =
            `${source.title} ${source.url} ${source.snippet} ${source.content} ${source.query}`
              .toLocaleLowerCase('vi')
              .includes(filters.search.toLocaleLowerCase('vi'));
          return (
            matches &&
            (filters.provider === 'all' || (source.provider || '') === filters.provider) &&
            (filters.content === 'all' ||
              (filters.content === 'ready'
                ? Boolean(source.content?.trim())
                : !source.content?.trim()))
          );
        })
        .sort((a, b) =>
          filters.sort === 'title'
            ? (a.title || '').localeCompare(b.title || '', 'vi')
            : (new Date(b.collectedAt) - new Date(a.collectedAt)) *
              (filters.sort === 'oldest' ? -1 : 1),
        ),
    [sources, filters],
  );
  return (
    <Card className="source-list">
      <div className="panel-heading">
        <h2>
          <span className="heading-icon blue">
            <Database size={19} />
          </span>
          Nguồn tài liệu
        </h2>
        <span className="count-badge">{sources.length}</span>
      </div>
      <SourceFilters filters={filters} onChange={setFilters} providers={providers} />
      <div className="source-table-heading">
        <span>#</span>
        <span>Nguồn tài liệu</span>
        <span>Provider</span>
        <span>Trạng thái</span>
        <span>Xem trước nội dung</span>
        <span>Thao tác</span>
      </div>
      {filtered.length ? (
        filtered.map((source, index) => (
          <SourceCard source={source} index={index} key={source.id} />
        ))
      ) : (
        <EmptyState
          title={sources.length ? 'Không có nguồn phù hợp' : 'Chưa có nguồn tài liệu'}
          description={
            sources.length
              ? 'Thử đổi từ khóa hoặc bộ lọc để tìm lại nguồn.'
              : 'Bắt đầu Search & Collect từ kế hoạch nghiên cứu của bạn.'
          }
        >
          {sources.length > 0 && (
            <button
              type="button"
              className="text-button"
              onClick={() => setFilters(initialFilters)}
            >
              <X size={15} />
              Xóa bộ lọc
            </button>
          )}
        </EmptyState>
      )}
      <div className="source-list-footer">
        Hiển thị {filtered.length} / {sources.length} nguồn<span>Được lưu trong SQLite</span>
      </div>
    </Card>
  );
}
