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
    created: 'Đã tạo nghiên cứu',
    queued: 'Đang chờ xử lý',
    running: 'Đang xử lý',
    partial: 'Hoàn thành một phần',
    cancelled: 'Đã hủy',
    generating_report: 'Đang tạo báo cáo',
  };
  const tone =
    {
      planned: 'blue',
      collected: 'green',
      completed: 'green',
      failed: 'red',
      partial: 'amber',
      cancelled: 'neutral',
      running: 'blue',
      queued: 'blue',
      searching: 'blue',
      planning: 'blue',
    }[status] || 'neutral';
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
