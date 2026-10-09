export function StatusBadge({ status }) {
  const labels = {
    planning: 'Đang lập kế hoạch',
    planned: 'Planned',
    searching: 'Đang tìm kiếm',
    collected: 'Đã thu thập',
    failed: 'Thất bại',
  };
  const tone =
    { planned: 'blue', collected: 'green', failed: 'red', searching: 'violet', planning: 'violet' }[
      status
    ] || 'neutral';
  return (
    <Badge tone={tone}>
      <span className="status-dot" />
      {labels[status] || status || 'Chưa bắt đầu'}
    </Badge>
  );
}
export default function Badge({ children, tone = 'blue', className = '' }) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>;
}
