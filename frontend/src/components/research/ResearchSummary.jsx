import { FileText, Fingerprint } from 'lucide-react';
import Card from '../ui/Card';
import CopyButton from '../ui/CopyButton';
import { outputLengths } from '../../utils/format';
export default function ResearchSummary({ request }) {
  return (
    <Card className="summary-card">
      <div className="panel-heading">
        <h2>
          <FileText size={18} />
          Yêu cầu nghiên cứu
        </h2>
      </div>
      <h3 className="research-topic">{request.topic}</h3>
      <div className="request-id">
        <Fingerprint size={15} />
        <code>{request.requestId}</code>
        <CopyButton text={request.requestId} label="Sao chép Request ID" />
      </div>
      <dl className="summary-details">
        <div>
          <dt>Mục tiêu</dt>
          <dd>{request.goal}</dd>
        </div>
        <div>
          <dt>Phạm vi</dt>
          <dd>{request.scope || 'Không giới hạn cụ thể'}</dd>
        </div>
        <div>
          <dt>Độ dài đầu ra</dt>
          <dd>{outputLengths[request.outputLength] || request.outputLength}</dd>
        </div>
      </dl>
    </Card>
  );
}
