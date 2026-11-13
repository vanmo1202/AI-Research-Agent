import { useMemo, useState } from 'react';
import { formatDate } from '../utils/format';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  FileText,
  Grid2X2,
  List,
  RefreshCw,
  Search,
  UploadCloud,
} from 'lucide-react';
import WorkspaceAccess from '../components/knowledge/WorkspaceAccess';
import PdfUpload from '../components/knowledge/PdfUpload';
import DocumentStatus from '../components/knowledge/DocumentStatus';
import useKnowledge, { pollDocuments } from '../hooks/useKnowledge';
import Button from '../components/ui/Button';
import ErrorMessage from '../components/ui/ErrorMessage';

function Library() {
  const result = useKnowledge('/documents', pollDocuments);
  const limits = useKnowledge('/knowledge/config');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState('grid');
  const documents = useMemo(
    () =>
      (result.data || []).filter(
        (d) =>
          String(d.filename || '')
            .toLocaleLowerCase('vi')
            .includes(query.toLocaleLowerCase('vi')) &&
          (!status || d.status === status),
      ),
    [result.data, query, status],
  );
  return (
    <div className="page-enter ro-library">
      <div className="ro-page-heading">
        <div>
          <p className="ro-kicker">TRI THỨC / THƯ VIỆN</p>
          <h1>Thư viện tài liệu</h1>
          <p>Tải lên, quản lý và khai thác tri thức từ các tài liệu PDF.</p>
        </div>
        <span className="ro-document-count">
          {result.loading || result.error ? '—' : (result.data?.length ?? 0)} tài liệu
        </span>
      </div>
      <section className="ro-upload-panel" aria-label="Tải tài liệu PDF">
        <span className="ro-upload-symbol">
          <UploadCloud size={31} />
        </span>
        <div>
          <h2>Tải tài liệu nghiên cứu lên</h2>
          <p>
            {limits.data
              ? `PDF tối đa ${limits.data.maxUploadBytes / 1048576} MB / ${limits.data.maxPages} trang.`
              : 'Đang tải giới hạn PDF...'}{' '}
            Hệ thống trích xuất lớp văn bản; chưa hỗ trợ OCR cho PDF scan.
          </p>
        </div>
        <PdfUpload
          onUploaded={result.reload}
          limits={limits.data}
          disabled={limits.loading || !!limits.error}
        />
      </section>
      <ErrorMessage error={result.error || limits.error} />
      {result.paused && (
        <p role="status">Đã dừng theo dõi tự động. Làm mới tài liệu để kiểm tra trạng thái.</p>
      )}
      <section className="ro-panel ro-library-panel">
        <div className="ro-panel-head">
          <div>
            <h2>Tất cả tài liệu</h2>
            <p>Chọn một tài liệu để đọc và đối chiếu nguồn</p>
          </div>
        </div>
        <div className="ro-list-controls">
          <label className="ro-search-field">
            <Search size={17} />
            <span className="sr-only">Tìm tài liệu</span>
            <input
              aria-label="Tìm tài liệu"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm kiếm tài liệu..."
            />
          </label>
          <select
            aria-label="Lọc theo trạng thái"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ready">Đã sẵn sàng</option>
            <option value="pending">Chờ xử lý</option>
            <option value="processing">Đang xử lý</option>
            <option value="failed">Thất bại</option>
          </select>
          <div className="ro-view-toggle" role="group" aria-label="Kiểu hiển thị">
            <button
              type="button"
              aria-pressed={view === 'list'}
              aria-label="Dạng danh sách"
              onClick={() => setView('list')}
            >
              <List size={17} />
            </button>
            <button
              type="button"
              aria-pressed={view === 'grid'}
              aria-label="Dạng lưới"
              onClick={() => setView('grid')}
            >
              <Grid2X2 size={17} />
            </button>
          </div>
          <button
            type="button"
            className="ro-icon-btn"
            onClick={result.reload}
            aria-label="Làm mới tài liệu"
          >
            <RefreshCw size={17} />
          </button>
        </div>
        {result.loading && (
          <p className="ro-state" role="status">
            Đang tải thư viện...
          </p>
        )}
        {!result.loading && !result.error && !documents.length && (
          <div className="ro-empty">
            <FileText size={32} />
            <h3>{query || status ? 'Không có tài liệu phù hợp' : 'Chưa có tài liệu'}</h3>
            <p>{query || status ? 'Hãy thử thay đổi bộ lọc.' : 'Tải PDF đầu tiên để bắt đầu.'}</p>
          </div>
        )}
        {!!documents.length && (
          <div className={`ro-document-list ${view === 'grid' ? 'as-grid' : ''}`}>
            {view === 'list' && (
              <div className="ro-document-header">
                <span>TÊN TÀI LIỆU</span>
                <span>TRANG</span>
                <span>DUNG LƯỢNG</span>
                <span>TRẠNG THÁI</span>
                <span>CHI TIẾT</span>
              </div>
            )}
            {documents.map((d) => (
              <Link
                to={`/documents/${encodeURIComponent(d.id)}`}
                key={d.id}
                className="ro-document-row"
                aria-label={d.filename}
              >
                <span className="ro-file-cell">
                  <span className="ro-pdf-icon">
                    <FileText size={20} />
                  </span>
                  <span title={d.filename}>
                    {d.filename}
                    <small className="ro-doc-created">Thêm ngày {formatDate(d.created_at)}</small>
                  </span>
                </span>
                <span className="ro-doc-meta">
                  <small className="ro-mobile-label">Trang</small>
                  {d.page_count ?? '—'}
                </span>
                <span className="ro-doc-meta">
                  <small className="ro-mobile-label">Dung lượng</small>
                  {typeof d.byte_size === 'number'
                    ? `${(d.byte_size / 1048576).toFixed(2)} MB`
                    : '—'}
                </span>
                <span>
                  <DocumentStatus document={d} />
                </span>
                <span className="ro-doc-action">
                  <ArrowUpRight size={17} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
export default function DocumentLibraryPage() {
  return (
    <WorkspaceAccess>
      <Library />
    </WorkspaceAccess>
  );
}
