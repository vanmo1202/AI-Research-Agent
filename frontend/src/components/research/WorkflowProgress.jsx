import { AlertTriangle, Check, FileBarChart, FileText, Layers3 } from 'lucide-react';
import Card from '../ui/Card';
import { researchJourney } from '../../utils/researchJourney';
const titles = ['Lập kế hoạch & Thu thập', 'Phân tích bằng chứng', 'Tạo báo cáo nghiên cứu'];
const icons = [FileText, Layers3, FileBarChart];
export default function WorkflowProgress(props) {
  const journey = researchJourney(props);
  return (
    <Card className="progress-card" aria-label="Hành trình nghiên cứu">
      <div className="panel-heading">
        <h2>Hành trình nghiên cứu</h2>
        <span aria-label="Số bước đã hoàn thành">{journey.workflowCompleted}/3</span>
      </div>
      <div className="workflow-steps">
        {journey.workflowSteps.map((step, index) => {
          const Icon =
            step.state === 'complete'
              ? Check
              : ['partial', 'failed'].includes(step.state)
                ? AlertTriangle
                : icons[index];
          return (
            <div
              key={titles[index]}
              className={`workflow-step ${step.state} ${(props.stage > 1 ? props.stage - 1 : 1) === index + 1 ? 'current' : ''}`}
            >
              <span className="step-icon">
                <Icon size={19} />
              </span>
              <div>
                <div className="step-caption">BƯỚC {index + 1}</div>
                <h3>{titles[index]}</h3>
                <p>{step.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
