import { Link } from 'react-router-dom';
import { Search, FileText, MessageSquareText, Database } from 'lucide-react';
const icons = { research: Search, document: FileText, chat: MessageSquareText, memory: Database };
export default function ActivityList({ items, unavailable = false }) {
  return (
    <div className="ref-activity-list">
      {items.length ? (
        items.map((a) => {
          const Icon = icons[a.kind] || Search;
          return (
            <Link to={a.url} className="ref-activity" key={a.id}>
              <span
                className={`ref-activity-icon ${a.kind === 'memory' ? 'ref-orange' : a.kind === 'document' ? 'ref-green' : a.kind === 'chat' ? 'ref-violet' : ''}`}
              >
                <Icon size={17} />
              </span>
              <span className="ref-activity-body">
                <strong className="ref-activity-title">{a.title}</strong>
                <span className="ref-activity-detail">{a.detail}</span>
              </span>
              <time
                className="ref-activity-time"
                dateTime={a.date}
                title={new Date(a.date).toLocaleString('vi-VN')}
              >
                {new Date(a.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
              </time>
            </Link>
          );
        })
      ) : (
        <p className="ref-empty">
          {unavailable
            ? 'Chưa thể tải hoạt động. Hãy thử tải lại trang.'
            : 'Chưa có hoạt động được ghi nhận.'}
        </p>
      )}
    </div>
  );
}
