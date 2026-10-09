import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileText } from 'lucide-react';
import useResearchHistory from '../../hooks/useResearchHistory';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { StatusBadge } from '../ui/Badge';
import { formatDate } from '../../utils/format';
export default function RequestPicker({ destination = 'sources' }) {
  const history = useResearchHistory();
  const [id, setId] = useState('');
  const navigate = useNavigate();
  const target = (requestId) =>
    destination === 'sources'
      ? `/research/${encodeURIComponent(requestId)}/sources`
      : `/research/${encodeURIComponent(requestId)}`;
  return (
    <Card className="request-picker">
      <div className="panel-heading">
        <h2>Mở nghiên cứu của bạn</h2>
      </div>
      <p className="section-description">
        Nhập Request ID từ backend hoặc n8n, hoặc chọn một nghiên cứu gần đây.
      </p>
      <form
        className="request-lookup"
        onSubmit={(event) => {
          event.preventDefault();
          if (id.trim()) navigate(target(id.trim()));
        }}
      >
        <label htmlFor="request-id" className="sr-only">
          Request ID
        </label>
        <input
          id="request-id"
          required
          value={id}
          onChange={(event) => setId(event.target.value)}
          placeholder="Dán Request ID tại đây..."
        />
        <Button type="submit">
          Mở nghiên cứu
          <ArrowRight size={17} />
        </Button>
      </form>
      {history.length > 0 && (
        <div className="recent-picker">
          {history.map((item) => (
            <div className="recent-row" key={item.requestId}>
              <span className="icon-tile small">
                <FileText size={19} />
              </span>
              <div>
                <a
                  href={target(item.requestId)}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(target(item.requestId));
                  }}
                >
                  {item.topic}
                </a>
                <small>
                  {formatDate(item.createdAt)} · {item.queryCount} truy vấn
                </small>
              </div>
              <StatusBadge status={item.status} />
              <Button variant="ghost" to={target(item.requestId)} aria-label={`Mở ${item.topic}`}>
                <ArrowRight size={17} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
