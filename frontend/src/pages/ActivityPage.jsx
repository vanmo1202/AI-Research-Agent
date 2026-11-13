import { useState } from 'react';
import useKnowledge from '../hooks/useKnowledge';
import ErrorMessage from '../components/ui/ErrorMessage';
import Button from '../components/ui/Button';
import '../styles/analytics.css';
const colors = {
  completed: '#15806a',
  ready: '#15806a',
  verified: '#15806a',
  running: '#2563eb',
  processing: '#2563eb',
  queued: '#739acb',
  pending: '#739acb',
  partial: '#b77916',
  unsupported: '#c44848',
  failed: '#c44848',
  inaccessible: '#c44848',
  unverified: '#64748b',
  cancelled: '#94a3b8',
  no_run: '#94a3b8',
};
const labels = {
  completed: 'Hoàn thành',
  ready: 'Sẵn sàng',
  verified: 'Đã xác minh',
  running: 'Đang chạy',
  processing: 'Đang xử lý',
  queued: 'Chờ chạy',
  pending: 'Chờ xử lý',
  partial: 'Một phần',
  unsupported: 'Không hỗ trợ nhận định',
  failed: 'Lỗi',
  inaccessible: 'Không truy cập được',
  unverified: 'Chưa xác minh',
  cancelled: 'Đã hủy',
  no_run: 'Chưa có lượt chạy',
};
function Chart({ title, rows = [], type = 'bar', note }) {
  const total = rows.reduce((sum, row) => sum + Number(row.value), 0);
  const max = Math.max(1, ...rows.map((row) => Number(row.value)));
  let offset = 0;
  return (
    <section className="ref-card analytics-chart">
      <h2>{title}</h2>
      <p className="ref-small-note">{note}</p>
      {!rows.length || !total ? (
        <p className="os-empty">Chưa có dữ liệu trong khoảng thời gian này.</p>
      ) : (
        <>
          {type === 'stack' && (
            <svg viewBox="0 0 600 80" role="img" aria-label={title}>
              {rows.map((row) => {
                const width = (Number(row.value) / total) * 580;
                const x = offset;
                offset += width;
                return (
                  <rect
                    key={row.label}
                    x={10 + x}
                    y="20"
                    width={width}
                    height="40"
                    fill={colors[row.label] || '#2563eb'}
                    tabIndex="0"
                  >
                    <title>
                      {labels[row.label] || row.label}: {row.value}
                    </title>
                  </rect>
                );
              })}
            </svg>
          )}
          {type === 'donut' ? (
            <svg viewBox="0 0 200 160" role="img" aria-label={title}>
              {rows.map((row) => {
                const length = (Number(row.value) / total) * 314.159;
                const start = offset;
                offset += length;
                return (
                  <circle
                    key={row.label}
                    cx="100"
                    cy="80"
                    r="50"
                    fill="none"
                    stroke={colors[row.label] || '#2563eb'}
                    strokeWidth="22"
                    strokeDasharray={`${length} 314.159`}
                    strokeDashoffset={-start}
                    transform="rotate(-90 100 80)"
                    tabIndex="0"
                  >
                    <title>
                      {labels[row.label] || row.label}: {row.value}
                    </title>
                  </circle>
                );
              })}
              <text x="100" y="85" textAnchor="middle" fill="#172c4b">
                {total}
              </text>
            </svg>
          ) : type === 'line' ? (
            <svg viewBox="0 0 600 180" role="img" aria-label={title}>
              <path d="M20 155H580" stroke="#d5dfeb" />
              <polyline
                fill="none"
                stroke="#2563eb"
                strokeWidth="3"
                points={rows
                  .map(
                    (r, i) =>
                      `${20 + (i * 560) / Math.max(1, rows.length - 1)},${150 - (Number(r.value) / max) * 125}`,
                  )
                  .join(' ')}
              />
              {rows.map((r, i) => (
                <circle
                  key={r.label}
                  cx={20 + (i * 560) / Math.max(1, rows.length - 1)}
                  cy={150 - (Number(r.value) / max) * 125}
                  r="5"
                  fill="#2563eb"
                  tabIndex="0"
                >
                  <title>
                    {r.label}: {r.value} nghiên cứu
                  </title>
                </circle>
              ))}
            </svg>
          ) : null}
          <ul className={type === 'stack' ? 'analytics-stack' : 'analytics-legend'}>
            {rows.map((row) => (
              <li key={row.label} title={`${labels[row.label] || row.label}: ${row.value}`}>
                <span>{labels[row.label] || row.label}</span>
                <strong>{row.value}</strong>
                {(type === 'bar' || type === 'stack') && (
                  <span
                    className="analytics-bar"
                    style={{
                      width: `${(Number(row.value) / max) * 100}%`,
                      background: colors[row.label] || '#2563eb',
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
export default function ActivityPage() {
  const [range, setRange] = useState('30');
  const result = useKnowledge(`/analytics?range=${range}`);
  const payload = result.data;
  const valid =
    payload &&
    payload.summary &&
    typeof payload.summary === 'object' &&
    !Array.isArray(payload.summary) &&
    ['timeline', 'statuses', 'volume', 'pdf', 'citations'].every(
      (key) =>
        Array.isArray(payload[key]) && payload[key].every((row) => row && typeof row === 'object'),
    );
  const invalid = !result.loading && !result.error && !valid;
  const data = valid ? payload : null;
  return (
    <section className="ref-subpage analytics-page">
      <div className="ref-page-heading">
        <div>
          <p className="ref-eyebrow">RESEARCHOS / THỐNG KÊ</p>
          <h1>Thống kê nghiên cứu</h1>
          <p>Dữ liệu tài khoản · Asia/Ho_Chi_Minh</p>
        </div>
        <Button variant="secondary" onClick={result.reload}>
          Làm mới
        </Button>
      </div>
      <div className="analytics-filters" role="group" aria-label="Khoảng thời gian">
        {[
          ['7', '7 ngày'],
          ['30', '30 ngày'],
          ['90', '90 ngày'],
          ['all', 'Toàn thời gian'],
        ].map(([value, label]) => (
          <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>
            {label}
          </button>
        ))}
      </div>
      <ErrorMessage
        error={result.error || (invalid ? 'Dữ liệu thống kê không hợp lệ. Hãy thử làm mới.' : null)}
      />
      {result.loading && <p role="status">Đang tải thống kê…</p>}
      {data && !result.error && (
        <>
          <div className="ref-metric-grid">
            {[
              ['Tổng nghiên cứu', data.summary.research],
              ['Hoàn thành', data.summary.completed],
              ['Tài liệu PDF', data.summary.documents],
              ['Nguồn hợp lệ', data.summary.validSources],
            ].map(([label, value]) => (
              <div className="ref-card ref-metric" key={label}>
                <small>{label}</small>
                <strong>{value ?? '—'}</strong>
              </div>
            ))}
          </div>
          <p className="ref-small-note">
            Hoàn thành: số nghiên cứu có lượt chạy hoàn tất trong kỳ, theo ngày hoàn tất. Các biểu đồ
            nghiên cứu còn lại theo ngày tạo yêu cầu; trạng thái là lượt chạy mới nhất. Nguồn hợp lệ chỉ
            gồm nguồn Tavily có trích dẫn đã xác minh và bằng chứng được lưu. Thiếu kết quả kiểm định hiển
            thị dấu gạch ngang.
          </p>
          <div className="analytics-grid">
            <Chart
              title="Nghiên cứu theo thời gian"
              rows={data.timeline}
              type="line"
              note="Ngày tạo nghiên cứu; ngày không có bản ghi không được hiển thị."
            />
            <Chart
              title="Trạng thái nghiên cứu"
              rows={data.statuses}
              type="donut"
              note="Lượt chạy mới nhất của từng nghiên cứu trong kỳ."
            />
            <Chart
              title="Nguồn và bằng chứng theo nghiên cứu"
              rows={data.volume.flatMap((r) => [
                { label: `${r.label} · Nguồn`, value: r.sources },
                { label: `${r.label} · Bằng chứng`, value: r.evidence },
              ])}
              note="12 nghiên cứu mới nhất; tổng nguồn các run và bằng chứng bản phân tích mới nhất mỗi lượt chạy. Chỉ số tổng hợp không bị giới hạn 12 bản ghi."
            />
            <Chart
              title="Xác minh trích dẫn"
              rows={data.citations}
              type="stack"
              note="Kết quả được lưu trong báo cáo mới nhất mỗi lượt chạy; không suy ra từ mã trạng thái HTTP."
            />
            <Chart
              title="Xử lý tài liệu PDF"
              rows={data.pdf}
              type="donut"
              note="PDF được tạo trong kỳ, chưa bị xóa; trạng thái hiện tại."
            />
          </div>
        </>
      )}
    </section>
  );
}
