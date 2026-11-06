import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  FileText,
  Files,
  MessageSquareText,
  Plus,
  Workflow,
} from 'lucide-react';
import useKnowledge from '../hooks/useKnowledge';
import { formatDate } from '../utils/format';
import { researchJourney } from '../utils/researchJourney';
import Button from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import ErrorMessage from '../components/ui/ErrorMessage';
import PageHeader from '../components/ui/PageHeader';
import SectionHeading from '../components/ui/SectionHeading';
import MetricCard from '../components/ui/MetricCard';
import Skeleton from '../components/ui/Skeleton';
import ResearchOrbit from '../components/dashboard/ResearchOrbit';
const tools = [
  {
    to: '/documents',
    icon: Files,
    label: 'Thư viện tài liệu',
    description: 'Lưu trữ PDF và truy xuất nguồn gốc.',
  },
  {
    to: '/chat',
    icon: MessageSquareText,
    label: 'Đối thoại với tri thức',
    description: 'Đặt câu hỏi, tìm câu trả lời có dẫn chứng.',
  },
  {
    to: '/memories',
    icon: BrainCircuit,
    label: 'Bộ nhớ AI',
    description: 'Kiểm chứng và kết nối những điều đã học.',
  },
];
const steps = [
  { label: 'Đặt câu hỏi', description: 'Xác định chủ đề và lập kế hoạch.', path: 'research' },
  { label: 'Thu thập nguồn', description: 'Tìm kiếm, chọn lọc tài liệu.', path: 'workflow-2' },
  {
    label: 'Phân tích bằng chứng',
    description: 'Đối chiếu và làm rõ luận điểm.',
    path: 'workflow-3',
  },
  { label: 'Viết báo cáo', description: 'Tổng hợp, trích dẫn và xuất bản.', path: 'workflow-4' },
];
export default function DashboardPage() {
  const summary = useKnowledge('/dashboard');
  const history = summary.data?.recentResearch || [];
  const latest = history[0];
  const latestId = latest?.requestId;
  const journey = researchJourney({
    status: latest?.status,
    planned: (latest?.questionCount || 0) > 0,
  });
  const metrics = [
    {
      icon: FileText,
      key: 'researchCount',
      label: 'Nghiên cứu gần đây',
      note: 'Những câu hỏi đang được khám phá',
      tone: 'forest',
    },
    {
      icon: Files,
      key: 'documentCount',
      label: 'Tài liệu PDF',
      note: 'Nguồn tư liệu trong thư viện',
      tone: 'terracotta',
    },
    {
      icon: BrainCircuit,
      key: 'verifiedMemoryCount',
      label: 'Bộ nhớ đã xác minh',
      note: 'Tri thức đã được bạn kiểm chứng',
      tone: 'teal',
    },
    {
      icon: CheckCircle2,
      key: 'completedCount',
      label: 'Nghiên cứu hoàn tất',
      note: 'Từ ý tưởng đến một bản báo cáo',
      tone: 'forest',
    },
  ];
  return (
    <div className="page-enter studio-dashboard">
      <PageHeader
        eyebrow="Không gian nghiên cứu của bạn"
        title={
          <>
            Không chỉ tìm kiếm.
            <br />
            <em>Hãy khám phá.</em>
          </>
        }
        description="Dành một khoảng lặng cho những câu hỏi lớn."
      >
        <Button to="/workflow-1">
          <Plus size={18} />
          Nghiên cứu mới
        </Button>
      </PageHeader>
      <section className="studio-hero" aria-labelledby="studio-hero-title">
        <div className="studio-hero-copy">
          <p className="studio-eyebrow">
            <span className="studio-small-rule" />
            Trạm nghiên cứu của bạn
          </p>
          <h2 id="studio-hero-title">
            Một câu hỏi hay,
            <br />
            mở ra <em>vạn khả năng.</em>
          </h2>
          <p>
            Một nơi để tìm tòi, kết nối bằng chứng và biến những ý tưởng rời rạc thành tri thức có
            căn cứ.
          </p>
          <Button to="/workflow-1">
            Bắt đầu nghiên cứu
            <ArrowRight size={18} />
          </Button>
          <span className="studio-hero-note">Có dẫn chứng. Có chiều sâu. Theo nhịp của bạn.</span>
        </div>
        <ResearchOrbit />
        <span className="studio-hero-caption" aria-hidden="true">
          Từ ý tưởng đến báo cáo
        </span>
      </section>
      <section
        className="studio-metrics"
        aria-label="Thống kê tài khoản"
        aria-busy={summary.loading}
      >
        {metrics.map(({ key, ...metric }) => (
          <MetricCard
            key={key}
            {...metric}
            value={summary.data?.[key]}
            loading={summary.loading}
            error={summary.error}
          />
        ))}
      </section>
      <div className="studio-data-note">
        <span className="studio-quiet-dot" />
        <p>Thống kê từ dữ liệu tài khoản của bạn.</p>
      </div>
      {summary.loading && (
        <p role="status" className="sr-only">
          Đang tải tổng quan…
        </p>
      )}
      <ErrorMessage error={summary.error} />
      {summary.error && (
        <Button variant="secondary" onClick={summary.reload}>
          Tải lại tổng quan
        </Button>
      )}
      <div className="studio-dashboard-columns">
        <section className="studio-recent" aria-labelledby="recent-title">
          <SectionHeading
            id="recent-title"
            eyebrow="Trên bàn làm việc"
            title="Nghiên cứu gần đây"
            description="Tiếp tục từ nơi bạn đang dừng lại."
          >
            <Link className="studio-text-link" to="/sources">
              Xem nguồn
              <ArrowUpRight size={16} />
            </Link>
          </SectionHeading>
          {summary.loading ? (
            <div className="studio-recent-skeleton" aria-hidden="true">
              {[0, 1, 2].map((n) => (
                <Skeleton key={n} />
              ))}
            </div>
          ) : summary.error ? (
            <p className="studio-unavailable">
              Chưa thể tải danh sách nghiên cứu. Hãy thử tải lại tổng quan.
            </p>
          ) : history.length ? (
            <div className="studio-recent-list">
              {history.slice(0, 6).map((item, index) => (
                <Link
                  className="studio-research-row"
                  key={item.requestId}
                  to={`/research/${encodeURIComponent(item.requestId)}`}
                  aria-label={item.topic}
                >
                  <span className="studio-row-number" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="studio-research-copy">
                    <strong>{item.topic}</strong>
                    <small>
                      {formatDate(item.createdAt)}
                      <span aria-hidden="true"> · </span>
                      {item.questionCount || 0} câu hỏi<span aria-hidden="true"> · </span>
                      {item.sourceCount || 0} nguồn
                    </small>
                  </span>
                  <StatusBadge status={item.status} />
                  <ArrowUpRight size={20} className="studio-row-arrow" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="studio-empty">
              <BookOpen size={34} strokeWidth={1.3} />
              <div>
                <h3>Chưa có nghiên cứu gần đây</h3>
                <p>
                  Mỗi hành trình tri thức bắt đầu bằng một câu hỏi. Hãy bắt đầu với điều bạn đang tò
                  mò.
                </p>
              </div>
              <Button variant="secondary" to="/workflow-1">
                <Plus size={17} />
                Tạo nghiên cứu
              </Button>
            </div>
          )}
        </section>
        <section className="studio-journey" aria-labelledby="journey-title">
          <SectionHeading
            id="journey-title"
            eyebrow="Phương pháp"
            title="Một hành trình, bốn bước"
            description={
              latest
                ? `Tiến trình nghiên cứu: ${latest.topic}`
                : 'Từ sự tò mò đến những kết luận có cơ sở.'
            }
          />
          <ol className="studio-journey-steps">
            {steps.map((step, index) => {
              const state = latest ? journey.steps[index] : null;
              const to = latestId
                ? index === 0
                  ? `/research/${encodeURIComponent(latestId)}`
                  : `/${step.path}/${encodeURIComponent(latestId)}`
                : '/workflow-1';
              return (
                <li key={step.label} data-state={state?.state || 'pending'}>
                  <Link to={to}>
                    <span className="studio-step-index">
                      {String(index + 1).padStart(2, '0')}
                      {state?.state === 'complete' && (
                        <CheckCircle2 size={14} aria-label="Hoàn tất" />
                      )}
                    </span>
                    <h3>{step.label}</h3>
                    <p>{step.description}</p>
                    {state && <small>{state.label}</small>}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
      <section className="studio-tool-section" aria-labelledby="tools-title">
        <SectionHeading
          id="tools-title"
          title="Những công cụ cho sự tò mò"
          description="Mọi nguồn tư liệu. Cùng một không gian."
        />
        <div className="studio-tools">
          {tools.map(({ to, icon: Icon, label, description }) => (
            <Link to={to} key={to} className="studio-tool">
              <Icon size={24} strokeWidth={1.5} />
              <div>
                <h3>{label}</h3>
                <p>{description}</p>
              </div>
              <ArrowUpRight size={19} />
            </Link>
          ))}
        </div>
      </section>
      <footer className="studio-dashboard-footer">
        <span>ResearchOS</span>
        <p>Không gian cho tư duy độc lập.</p>
        <Workflow size={17} aria-hidden="true" />
      </footer>
    </div>
  );
}
