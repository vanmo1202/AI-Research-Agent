import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Database,
  FileText,
  Search,
  Sparkles,
} from 'lucide-react';
import useResearch from '../hooks/useResearch';
import useSearchAndCollect from '../hooks/useSearchAndCollect';
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
  const resource = useResearch(requestId);
  const data = resource.data;
  const search = useSearchAndCollect(data?.request, data, resource.reload);
  if (resource.loading || resource.error)
    return (
      <PageState loading={resource.loading} error={resource.error} onRetry={resource.reload} />
    );
  const { request, researchQuestions, searchQueries } = data;
  const planned = researchQuestions.length > 0 && searchQueries.length > 0;
  const collected = request.status === 'collected';
  const processing = search.busy || ['planning', 'searching'].includes(request.status);
  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <Link to="/workflow-1">Lập kế hoạch nghiên cứu</Link>
        <ChevronRight size={13} />
        <strong>Kế hoạch nghiên cứu</strong>
      </div>
      <div className="page-intro">
        <div>
          <p className="eyebrow">TỪ Ý TƯỞNG ĐẾN MỘT KẾ HOẠCH RÕ RÀNG</p>
          <h1>Kế hoạch nghiên cứu</h1>
          <p>Kế hoạch nghiên cứu của bạn đã sẵn sàng cho bước khám phá tiếp theo.</p>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <ErrorMessage error={search.error} />
      <div className="content-with-panel">
        <div className="main-column">
          <ResearchSummary request={request} />
          <ResearchQuestions questions={researchQuestions} />
          <SearchQueries queries={searchQueries} />
          <div className="result-bottom">
            <Button to="/workflow-1" variant="secondary">
              <FileText size={16} />
              Tạo nghiên cứu khác
            </Button>
            {collected && (
              <Button to={`/research/${requestId}/sources`} variant="ghost">
                Xem nguồn đã thu thập
                <ArrowUpRight size={17} />
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
              disabled={!planned}
            >
              {processing
                ? 'Đang tìm kiếm và thu thập...'
                : collected
                  ? 'Chạy lại tìm kiếm và thu thập'
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
            <span>Kế hoạch có thể được mở lại bất cứ lúc nào bằng Request ID.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
