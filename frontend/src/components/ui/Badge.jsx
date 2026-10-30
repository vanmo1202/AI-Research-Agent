export function StatusBadge({ status }) {
  const labels = {
    planning: 'Đang lập kế hoạch',
    planned: 'Đã lập kế hoạch',
    searching: 'Đang tìm kiếm',
    collected: 'Đã thu thập',
    translating: 'Đang chuẩn bị bản tiếng Việt',
    analyzing: 'Đang phân tích',
    analyzed: 'Đã phân tích',
    analyzed_partial: 'Hoàn thành một phần',
    completed: 'Đã hoàn thành',
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
