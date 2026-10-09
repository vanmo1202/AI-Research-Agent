import { ArrowDownWideNarrow, Search, SlidersHorizontal } from 'lucide-react';
import { providerLabel } from '../../utils/format';
export default function SourceFilters({ filters, onChange, providers }) {
  return (
    <div className="source-filters">
      <div className="source-search">
        <Search size={17} />
        <input
          aria-label="Tìm kiếm trong các nguồn đã thu thập"
          placeholder="Tìm kiếm trong các nguồn đã thu thập..."
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
        />
      </div>
      <label className="filter-select">
        <SlidersHorizontal size={15} />
        <span className="sr-only">Provider</span>
        <select
          aria-label="Lọc provider"
          value={filters.provider}
          onChange={(event) => onChange({ ...filters, provider: event.target.value })}
        >
          <option value="all">Tất cả provider</option>
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {providerLabel(provider)}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-select status-filter">
        <span className="sr-only">Trạng thái nội dung</span>
        <select
          aria-label="Lọc trạng thái nội dung"
          value={filters.content}
          onChange={(event) => onChange({ ...filters, content: event.target.value })}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="ready">Có nội dung</option>
          <option value="empty">Chưa có nội dung</option>
        </select>
      </label>
      <label className="filter-select">
        <ArrowDownWideNarrow size={15} />
        <span className="sr-only">Sắp xếp</span>
        <select
          aria-label="Sắp xếp nguồn"
          value={filters.sort}
          onChange={(event) => onChange({ ...filters, sort: event.target.value })}
        >
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
          <option value="title">Tên A–Z</option>
        </select>
      </label>
    </div>
  );
}
