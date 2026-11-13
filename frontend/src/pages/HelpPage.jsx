import { Link } from 'react-router-dom';
import { features } from '../components/workspace/FeatureCards';
export default function HelpPage() {
  return (
    <section className="ref-subpage">
      <div className="ref-page-heading">
        <div>
          <p className="ref-eyebrow">RESEARCHOS / TRỢ GIÚP</p>
          <h1>Trợ giúp & Tài liệu</h1>
          <p>Hướng dẫn làm việc với nghiên cứu, bằng chứng và tri thức của bạn.</p>
        </div>
      </div>
      <div className="ref-tile-grid">
        {features.map((f) => (
          <article className="ref-card ref-tile" key={f.to}>
            <h2>{f.title}</h2>
            <p>{f.description}</p>
            <Link className="ref-secondary ref-btn-sm" to={f.to}>
              Mở chức năng →
            </Link>
          </article>
        ))}
        <article className="ref-card ref-tile">
          <h2>Tự động hóa n8n</h2>
          <p>
            Tạo lịch từ nghiên cứu đã lưu và bật/tắt theo quyền tài khoản. Hoạt động thực thi phụ
            thuộc cấu hình tự động hóa của hệ thống.
          </p>
          <Link className="ref-secondary ref-btn-sm" to="/automations">
            Mở tự động hóa →
          </Link>
        </article>
      </div>
      <section className="ref-card ref-panel-pad ref-workflow-explainer">
        <h2 className="ref-section-title">Phím tắt và lưu ý</h2>
        <p>Ctrl/Cmd + K để tìm kiếm · Ctrl/Cmd + N tạo nghiên cứu · Esc đóng hộp thoại.</p>
        <p>
          Lượt nghiên cứu có sáu giai đoạn. Hoàn thành một phần là kết quả cần kiểm tra thêm bằng chứng. Làm mới
          trang không tạo lượt nghiên cứu mới.
        </p>
        <p>
          Chỉ PDF đã sẵn sàng mới dùng để hỏi đáp. Chat hiện đọc PDF và nguồn từ quy trình nghiên
          cứu cũ, chưa dùng dữ liệu của lượt nghiên cứu sáu giai đoạn.
        </p>
        <p>
          Bộ nhớ chỉ được tái sử dụng sau khi bạn phê duyệt. Các tùy chọn chia sẻ chỉ áp dụng trong
          tài khoản của bạn.
        </p>
      </section>
    </section>
  );
}
