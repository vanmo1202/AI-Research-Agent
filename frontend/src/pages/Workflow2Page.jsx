import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCheck,
  ChevronRight,
  Database,
  Fingerprint,
  Globe2,
  RefreshCw,
  Search,
} from 'lucide-react';
import useResearch from '../hooks/useResearch';
import useSearchAndCollect from '../hooks/useSearchAndCollect';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge, { StatusBadge } from '../components/ui/Badge';
import CopyButton from '../components/ui/CopyButton';
import ErrorMessage from '../components/ui/ErrorMessage';
import PageState from '../components/ui/PageState';
import SourceList from '../components/research/SourceList';
import WorkflowProgress from '../components/research/WorkflowProgress';
import RequestPicker from '../components/research/RequestPicker';
import { providerLabel } from '../utils/format';

function SourceResults({ requestId }) {
  const resource = useResearch(requestId, true);
  const data = resource.data;
  const search = useSearchAndCollect(data?.request, data, resource.reload);
  if (resource.loading || resource.error)
    return (
      <PageState loading={resource.loading} error={resource.error} onRetry={resource.reload} />
    );
  const { request, searchQueries, researchQuestions, collection } = data;
  const sources = collection.sources;
  const providers = [...new Set(sources.map((source) => providerLabel(source.provider)))];
  const provider = providers.join(', ') || '—';
  const collected = request.status === 'collected';
  const processing = search.busy || ['searching', 'planning'].includes(request.status);
  const planned = researchQuestions.length > 0 && searchQueries.length > 0;
  return (
    <div className="page-enter sources-page">
      <div className="breadcrumb">
        <Link to={`/research/${requestId}`}>Research Plan</Link>
        <ChevronRight size={13} />
        <strong>Workflow 2</strong>
      </div>
      <div className="page-intro">
        <div>
          <p className="eyebrow">KẾT NỐI Ý TƯỞNG VỚI NGUỒN TRI THỨC</p>
          <h1>Kết quả Search & Collect</h1>
          <p>
            {collected
              ? 'Đã tìm kiếm và thu thập các nguồn tài liệu phù hợp với yêu cầu nghiên cứu của bạn.'
              : processing
                ? 'Backend đang tìm kiếm và thu thập nguồn. Kết quả sẽ tự cập nhật.'
                : 'Nguồn tài liệu được lưu theo yêu cầu nghiên cứu của bạn.'}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <ErrorMessage error={search.error} />
      <div className="source-summary-grid">
        <Card className="metric-card id-metric">
          <span className="metric-icon blue">
            <Fingerprint size={20} />
          </span>
          <div>
            <span>Request ID</span>
            <div className="metric-id">
              <code title={requestId}>{requestId}</code>
              <CopyButton text={requestId} label="Sao chép Request ID" />
            </div>
          </div>
        </Card>
        <Card className="metric-card">
          <span className="metric-icon violet">
            <Search size={20} />
          </span>
          <div>
            <span>Số truy vấn</span>
            <strong>{searchQueries.length}</strong>
          </div>
        </Card>
        <Card className="metric-card">
          <span className="metric-icon teal">
            <Database size={20} />
          </span>
          <div>
            <span>Số nguồn thu thập</span>
            <strong>{collection.sourceCount}</strong>
          </div>
        </Card>
        <Card className="metric-card">
          <span className="metric-icon amber">
            <Globe2 size={20} />
          </span>
          <div>
            <span>Provider</span>
            <strong className="provider-metric">{provider}</strong>
          </div>
        </Card>
      </div>
      <div className="content-with-panel sources-layout">
        <div className="main-column">
          <div className="source-topic-bar">
            <div>
              <span className="muted">ĐANG NGHIÊN CỨU</span>
              <h2>{request.topic}</h2>
            </div>
            <Button variant="ghost" onClick={resource.reload} aria-label="Tải lại sources">
              <RefreshCw size={17} />
            </Button>
          </div>
          <SourceList sources={sources} />
          <Link to={`/research/${requestId}`} className="back-link">
            <ArrowLeft size={16} />
            Quay lại Research Plan
          </Link>
        </div>
        <aside className="right-panel">
          <WorkflowProgress
            stage={2}
            planned={planned}
            collected={collected}
            searching={processing}
          />
          <Card className="collection-stats">
            <div className="panel-heading">
              <h2>Thống kê thu thập</h2>
              <span className="heading-icon teal">
                <CheckCheck size={19} />
              </span>
            </div>
            <dl>
              <div>
                <dt>Nguồn tài liệu</dt>
                <dd>{collection.sourceCount}</dd>
              </div>
              <div>
                <dt>Truy vấn trong kế hoạch</dt>
                <dd>{searchQueries.length}</dd>
              </div>
              <div>
                <dt>Provider</dt>
                <dd>{provider}</dd>
              </div>
            </dl>
            <div className="collection-progress">
              <span>{collected ? 'Hoàn thành' : processing ? 'Đang xử lý' : 'Chưa hoàn tất'}</span>
              {collected && <strong>100%</strong>}
            </div>
            <div className={`progress-track ${processing ? 'in-progress' : ''}`}>
              <span style={{ width: collected ? '100%' : '0%' }} />
            </div>
            <p className="stats-note">
              {collected
                ? 'Kết quả đã được lưu vào SQLite.'
                : 'Trạng thái được cập nhật từ backend.'}
            </p>
          </Card>
          <Card className="next-workflow-card">
            <Badge tone="violet">Tiếp theo · Workflow 3</Badge>
            <h2>Evidence & RAG</h2>
            <p>Từ nguồn tài liệu đến bằng chứng có thể kiểm chứng.</p>
            <span className="not-available">Chưa triển khai</span>
          </Card>
          <Button
            variant="secondary"
            className="w-full"
            onClick={search.start}
            loading={processing}
            disabled={!planned}
          >
            {processing
              ? 'Đang Search & Collect...'
              : sources.length
                ? 'Thu thập lại nguồn'
                : 'Bắt đầu Search & Collect'}
            {!processing && <RefreshCw size={15} />}
          </Button>
        </aside>
      </div>
    </div>
  );
}
export default function Workflow2Page() {
  const { requestId } = useParams();
  if (requestId) return <SourceResults key={requestId} requestId={requestId} />;
  return (
    <div className="page-enter">
      <div className="page-intro">
        <div>
          <p className="eyebrow">WORKFLOW 2</p>
          <h1>Search & Collect</h1>
          <p>Chọn một Research Plan để bắt đầu khám phá nguồn tài liệu.</p>
        </div>
      </div>
      <RequestPicker destination="plan" />
    </div>
  );
}
