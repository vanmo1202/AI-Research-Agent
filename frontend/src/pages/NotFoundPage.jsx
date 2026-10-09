import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
export default function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        title="Không tìm thấy trang"
        description="Đường dẫn này chưa tồn tại. Hãy trở lại không gian nghiên cứu."
      >
        <Button to="/">Về Dashboard</Button>
      </EmptyState>
    </Card>
  );
}
