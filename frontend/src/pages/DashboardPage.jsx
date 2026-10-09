import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCheck,
  Database,
  FileText,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import useResearchHistory from '../hooks/useResearchHistory';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge, { StatusBadge } from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import WorkflowProgress from '../components/research/WorkflowProgress';
import { formatDate } from '../utils/format';
export default function DashboardPage() {
  const history = useResearchHistory();
  const plans = history.filter((item) => item.questionCount > 0).length;
  const sourceCount = history.reduce((sum, item) => sum + (item.sourceCount || 0), 0);
  const completed = history.reduce(
    (sum, item) => sum + (item.questionCount > 0 ? 1 : 0) + (item.status === 'collected' ? 1 : 0),
    0,
  );
  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <span>Không gian nghiên cứu</span>
        <span>/</span>
        <strong>Dashboard</strong>
      </div>
      <div className="page-intro">
        <div>
          <p className="eyebrow">CHÀO MỪNG TRỞ LẠI, MINH ANH</p>
          <h1>Tổng quan dự án nghiên cứu</h1>
          <p>Một không gian cho những ý tưởng và khám phá tiếp theo của bạn.</p>
        </div>
        <Button to="/workflow-1">
          <Plus size={17} />
          Nghiên cứu mới
        </Button>
      </div>
      <div className="dashboard-banner">
        <div>
          <Badge tone="white">
            <Sparkles size={13} />
            YOUR RESEARCH COMPANION
          </Badge>
          <h2>
            Ý tưởng lớn.
            <br />
            Bắt đầu từ câu hỏi nhỏ.
          </h2>
          <p>
            Biến sự tò mò thành một kế hoạch rõ ràng,
            <br className="desktop-break" /> cùng AI khám phá những nguồn tri thức mới.
          </p>
          <Button to="/workflow-1" variant="white">
            Bắt đầu nghiên cứu
            <ArrowRight size={17} />
          </Button>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="banner-ring ring-large" />
          <div className="banner-ring ring-small" />
          <BrainCircuit size={86} strokeWidth={1} />
          <span className="banner-float float-file">
            <FileText size={30} />
          </span>
          <span className="banner-float float-search">
            <Search size={25} />
          </span>
          <Sparkles className="banner-sparkle" size={28} />
        </div>
      </div>
      <div className="dashboard-stats">
        <Card className="metric-card">
          <span className="metric-icon blue">
            <FileText size={22} />
          </span>
          <div>
            <span>Research Plan đã tạo</span>
            <strong>{plans}</strong>
            <small>Trong lịch sử trình duyệt</small>
          </div>
        </Card>
        <Card className="metric-card">
          <span className="metric-icon teal">
            <Database size={22} />
          </span>
          <div>
            <span>Nguồn tài liệu</span>
            <strong>{sourceCount}</strong>
            <small>Của các nghiên cứu đã mở</small>
          </div>
        </Card>
        <Card className="metric-card">
          <span className="metric-icon violet">
            <CheckCheck size={22} />
          </span>
          <div>
            <span>Workflow hoàn thành</span>
            <strong>{completed}</strong>
            <small>Tổng bước hoàn tất đã ghi nhận</small>
          </div>
        </Card>
      </div>
      <div className="content-with-panel">
        <div className="main-column">
          <Card className="recent-research">
            <div className="panel-heading">
              <h2>Nghiên cứu gần đây</h2>
              <Link to="/sources" className="text-button">
                Xem thư viện
                <ArrowUpRight size={15} />
              </Link>
            </div>
            {history.length ? (
              history.slice(0, 5).map((item) => (
                <div className="recent-row" key={item.requestId}>
                  <span className="icon-tile small">
                    <FileText size={20} />
                  </span>
                  <div>
                    <Link to={`/research/${item.requestId}`}>{item.topic}</Link>
                    <small>
                      {formatDate(item.createdAt)} · {item.questionCount} câu hỏi ·{' '}
                      {item.queryCount} truy vấn
                    </small>
                  </div>
                  <StatusBadge status={item.status} />
                  <Link
                    to={`/research/${item.requestId}`}
                    className="icon-button"
                    aria-label={`Mở ${item.topic}`}
                  >
                    <ArrowUpRight size={17} />
                  </Link>
                </div>
              ))
            ) : (
              <EmptyState
                title="Ý tưởng đầu tiên đang chờ bạn"
                description="Tạo yêu cầu nghiên cứu để AI giúp bạn lập kế hoạch và tìm nguồn tài liệu."
              >
                <Button to="/workflow-1">
                  <Plus size={16} />
                  Tạo Research Plan
                </Button>
              </EmptyState>
            )}
          </Card>
          <p className="library-note">
            Thống kê từ tối đa 20 nghiên cứu đã mở trong trình duyệt này; không phải tổng dữ liệu
            của server.
          </p>
        </div>
        <aside className="right-panel">
          <WorkflowProgress />
          <div className="dashboard-quote">
            <Sparkles size={22} />
            <p>
              “Nghiên cứu là nhìn thấy điều mọi người đã thấy, và nghĩ ra điều chưa ai nghĩ tới.”
            </p>
            <span>Mỗi câu hỏi đều là một khởi đầu.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
