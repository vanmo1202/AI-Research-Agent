import { Link } from 'react-router-dom';
import { Search, Layers, FileText, BookOpen, BrainCircuit } from 'lucide-react';
export const features = [
  {
    title: 'Nghiên cứu tổng hợp',
    description: 'Lập kế hoạch, tìm kiếm và thu thập nguồn (đã hợp nhất)',
    icon: Search,
    color: '#2774e7',
    bg: '#eef6ff',
    border: '#d4e6ff',
    badge: '#4e94ec',
    to: '/researches',
  },
  {
    title: 'Phân tích bằng chứng',
    description: 'Đọc, trích xuất và đánh giá độ tin cậy của nguồn',
    icon: Layers,
    color: '#19964b',
    bg: '#effbf4',
    border: '#d6efdf',
    badge: '#4cb971',
    to: '/evidence',
  },
  {
    title: 'Tạo báo cáo',
    description: 'Tổng hợp phân tích và xuất báo cáo hoàn chỉnh',
    icon: FileText,
    color: '#e97a11',
    bg: '#fff8ef',
    border: '#f9e5ca',
    badge: '#f0a53b',
    to: '/reports',
  },
  {
    title: 'Chat với tài liệu (RAG)',
    description: 'Hỏi đáp, tra cứu và trích dẫn từ tài liệu PDF',
    icon: BookOpen,
    color: '#5651d9',
    bg: '#f5f3ff',
    border: '#e4dfff',
    badge: '#8585f1',
    to: '/chat',
  },
  {
    title: 'Quản lý bộ nhớ (Memory)',
    description: 'Lưu, duyệt và sử dụng tri thức cho các nghiên cứu sau',
    icon: BrainCircuit,
    color: '#d23c86',
    bg: '#fff4fa',
    border: '#f7ddec',
    badge: '#db66a3',
    to: '/memories',
  },
];
export default function FeatureCards() {
  return (
    <div className="ref-workflow-list">
      {features.map(({ icon: Icon, ...f }, i) => (
        <article
          className="ref-workflow-card"
          key={f.to}
          style={{ '--wbg': f.bg, '--wborder': f.border, '--wcolor': f.color, '--wbadge': f.badge }}
        >
          <span className="ref-workflow-num">{i + 1}</span>
          <div className="ref-workflow-symbol">
            <Icon className="ref-ico" />
          </div>
          <h3>{f.title}</h3>
          <p>{f.description}</p>
          <Link to={f.to} aria-label={`Bắt đầu ${f.title}`} className="ref-feature-action">
            Bắt đầu →
          </Link>
        </article>
      ))}
    </div>
  );
}
