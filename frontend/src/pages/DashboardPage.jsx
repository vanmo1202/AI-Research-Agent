import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BookOpen, BrainCircuit, CheckCircle2, FileText, Files, MessageSquareText, Plus, Sparkles, Workflow } from 'lucide-react';
import useResearchHistory from '../hooks/useResearchHistory';
import useKnowledge from '../hooks/useKnowledge';

import { researchJourney } from '../utils/researchJourney';
import { formatDate } from '../utils/format';
import Button from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';

const quickLinks = [
  { to: '/workflow-1', icon: Workflow, label: 'Nghiên cứu mới', description: 'Lập kế hoạch và thu thập nguồn' },
  { to: '/documents', icon: Files, label: 'Tải lên tài liệu', description: 'Xây dựng thư viện PDF RAG' },
  { to: '/chat', icon: MessageSquareText, label: 'Chat với tài liệu', description: 'Hỏi đáp kèm nguồn trích dẫn' },
  { to: '/memories', icon: BrainCircuit, label: 'Agent Memory', description: 'Kiểm chứng và tái sử dụng tri thức' },
];

export default function DashboardPage() {
  const history = useResearchHistory();
  const unlocked = true;
  const documents = useKnowledge(unlocked ? '/documents' : null);
  const memories = useKnowledge(unlocked ? '/memories?status=verified' : null);
  const completed = history.filter((item) => {
    const journey = researchJourney({
      ...item,
      planned: item.questionCount > 0,
      collected: item.sourceCount > 0,
    });
    return journey.workflowCompleted === 3;
  }).length;
  const sourceCount = history.reduce((sum, item) => sum + (item.sourceCount || 0), 0);
  return (
    <div className="page-enter researchos-dashboard">
      <div className="ro-page-heading">
        <div>
          <p className="ro-kicker">RESEARCH WORKSPACE</p>
          <h1>Chào bạn! <span aria-hidden="true">👋</span></h1>
          <p>Tiếp tục hành trình nghiên cứu, tìm hiểu tài liệu và xây dựng tri thức của bạn.</p>
        </div>
        <Button to="/workflow-1"><Plus size={17} /> Nghiên cứu mới</Button>
      </div>

      <section className="ro-hero" aria-label="Bắt đầu nghiên cứu">
        <div className="ro-hero-copy">
          <span className="ro-hero-eyebrow"><Sparkles size={15} /> AI RESEARCH COMPANION</span>
          <h2>Bạn muốn nghiên cứu điều gì hôm nay?</h2>
          <p>Mô tả ý tưởng, AI sẽ giúp bạn lập kế hoạch và tự động thu thập các nguồn phù hợp.</p>
          <Link to="/workflow-1" className="ro-hero-search">
            <span>Nhập chủ đề nghiên cứu và bắt đầu khám phá...</span>
            <span className="ro-hero-arrow"><ArrowRight size={18} /></span>
          </Link>
        </div>
        <div className="ro-hero-illustration" aria-hidden="true">
          <BookOpen size={92} strokeWidth={1.15} />
          <span className="ro-ai-tag">AI</span>
          <span className="ro-hero-glow" />
        </div>
      </section>

      <section className="ro-stat-grid" aria-label="Thống kê nghiên cứu trong trình duyệt">
        <div className="ro-stat"><span className="ro-stat-icon indigo"><FileText size={22}/></span><div><strong>{history.length}</strong><span>Nghiên cứu gần đây</span></div></div>
        <div className="ro-stat"><span className="ro-stat-icon blue"><Files size={22}/></span><div><strong>{unlocked ? (documents.data?.length ?? '—') : '—'}</strong><span>Tài liệu PDF</span></div></div>
        <div className="ro-stat"><span className="ro-stat-icon teal"><BrainCircuit size={22}/></span><div><strong>{unlocked ? (memories.data?.length ?? '—') : '—'}</strong><span>Bộ nhớ đã xác minh</span></div></div>
        <div className="ro-stat"><span className="ro-stat-icon indigo"><CheckCircle2 size={22}/></span><div><strong>{completed}</strong><span>Nghiên cứu hoàn tất</span></div></div>
      </section>
      <p className="ro-data-hint">Số nghiên cứu lấy từ lịch sử trình duyệt; PDF và Memory lấy từ tài khoản của bạn. Dấu — nghĩa là chưa có quyền xem hoặc dữ liệu chưa tải xong.</p>

      <div className="ro-dashboard-columns">
        <section className="ro-panel">
          <div className="ro-panel-head"><div><h2>Nghiên cứu gần đây</h2><p>Tiếp tục công việc đang thực hiện</p></div><Link to="/sources">Xem nguồn <ArrowUpRight size={15}/></Link></div>
          {history.length ? history.slice(0, 6).map((item) => (
            <Link className="ro-recent-row" to={`/research/${encodeURIComponent(item.requestId)}`} key={item.requestId} aria-label={item.topic}>
              <span className="ro-recent-icon"><FileText size={19}/></span>
              <span className="ro-recent-copy"><strong>{item.topic}</strong><small>{formatDate(item.createdAt)} · {item.questionCount || 0} câu hỏi · {item.sourceCount || 0} nguồn</small></span>
              <StatusBadge status={item.status} />
              <ArrowUpRight className="ro-recent-arrow" size={17}/>
            </Link>
          )) : <div className="ro-empty"><BookOpen size={30}/><h3>Chưa có nghiên cứu gần đây</h3><p>Tạo nghiên cứu đầu tiên để bắt đầu khám phá tri thức.</p><Button to="/workflow-1"><Plus size={16}/> Tạo nghiên cứu</Button></div>}
        </section>
        <section className="ro-panel">
          <div className="ro-panel-head"><div><h2>Truy cập nhanh</h2><p>Những công cụ bạn thường dùng</p></div></div>
          <div className="ro-quick-links">
            {quickLinks.map(({to,icon:Icon,label,description}) => (
              <Link to={to} key={to} className="ro-quick-link">
                <span className="ro-quick-icon"><Icon size={19}/></span><span><strong>{label}</strong><small>{description}</small></span><ArrowRight size={16}/>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
