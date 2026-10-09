import { Search } from 'lucide-react';
import Card from '../ui/Card';
import CopyButton from '../ui/CopyButton';
export default function SearchQueries({ queries }) {
  return (
    <Card className="plan-list queries-list">
      <div className="panel-heading">
        <h2>
          <span className="heading-icon teal">
            <Search size={19} />
          </span>
          Search Queries
        </h2>
        <span className="count-badge">{queries.length}</span>
      </div>
      <p className="section-description">Truy vấn sẵn sàng để khám phá nguồn tài liệu.</p>
      {queries.length ? (
        <ol>
          {queries.map((item, index) => (
            <li key={`${item.questionId}-${index}`}>
              <span className="number-circle">{index + 1}</span>
              <div>
                <small>{item.questionId}</small>
                <p>{item.query}</p>
              </div>
              <CopyButton text={item.query} label={`Sao chép truy vấn ${index + 1}`} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted p-5">Chưa có truy vấn tìm kiếm.</p>
      )}
    </Card>
  );
}
