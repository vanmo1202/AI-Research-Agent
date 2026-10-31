import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/runApi';
export default function RunDashboardPage() {
  const [rows, setRows] = useState([]),
    [error, setError] = useState('');
  const load = () =>
    api('')
      .then(setRows)
      .catch((e) => setError(e.message));
  useEffect(() => {
    const controller = new AbortController();
    api('', { signal: controller.signal })
      .then(setRows)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  async function action(row, name) {
    try {
      await api(`/runs/${row.latestRunId}/${name}`, { body: {}, key: crypto.randomUUID() });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="flow-v2">
      <header className="flow-heading">
        <div>
          <small>KHÔNG GIAN NGHIÊN CỨU</small>
          <h1>Nghiên cứu của bạn</h1>
          <p>Theo dõi bằng chứng, nguồn và báo cáo qua từng lần chạy.</p>
        </div>
        <Link className="flow-primary" to="/research/new">
          Tạo nghiên cứu mới
        </Link>
      </header>
      {error && (
        <p role="alert">
          {error} <button onClick={load}>Thử lại</button>
        </p>
      )}
      <section className="flow-panel">
        <h2>Research requests</h2>
        {!rows.length && <p>Chưa có nghiên cứu. Hãy bắt đầu với một chủ đề.</p>}
        {rows.map((row) => (
          <article className="flow-row" key={row.id}>
            <div>
              <h3>
                <Link
                  to={
                    row.latestRunId
                      ? `/research/${row.id}/runs/${row.latestRunId}`
                      : `/research/${row.id}`
                  }
                >
                  {row.topic}
                </Link>
              </h3>
              <p>{row.goal}</p>
              <small>
                {new Date(row.created_at).toLocaleString('vi-VN')} · {row.runStatus || row.status}
              </small>
            </div>
            <div className="flow-actions">
              <Link
                to={
                  row.latestRunId
                    ? `/research/${row.id}/runs/${row.latestRunId}`
                    : `/research/${row.id}`
                }
              >
                Tiếp tục xem kết quả
              </Link>
              {['failed', 'partial'].includes(row.runStatus) && (
                <button onClick={() => action(row, 'retry')}>Retry</button>
              )}
              {['queued', 'running'].includes(row.runStatus) && (
                <button onClick={() => action(row, 'cancel')}>Cancel</button>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
