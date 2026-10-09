import { Database } from 'lucide-react';
import Badge from '../components/ui/Badge';
import RequestPicker from '../components/research/RequestPicker';
export default function SourcesPage() {
  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <span>Không gian nghiên cứu</span>
        <span>/</span>
        <strong>Sources</strong>
      </div>
      <div className="page-intro">
        <div>
          <p className="eyebrow">THƯ VIỆN NGHIÊN CỨU</p>
          <h1>Nguồn tài liệu của bạn</h1>
          <p>Mở một nghiên cứu để xem lại các nguồn đã lưu trong SQLite.</p>
        </div>
        <Badge tone="teal">
          <Database size={13} />
          Sources library
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
