import { useEffect, useState } from 'react';
import { knowledgeApi, resourcePath } from '../../services/knowledgeApi';
import Button from '../ui/Button';
import ErrorMessage from '../ui/ErrorMessage';
export default function PdfViewer({ documentId, page = 1 }) {
  const [revision, setRevision] = useState(0);
  const [url, setUrl] = useState(''),
    [error, setError] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    setUrl('');
    setError(null);
    knowledgeApi(`${resourcePath('documents', documentId)}/file`, {
      file: true,
      signal: controller.signal,
    })
      .then((blob) => {
        if (!controller.signal.aborted) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, revision]);
  return (
    <div className="pdf-viewer">
      <ErrorMessage error={error} />
      {error && (
        <Button variant="ghost" onClick={() => setRevision((n) => n + 1)}>
          Tải lại PDF
        </Button>
      )}
      {url ? (
        <>
          <a href={`${url}#page=${page}`} target="_blank" rel="noopener noreferrer">
            Mở PDF tại trang {page}
          </a>
          <iframe title={`PDF trang ${page}`} src={`${url}#page=${page}`} />
        </>
      ) : (
        !error && <p role="status">Đang tải PDF...</p>
      )}
    </div>
  );
}
