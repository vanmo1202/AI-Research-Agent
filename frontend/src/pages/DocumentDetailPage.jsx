import { useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import WorkspaceAccess from '../components/knowledge/WorkspaceAccess';
import DocumentStatus from '../components/knowledge/DocumentStatus';
import PdfViewer from '../components/knowledge/PdfViewer';
import useKnowledge, { pollDocuments } from '../hooks/useKnowledge';
import useResearchHistory from '../hooks/useResearchHistory';
import { knowledgeApi, resourcePath } from '../services/knowledgeApi';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ErrorMessage from '../components/ui/ErrorMessage';
function Detail() {
  const { documentId } = useParams(),
    [params, setParams] = useSearchParams(),
    navigate = useNavigate();
  const result = useKnowledge(resourcePath('documents', documentId), pollDocuments),
    history = useResearchHistory();
  const researches = useKnowledge('/research');
  const [requestId, setRequestId] = useState(''),
    [error, setError] = useState(null),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    lock = useRef(false);
  const doc = result.data,
    page = Math.max(1, Math.min(doc?.page_count || 1, Number(params.get('page')) || 1));
  const pageData = useKnowledge(
    doc?.status === 'ready' ? `${resourcePath('documents', documentId)}/pages/${page}` : null,
  );
  async function act(action) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setNote('');
    try {
      if (action === 'attach') {
        await knowledgeApi(`/research/${encodeURIComponent(requestId)}/documents`, {
          method: 'POST',
          body: { documentId },
        });
        setNote('Đã gắn tài liệu vào nghiên cứu.');
      }
      if (action === 'detach') {
        await knowledgeApi(`/research/${encodeURIComponent(requestId)}/documents/${documentId}`, {
          method: 'DELETE',
        });
        setNote('Đã bỏ gắn tài liệu.');
      }
      if (action === 'retry')
        await knowledgeApi(`${resourcePath('documents', documentId)}/retry`, { method: 'POST' });
      if (action === 'delete') {
        await knowledgeApi(resourcePath('documents', documentId), { method: 'DELETE' });
        navigate('/documents');
      }
      result.reload();
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="page-enter">
      <Link to="/documents">← Thư viện tài liệu</Link>
      <ErrorMessage error={result.error || error} />
      <Button variant="ghost" onClick={result.reload}>
        Tải lại tài liệu
      </Button>
      {result.loading && <p role="status">Đang tải tài liệu...</p>}
      {doc && (
        <>
          <div className="page-intro">
            <div>
              <h1>{doc.filename}</h1>
              <DocumentStatus document={doc} />
            </div>
          </div>
          <Card className="knowledge-card">
            <div className="knowledge-actions">
              {doc.status === 'ready' && (
                <Button to={`/chat?documentId=${encodeURIComponent(documentId)}`}>
                  Chat với PDF này
                </Button>
              )}
              {doc.status === 'failed' && (
                <Button disabled={busy} onClick={() => act('retry')}>
                  Thử lại lập chỉ mục
                </Button>
              )}
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Xóa PDF và làm mất hiệu lực bộ nhớ liên quan?'))
                    act('delete');
                }}
              >
                Xóa tài liệu
              </Button>
            </div>
            <form
              className="knowledge-form"
              onSubmit={(e) => {
                e.preventDefault();
                act('attach');
              }}
            >
              <label>
                Chọn nghiên cứu theo chủ đề
                <select
                  value={(researches.data || []).some((r) => r.id === requestId) ? requestId : ''}
                  onChange={(e) => setRequestId(e.target.value)}
                >
                  <option value="">Chọn nghiên cứu đã có</option>
                  {researches.data?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.topic}
                    </option>
                  ))}
                </select>
              </label>
              <ErrorMessage error={researches.error} />
              <label>
                Mã nghiên cứu
                <input
                  list="research-history"
                  required
                  value={requestId}
                  onChange={(e) => setRequestId(e.target.value)}
                />
              </label>
              <datalist id="research-history">
                {history.map((r) => (
                  <option key={r.requestId} value={r.requestId}>
                    {r.topic}
                  </option>
                ))}
              </datalist>
              <div className="knowledge-actions">
                <Button type="submit" disabled={busy}>
                  Gắn vào nghiên cứu
                </Button>
                <Button variant="ghost" disabled={busy || !requestId} onClick={() => act('detach')}>
                  Bỏ gắn
                </Button>
                {requestId && (
                  <Button
                    variant="secondary"
                    to={`/research/${encodeURIComponent(requestId)}/chat`}
                  >
                    Chat với nghiên cứu
                  </Button>
                )}
              </div>
            </form>
            {note && <p role="status">{note}</p>}
          </Card>
          {doc.status === 'ready' && (
            <>
              <label className="knowledge-page-picker">
                Trang
                <select value={page} onChange={(e) => setParams({ page: e.target.value })}>
                  {Array.from({ length: doc.page_count }, (_, i) => (
                    <option key={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </label>
              <PdfViewer documentId={documentId} page={page} />
              <Card className="knowledge-card">
                <h2>Văn bản trang {page}</h2>
                <ErrorMessage error={pageData.error} />
                {pageData.error && (
                  <Button variant="ghost" onClick={pageData.reload}>
                    Tải lại văn bản trang
                  </Button>
                )}
                <p className="chat-content">
                  {pageData.loading
                    ? 'Đang tải văn bản trang...'
                    : pageData.error
                      ? ''
                      : pageData.data?.content || 'Trang không có lớp văn bản.'}
                </p>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
export default function DocumentDetailPage() {
  return (
    <WorkspaceAccess>
      <Detail />
    </WorkspaceAccess>
  );
}
