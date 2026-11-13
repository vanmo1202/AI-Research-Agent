import { Link } from 'react-router-dom';
import { runUrl } from '../../services/runApi';
import { formatDate } from '../../utils/format';
import { StatusBadge } from '../ui/Badge';
export default function ResearchRows({ rows }) {
  return (
    <div className="os-research-list">
      {rows.map((r) => (
        <Link
          className="os-research-row"
          key={r.id}
          to={r.latestRunId ? runUrl(r.id, r.latestRunId) : `/research/${encodeURIComponent(r.id)}`}
        >
          <div>
            <strong>{r.topic}</strong>
            <small>
              {formatDate(r.created_at)} ·{' '}
              {r.latestRunId ? `Run ${r.latestRunId.slice(0, 8)}` : 'Chưa có run'}
            </small>
          </div>
          <StatusBadge status={r.runStatus || r.status} />
          <span aria-hidden="true">↗</span>
        </Link>
      ))}
    </div>
  );
}
