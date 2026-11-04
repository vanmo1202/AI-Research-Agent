import { useParams } from 'react-router-dom';
import ResearchPlanPage from './ResearchPlanPage';
import RequestPicker from '../components/research/RequestPicker';

export default function Workflow2Page() {
  const { requestId } = useParams();
  if (requestId) return <ResearchPlanPage key={requestId} />;
  return (
    <div className="page-enter">
      <div className="page-intro">
        <div>
          <h1>Lập kế hoạch &amp; Thu thập</h1>
          <p>Chọn nghiên cứu để xem kế hoạch và nguồn tài liệu.</p>
        </div>
      </div>
      <RequestPicker destination="plan" />
    </div>
  );
}
