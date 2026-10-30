import { Database } from 'lucide-react';
import Badge from '../components/ui/Badge';
import RequestPicker from '../components/research/RequestPicker';
export default function SourcesPage() {
  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <span>Không gian nghiên cứu</span>
        <span>/</span>
        <strong>Nguồn tài liệu</strong>
      </div>
      <div className="page-intro">
        <div>
          <p className="eyebrow">THƯ VIỆN NGHIÊN CỨU</p>
          <h1>Nguồn tài liệu nghiên cứu</h1>
          <p>Quản lý và xem lại các nguồn tài liệu đã thu thập cho nghiên cứu hiện tại.</p>
        </div>
        <Badge tone="teal">
          <Database size={13} />
          Thư viện nguồn tài liệu
        </Badge>
      </div>
      <RequestPicker />
      <p className="library-note">
        Lịch sử bên dưới được lưu trong trình duyệt này. Nghiên cứu từ n8n hoặc thiết bị khác có thể
        mở bằng Request ID.
      </p>
    </div>
  );
}
