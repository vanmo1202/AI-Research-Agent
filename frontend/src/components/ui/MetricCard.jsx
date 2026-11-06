import Skeleton from './Skeleton';
export default function MetricCard({
  icon: Icon,
  value,
  label,
  note,
  loading,
  error,
  tone = 'forest',
}) {
  return (
    <div className={`studio-metric studio-metric-${tone}`}>
      <div className="studio-metric-top">
        <span className="studio-metric-icon">
          <Icon size={20} strokeWidth={1.6} />
        </span>
        <span className="studio-metric-label">{label}</span>
      </div>
      <strong>
        {loading ? <Skeleton className="metric-skeleton" /> : error ? '—' : (value ?? '—')}
      </strong>
      <p>{note}</p>
    </div>
  );
}
