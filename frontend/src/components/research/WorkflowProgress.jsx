import { Check, Database, FileText, Layers3, LockKeyhole } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

export default function WorkflowProgress({
  stage = 1,
  planned = false,
  collected = false,
  searching = false,
}) {
  const steps = [
    {
      title: 'Research Planning',
      subtitle: 'Tạo kế hoạch nghiên cứu',
      icon: FileText,
      complete: planned,
    },
    {
      title: 'Search & Collect',
      subtitle: 'Tìm kiếm và thu thập nguồn',
      icon: Database,
      complete: collected,
    },
    { title: 'Evidence & RAG', subtitle: 'Chưa triển khai', icon: Layers3, complete: false },
  ];
  return (
    <Card className="progress-card">
      <div className="panel-heading">
        <h2>Hành trình nghiên cứu</h2>
        <span className="muted">{collected ? '2' : planned ? '1' : '0'}/2</span>
      </div>
      <div className="workflow-steps">
        {steps.map((step, index) => {
          const Icon = step.complete ? Check : step.icon;
          return (
            <div
              key={step.title}
              className={`workflow-step ${step.complete ? 'complete' : ''} ${stage === index + 1 ? 'current' : ''}`}
            >
              <span className="step-icon">
                <Icon size={19} />
              </span>
              <div>
                <div className="step-caption">
                  WORKFLOW {index + 1}
                  {index === 2 && <LockKeyhole size={11} />}
                </div>
                <h3>{step.title}</h3>
                <p>{index === 1 && searching ? 'Đang tìm kiếm nguồn…' : step.subtitle}</p>
                {stage === index + 1 && !step.complete && (
                  <Badge tone="blue">{searching ? 'Đang xử lý' : 'Bạn đang ở đây'}</Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="progress-foot">
        <span>Dữ liệu của bạn được lưu tại SQLite</span>
        <span className="status-dot" />
      </div>
    </Card>
  );
}
