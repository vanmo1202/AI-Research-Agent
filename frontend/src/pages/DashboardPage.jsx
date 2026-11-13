import { Link } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Database,
  FileText,
  FolderOpen,
  Layers,
  MessageSquareText,
  Plus,
  Upload,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useWorkspaceUI } from '../components/workspace/WorkspaceUI';
import useKnowledge from '../hooks/useKnowledge';
import FeatureCards from '../components/workspace/FeatureCards';
import PanelHeading from '../components/workspace/PanelHeading';
import ActivityList from '../components/workspace/ActivityList';
import { accountActivity } from '../components/workspace/activity';
import { StatusBadge } from '../components/ui/Badge';
import ErrorMessage from '../components/ui/ErrorMessage';
import { runUrl } from '../services/runApi';
import { formatDate } from '../utils/format';
import thumb1 from '../assets/reference/thumb1.webp';
import thumb2 from '../assets/reference/thumb2.webp';
import thumb3 from '../assets/reference/thumb3.webp';
const thumbs = [thumb1, thumb2, thumb3];
export default function DashboardPage() {
  const { user } = useAuth(),
    { openDialog } = useWorkspaceUI();
  const summary = useKnowledge('/dashboard'),
    research = useKnowledge('/research'),
    docs = useKnowledge('/documents'),
    chats = useKnowledge('/chats'),
    memories = useKnowledge('/memories');
  const metrics = [
    [FolderOpen, 'researchCount', 'Tổng nghiên cứu'],
    [FileText, 'documentCount', 'Tài liệu'],
    [CheckCircle2, 'completedCount', 'Đã hoàn thành'],
    [Database, 'verifiedMemoryCount', 'Bộ nhớ đã duyệt'],
  ];
  const data = summary.data;
  const activities = accountActivity({
    researches: research.data || [],
    documents: docs.data || [],
    chats: chats.data || [],
    memories: memories.data || [],
  });
  return (
    <div className="ref-dashboard">
      <section className="ref-hero">
        <div className="ref-hero-art" aria-hidden="true" />
        <div className="ref-hero-inside">
          <h1 className="ref-hero-title">👋 Chào mừng trở lại, {user.name}!</h1>
          <p className="ref-hero-desc">
            Tiếp tục nghiên cứu, khai thác tri thức và tạo báo cáo chuyên sâu.
          </p>
          <section
            className="ref-stats"
            aria-label="Thống kê tài khoản"
            aria-busy={summary.loading}
          >
            {metrics.map(([Icon, key, label]) => (
              <div className="ref-stat studio-metric" key={key}>
                <span className="ref-stat-icon">
                  <Icon size={22} />
                </span>
                <div className="ref-stat-copy">
                  <div className="ref-stat-label">{label}</div>
                  <div className="ref-stat-line">
                    <strong className="ref-stat-number">
                      {summary.loading ? '…' : summary.error ? '—' : (data?.[key] ?? '—')}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </section>
        </div>
      </section>
      <ErrorMessage error={summary.error} />
      {summary.error && (
        <button className="ref-secondary" onClick={summary.reload}>
          Tải lại tổng quan
        </button>
      )}
      <div className="ref-dashboard-grid">
        <div className="ref-left-stack">
          <section className="ref-card ref-workflows-panel">
            <PanelHeading
              title="5 luồng làm việc"
              icon={Layers}
              action={
                <Link className="ref-text-link" to="/workflows">
                  Xem chi tiết các luồng →
                </Link>
              }
              description="Quy trình nghiên cứu từ ý tưởng đến báo cáo, kết hợp tri thức và trợ lý AI."
            />
            <FeatureCards />
          </section>
          <div className="ref-lower-grid">
            <section className="ref-card ref-compact-card">
              <PanelHeading
                title="Nghiên cứu gần đây"
                icon={CalendarDays}
                action={
                  <Link className="ref-text-link" to="/researches">
                    Xem tất cả →
                  </Link>
                }
              />
              <ErrorMessage error={research.error} />
              <div className="ref-recent-list">
                {research.loading ? (
                  <p className="ref-empty" role="status">
                    Đang tải nghiên cứu…
                  </p>
                ) : research.error ? (
                  <button className="ref-text-link" onClick={research.reload}>
                    Thử tải lại
                  </button>
                ) : !research.data?.length ? (
                  <p className="ref-empty">
                    Chưa có nghiên cứu.{' '}
                    <button className="ref-text-link" onClick={() => openDialog('research')}>
                      Tạo nghiên cứu đầu tiên
                    </button>
                  </p>
                ) : (
                  research.data.slice(0, 3).map((r, i) => (
                    <Link
                      className="ref-recent-row"
                      key={r.id}
                      to={
                        r.latestRunId
                          ? runUrl(r.id, r.latestRunId)
                          : `/research/${encodeURIComponent(r.id)}`
                      }
                    >
                      <img className="ref-thumb" src={thumbs[i]} width={54} height={38} alt="" />
                      <span className="ref-recent-info">
                        <strong className="ref-recent-title">{r.topic}</strong>
                        <span className="ref-recent-meta">
                          {formatDate(r.created_at)} ·{' '}
                          {r.latestRunId ? 'Lượt chạy gần nhất' : 'Yêu cầu đã lưu'}
                        </span>
                      </span>
                      <StatusBadge status={r.runStatus || r.status} />
                    </Link>
                  ))
                )}
              </div>
            </section>
            <section className="ref-card ref-compact-card">
              <PanelHeading
                title="Không gian tri thức"
                icon={BookOpen}
                action={
                  <Link aria-label="Mở thư viện tài liệu" className="ref-text-link" to="/documents">
                    →
                  </Link>
                }
              />
              <div className="ref-knowledge-list">
                {[
                  [
                    FileText,
                    '/documents',
                    `${summary.loading || summary.error ? '—' : (data?.documentCount ?? '—')} tài liệu`,
                    'PDF, tài liệu nghiên cứu, báo cáo…',
                    '#e2f5ff',
                    '#168dce',
                  ],
                  [
                    MessageSquareText,
                    '/chat',
                    'Chat với tài liệu',
                    'Hỏi đáp, trích dẫn, tóm tắt nhanh',
                    '#f0eaff',
                    '#7451c6',
                  ],
                  [
                    Database,
                    '/memories',
                    'Bộ nhớ AI',
                    `${summary.loading || summary.error ? '—' : (data?.verifiedMemoryCount ?? '—')} mục tri thức đã được duyệt`,
                    '#fff2e3',
                    '#dd810d',
                  ],
                ].map(([Icon, to, title, description, bg, color]) => (
                  <Link className="ref-knowledge-item" to={to} key={to}>
                    <span className="ref-knowledge-symbol" style={{ background: bg, color }}>
                      <Icon size={19} />
                    </span>
                    <span className="ref-knowledge-text">
                      <strong>{title}</strong>
                      <span>{description}</span>
                    </span>
                    <ChevronRight size={16} className="ref-knowledge-arr" />
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
        <div className="ref-right-stack">
          <section className="ref-card">
            <PanelHeading title="Hoạt động gần đây" icon={Activity} />
            <ErrorMessage error={docs.error || chats.error || memories.error} />
            {research.loading || docs.loading || chats.loading || memories.loading ? (
              <p className="ref-empty" role="status">
                Đang tải hoạt động…
              </p>
            ) : (
              <ActivityList
                items={activities.slice(0, 4)}
                unavailable={!!(research.error || docs.error || chats.error || memories.error)}
              />
            )}
          </section>
          <section className="ref-card">
            <PanelHeading title="Truy cập nhanh" icon={Zap} />
            <div className="ref-quick-grid">
              <button className="ref-quick" onClick={() => openDialog('research')}>
                <Plus size={22} />
                Nghiên cứu mới
              </button>
              <button className="ref-quick ref-qgreen" onClick={() => openDialog('upload')}>
                <Upload size={22} />
                Tải lên PDF
              </button>
              <Link className="ref-quick ref-qpurple" to="/chat">
                <MessageSquareText size={22} />
                Chat với tài liệu
              </Link>
              <Link className="ref-quick ref-qorange" to="/reports">
                <FileText size={22} />
                Xem báo cáo
              </Link>
            </div>
          </section>
        </div>
      </div>
      <p className="ref-dashboard-note">
        Dữ liệu tài khoản từ máy chủ. Hoạt động lấy từ thời điểm tạo/cập nhật tài nguyên; chưa có
        nhật ký kiểm toán hoặc tăng trưởng theo tuần.
      </p>
    </div>
  );
}
