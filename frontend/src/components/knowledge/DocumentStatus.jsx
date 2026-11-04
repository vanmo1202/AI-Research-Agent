import Badge from '../ui/Badge';
const labels = {
  pending: 'Đang chờ xử lý',
  processing: 'Đang trích xuất & lập chỉ mục',
  ready: 'Sẵn sàng',
  failed: 'Xử lý thất bại',
};
const errors = {
  OCR_REQUIRED: 'PDF scan chưa hỗ trợ OCR. Hãy tải PDF có lớp văn bản.',
  ENCRYPTED_PDF: 'PDF được mã hóa hoặc có mật khẩu.',
  INVALID_PDF: 'PDF lỗi hoặc không đọc được.',
  PAGE_LIMIT: 'PDF vượt quá giới hạn số trang.',
  PDF_TIMEOUT: 'Xử lý PDF quá thời gian.',
  TEXT_LIMIT: 'Văn bản PDF vượt giới hạn an toàn.',
};
export default function DocumentStatus({ document }) {
  return (
    <div role="status">
      <Badge
        tone={
          document.status === 'ready' ? 'teal' : document.status === 'failed' ? 'amber' : 'blue'
        }
      >
        {labels[document.status] || document.status}
      </Badge>
      {document.error_code && (
        <p>
          {errors[document.error_code] ||
            `Chưa thể xử lý (${document.error_code}). Có thể thử lại thủ công.`}
        </p>
      )}
    </div>
  );
}
