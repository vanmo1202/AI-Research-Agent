import Spinner from './Spinner';
import ErrorMessage from './ErrorMessage';
import Card from './Card';
import Button from './Button';
export default function PageState({ loading, error, onRetry }) {
  if (loading)
    return (
      <Card className="page-loading">
        <Spinner />
        <h2>Đang tải dữ liệu nghiên cứu...</h2>
        <p>Đọc kết quả đã lưu từ backend.</p>
      </Card>
    );
  return (
    <Card className="page-error">
      <ErrorMessage error={error} />
      <div className="flex flex-wrap gap-3 mt-5">
        <Button onClick={onRetry} variant="secondary">
          Thử lại
        </Button>
        <Button to="/workflow-1">Tạo nghiên cứu mới</Button>
      </div>
    </Card>
  );
}
