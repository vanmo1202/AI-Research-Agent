import { useRef, useState } from 'react';
import { knowledgeApi } from '../../services/knowledgeApi';
import Button from '../ui/Button';
import ErrorMessage from '../ui/ErrorMessage';
export default function PdfUpload({ onUploaded }) {
  const lock = useRef(false),
    input = useRef();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [note, setNote] = useState('');
  async function upload(e) {
    e.preventDefault();
    if (lock.current) return;
    const file = input.current.files[0];
    if (!file || !/\.pdf$/i.test(file.name) || file.size > 20 * 1024 * 1024) {
      setError(new Error('Chọn PDF tối đa 20 MB.'));
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
      input.current.value = '';
      onUploaded?.(result.document);
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={upload} className="knowledge-form">
      <label>
        Tải PDF
        <input ref={input} type="file" accept="application/pdf,.pdf" required disabled={busy} />
      </label>
      <p>Tối đa 20 MB / 100 trang. Chưa hỗ trợ OCR.</p>
      <Button type="submit" loading={busy}>
        Tải tài liệu
      </Button>
      <ErrorMessage error={error} />
      {note && <p role="status">{note}</p>}
    </form>
  );
}
