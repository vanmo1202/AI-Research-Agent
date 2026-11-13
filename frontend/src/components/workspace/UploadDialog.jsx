import { Link } from 'react-router-dom';
import useKnowledge from '../../hooks/useKnowledge';
import PdfUpload from '../knowledge/PdfUpload';
import ErrorMessage from '../ui/ErrorMessage';
export default function UploadDialog() {
  const limits = useKnowledge('/knowledge/config');
  return (
    <>
      <p className="ref-small-note">
        PDF được gửi đến kho tài liệu của bạn để xử lý. Trạng thái sẵn sàng được cập nhật sau khi
        lập chỉ mục.
      </p>
      <ErrorMessage error={limits.error} />
      <PdfUpload limits={limits.data} disabled={limits.loading || !!limits.error} />
      <Link className="ref-text-link" to="/documents">
        Mở thư viện tài liệu →
      </Link>
    </>
  );
}
