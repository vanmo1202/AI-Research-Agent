import { useState } from 'react';
import { Link } from 'react-router-dom';
import WorkspaceAccess from '../components/knowledge/WorkspaceAccess';
import PdfUpload from '../components/knowledge/PdfUpload';
import DocumentStatus from '../components/knowledge/DocumentStatus';
import useKnowledge from '../hooks/useKnowledge';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ErrorMessage from '../components/ui/ErrorMessage';
function Library() {
  const result = useKnowledge('/documents', true),
    [query, setQuery] = useState('');
  return (
    <div className="page-enter">
      <div className="page-intro">
        <div>
          <h1>Thư viện tài liệu</h1>
          <p>Tải PDF, lập chỉ mục và tái sử dụng trong nghiên cứu.</p>
        </div>
      </div>
      <Card className="knowledge-card">
        <PdfUpload onUploaded={result.reload} />
      </Card>
      <ErrorMessage error={result.error} />
      <div className="knowledge-toolbar">
        <label>
          Tìm tài liệu
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <Button variant="secondary" onClick={result.reload}>
          Tải lại tài liệu
        </Button>
      </div>
      {result.loading && <p role="status">Đang tải thư viện...</p>}
      {!result.loading && !result.data?.length && (
        <Card className="knowledge-card">
          <p>Chưa có tài liệu PDF.</p>
        </Card>
      )}
      <div className="document-grid">
        {result.data
          ?.filter((d) => d.filename.toLowerCase().includes(query.toLowerCase()))
          .map((d) => (
            <Card className="knowledge-card" key={d.id}>
              <h2>
                <Link to={`/documents/${d.id}`}>{d.filename}</Link>
              </h2>
              <DocumentStatus document={d} />
              <p>
                {d.page_count} trang · {(d.byte_size / 1024 / 1024).toFixed(2)} MB
              </p>
            </Card>
          ))}
      </div>
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
