import {
  BrainCircuit,
  ChevronRight,
  CircleCheck,
  FileText,
  Lightbulb,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ResearchForm from '../components/research/ResearchForm';
import WorkflowProgress from '../components/research/WorkflowProgress';

export default function Workflow1Page() {
  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <span>Không gian nghiên cứu</span>
        <ChevronRight size={13} />
        <strong>Workflow 1</strong>
      </div>
      <div className="page-intro">
        <div>
          <p className="eyebrow">MỖI KHÁM PHÁ BẮT ĐẦU TỪ MỘT CÂU HỎI</p>
          <h1>
            Khởi đầu nghiên cứu của bạn<span className="title-dot">.</span>
          </h1>
          <p>Đưa ra ý tưởng. Để AI giúp bạn vạch ra hướng đi.</p>
        </div>
        <Badge tone="teal">
          <span className="status-dot" />
          Research workspace
        </Badge>
      </div>
      <div className="content-with-panel">
        <div className="main-column">
          <Card className="planning-card">
            <div className="planning-hero">
              <div className="hero-text">
                <Badge>
                  <FileText size={12} />
                  Workflow 1
                </Badge>
                <h2>Tạo yêu cầu nghiên cứu</h2>
                <p>
                  Mô tả chủ đề, mục tiêu và phạm vi để AI tạo kế hoạch nghiên cứu chi tiết cho bạn.
                </p>
              </div>
              <div className="planner-art" aria-hidden="true">
                <span className="art-orbit orbit-one" />
                <span className="art-orbit orbit-two" />
                <span className="art-brain">
                  <BrainCircuit size={37} strokeWidth={1.4} />
                </span>
                <span className="art-file">
                  <FileText size={25} />
                </span>
                <Sparkles className="art-sparkle" size={21} />
                <span className="art-dot" />
              </div>
            </div>
            <ResearchForm />
          </Card>
          <div className="trust-strip">
            <ShieldCheck size={16} />
            <span>Ý tưởng của bạn, kế hoạch rõ ràng.</span>
            <span className="trust-divider" />
            <span>Dữ liệu lưu tự động · Sẵn sàng cho bước tiếp theo</span>
          </div>
        </div>
        <aside className="right-panel">
          <WorkflowProgress />
          <Card className="tip-card">
            <div className="tip-title">
              <span className="heading-icon amber">
                <Lightbulb size={20} />
              </span>
              <h2>
                Một yêu cầu tốt,
                <br />
                một khởi đầu tốt
              </h2>
            </div>
            <p>AI hiểu bạn hơn khi yêu cầu nghiên cứu được mô tả rõ ràng.</p>
            <ul>
              <li>
                <CircleCheck size={15} />
                Chọn một chủ đề cụ thể
              </li>
              <li>
                <CircleCheck size={15} />
                Nêu rõ điều bạn muốn tìm hiểu
              </li>
              <li>
                <CircleCheck size={15} />
                Giới hạn phạm vi phù hợp
              </li>
            </ul>
          </Card>
          <div className="next-step-card">
            <span className="heading-icon violet">
              <Sparkles size={20} />
            </span>
            <div>
              <h3>Điều gì sẽ xảy ra tiếp theo?</h3>
              <p>
                AI sẽ đề xuất câu hỏi nghiên cứu và truy vấn tìm kiếm phù hợp với mục tiêu của bạn.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
