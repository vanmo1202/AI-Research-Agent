import { Link } from 'react-router-dom';
import { Plus, Workflow } from 'lucide-react';
import { features } from '../components/workspace/FeatureCards';
import { useWorkspaceUI } from '../components/workspace/WorkspaceUI';
export default function WorkflowsPage() {
  const { openDialog } = useWorkspaceUI();
  return (
    <section className="ref-subpage">
      <div className="ref-page-heading">
        <div>
          <p className="ref-eyebrow">WORKSPACE / WORKFLOWS</p>
          <h1>5 luồng làm việc</h1>
          <p>Chọn công việc để tiếp tục nghiên cứu, đối chiếu bằng chứng và khai thác tri thức.</p>
        </div>
        <button className="ref-primary" onClick={() => openDialog('research')}>
          <Plus size={16} />
          Bắt đầu nghiên cứu
        </button>
      </div>
      <div className="ref-tile-grid">
        {features.map(({ icon: Icon, ...f }, i) => (
          <article
            className="ref-card ref-tile"
            key={f.to}
            style={{ borderTop: `4px solid ${f.color}` }}
          >
            <div className="ref-tile-top">
              <Icon size={23} color={f.color} />
              <span className="ref-pill ref-running">Luồng {String(i + 1).padStart(2, '0')}</span>
            </div>
            <h2>{f.title}</h2>
            <p>{f.description}</p>
            <div className="ref-tile-footer">
              <span className="ref-tile-meta">Mở chức năng</span>
              <Link className="ref-secondary ref-btn-sm" to={f.to}>
                Truy cập →
              </Link>
            </div>
          </article>
        ))}
      </div>
      <section className="ref-card ref-panel-pad ref-workflow-explainer">
        <h2 className="ref-section-title">Tự động hóa n8n và các workflow backend</h2>
        <p>
          Ba công việc nghiên cứu, phân tích bằng chứng và tạo báo cáo cùng nằm trong WF01 sáu giai
          đoạn. PDF, Chat, Memory và lịch nghiên cứu được hỗ trợ bởi WF02–WF05.
        </p>
        <Link to="/automations" className="ref-secondary">
          <Workflow size={17} />
          Xem tự động hóa n8n
        </Link>
      </section>
    </section>
  );
}
