import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Database,
  FileText,
  Search,
  Sparkles,
} from 'lucide-react';
import SourceList from '../components/research/SourceList';
import useResearch from '../hooks/useResearch';
import useSearchAndCollect from '../hooks/useSearchAndCollect';
import ResearchStepper from '../components/research/ResearchStepper';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ErrorMessage from '../components/ui/ErrorMessage';
import PageState from '../components/ui/PageState';
import { StatusBadge } from '../components/ui/Badge';
import ResearchSummary from '../components/research/ResearchSummary';
import ResearchQuestions from '../components/research/ResearchQuestions';
import SearchQueries from '../components/research/SearchQueries';
import WorkflowProgress from '../components/research/WorkflowProgress';

export default function ResearchPlanPage() {
  const { requestId } = useParams();
  const resource = useResearch(requestId, true);
  const data = resource.data;
  const search = useSearchAndCollect(data?.request, data, resource.reload);
  if (resource.loading || !data)
    return (
      <PageState loading={resource.loading} error={resource.error} onRetry={resource.reload} />
    );
  const { request, researchQuestions, searchQueries } = data;
  const planned = researchQuestions.length > 0 && searchQueries.length > 0;
  const collected = [
    'collected',
    'analyzing',
    'analyzed',
    'analyzed_partial',
    'generating_report',
    'completed',
  ].includes(request.status);
  const processing =
    search.busy ||
    ['planning', 'searching', 'translating', 'analyzing', 'generating_report'].includes(
      request.status,
    );
  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <Link to="/workflow-1">Lập kế hoạch &amp; Thu thập</Link>
        <ChevronRight size={13} />
        <strong>Kết quả nghiên cứu</strong>
      </div>
      <div className="page-intro">
        <div>
          <p className="eyebrow">TỪ Ý TƯỞNG ĐẾN MỘT KẾ HOẠCH RÕ RÀNG</p>
          <h1>Lập kế hoạch &amp; Thu thập</h1>
          <p>Kế hoạch và nguồn tài liệu được cập nhật từ backend.</p>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <Button to={`/research/${encodeURIComponent(request.id)}/chat`} variant="secondary">
        Hỏi AI về nghiên cứu
      </Button>
      <ResearchStepper status={request.status} />
      <ErrorMessage error={search.error || resource.error} />
      {request.status === 'failed' && !search.error && (
        <ErrorMessage
          error={new Error('Nghiên cứu thất bại. Kế hoạch và nguồn đã lưu được giữ lại.')}
        />
      )}
      <Button variant="ghost" onClick={resource.reload}>
        Kiểm tra trạng thái
      </Button>
      <div className="content-with-panel">
        <div className="main-column">
          <ResearchSummary request={request} />
          <ResearchQuestions questions={researchQuestions} />
          <SearchQueries queries={searchQueries} />
          <SourceList sources={data.collection?.sources || []} />
          <div className="result-bottom">
            <Button to="/workflow-1" variant="secondary">
              <FileText size={16} />
              Tạo nghiên cứu khác
            </Button>
            {collected && (
              <Button to={`/workflow-3/${encodeURIComponent(requestId)}`}>
                Tiếp tục phân tích bằng chứng
                <ArrowRight size={17} />
              </Button>
            )}
          </div>
        </div>
        <aside className="right-panel">
          <Card className="completion-card">
            <span className="completion-icon">
              <Check size={24} />
            </span>
            <h2>{planned ? 'Đã lập kế hoạch' : 'Kế hoạch chưa hoàn tất'}</h2>
            <p>
              {planned
                ? 'Từ một ý tưởng, bạn đã có lộ trình nghiên cứu cụ thể.'
                : 'Kiểm tra trạng thái hoặc tạo yêu cầu mới để bắt đầu lại.'}
            </p>
            <div className="completion-stat">
              <span>
                <FileText size={16} />
                Câu hỏi nghiên cứu
              </span>
              <strong>{researchQuestions.length}</strong>
            </div>
            <div className="completion-stat">
              <span>
                <Search size={16} />
                Truy vấn tìm kiếm
              </span>
              <strong>{searchQueries.length}</strong>
            </div>
          </Card>
          <Card className="search-ready-card">
            <span className="heading-icon blue">
              <Database size={23} />
            </span>
            <h2>{collected ? 'Tiếp tục khám phá nguồn' : 'Sẵn sàng tìm kiếm tài liệu'}</h2>
            <p>Tìm kiếm, loại bỏ nguồn trùng lặp và thu thập nội dung theo kế hoạch vừa tạo.</p>
            <Button
              className="w-full"
              onClick={search.start}
              loading={processing}
              disabled={
                !planned ||
                !!resource.error ||
                !['planned', 'failed', 'collected'].includes(request.status)
              }
            >
              {processing
                ? 'Đang tìm kiếm và thu thập...'
                : collected
                  ? 'Thu thập lại nguồn'
                  : search.error || request.status === 'failed'
                    ? 'Thử lại thu thập'
                    : 'Bắt đầu tìm kiếm & thu thập'}
              {!processing && <ArrowRight size={16} />}
            </Button>
            {processing && (
              <p className="processing-note">
                Bạn có thể chờ tại đây. Backend đang tìm kiếm và lưu nguồn tài liệu.
              </p>
            )}
          </Card>
          <WorkflowProgress
            status={request.status}
            planned={planned}
            collected={collected}
            stage={2}
            searching={processing}
          />
          <div className="soft-note">
            <Sparkles size={16} />
            <span>Kế hoạch có thể được mở lại bất cứ lúc nào bằng mã nghiên cứu.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
