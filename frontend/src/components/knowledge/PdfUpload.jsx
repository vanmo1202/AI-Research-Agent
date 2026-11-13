import { Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import { FileUp, UploadCloud } from 'lucide-react';
import { knowledgeApi } from '../../services/knowledgeApi';
import Button from '../ui/Button';
import ErrorMessage from '../ui/ErrorMessage';

const DEFAULT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export default function PdfUpload({ onUploaded, limits, disabled = false }) {
  const lock = useRef(false);
  const input = useRef();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState('');
  const [uploaded, setUploaded] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const maxUploadBytes = limits?.maxUploadBytes || DEFAULT_MAX_UPLOAD_BYTES;

  function selectFile(file, selectionError = null) {
    setSelectedName(file?.name || '');
    setError(selectionError);
    setNote('');
    setUploaded(null);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (busy || disabled) return;

    const files = event.dataTransfer.files;
    if (files.length !== 1) {
      input.current.value = '';
      selectFile(null, new Error('Chọn một PDF cho mỗi lần tải lên.'));
      return;
    }
    input.current.files = files;
    selectFile(files[0]);
  }

  async function upload(e) {
    e.preventDefault();
    if (lock.current || disabled) return;
    const file = input.current?.files?.[0];
    if (!file || !/\.pdf$/i.test(file.name) || file.size > maxUploadBytes) {
      setError(new Error(`Chọn PDF tối đa ${maxUploadBytes / 1048576} MB.`));
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    setNote('');
    try {
      const body = new FormData();
      body.append('file', file);
      const result = await knowledgeApi('/documents', { method: 'POST', body });
      setNote(
        result.duplicate
          ? 'Tài liệu đã tồn tại; sử dụng bản đã lưu.'
          : 'Đã tải lên. Worker sẽ trích xuất và lập chỉ mục.',
      );
      setUploaded(result.document);
      if (input.current) input.current.value = '';
      setSelectedName('');
      onUploaded?.(result.document);
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      className={`ro-pdf-form ${dragging ? 'ref-dragover' : ''}`}
      onSubmit={upload}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy && !disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <span className="ref-drop-hint">Kéo thả một PDF hoặc chọn tệp bên dưới</span>
      <label className="ro-pdf-file-label">
        <FileUp size={16} />
        <span className="sr-only">Chọn PDF</span>
        <input
          ref={input}
          onChange={(e) => selectFile(e.target.files?.[0])}
          type="file"
          aria-label="Tải PDF"
          accept="application/pdf,.pdf"
          required
          disabled={busy || disabled}
        />
      </label>
      {selectedName && <p className="ref-selected-file">Đã chọn: {selectedName}</p>}
      <Button type="submit" aria-label="Tải tài liệu" loading={busy} disabled={disabled}>
        <UploadCloud size={16} /> Tải lên PDF
      </Button>
      {error && (
        <div className="ro-upload-note">
          <ErrorMessage error={error} />
        </div>
      )}
      {uploaded && (
        <Link to={`/documents/${encodeURIComponent(uploaded.id)}`}>Xem tài liệu vừa tải</Link>
      )}
      {note && (
        <p className="ro-upload-note" role="status">
          {note}
        </p>
      )}
    </form>
  );
}
