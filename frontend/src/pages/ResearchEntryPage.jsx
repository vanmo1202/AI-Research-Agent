import { lazy, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import useKnowledge from '../hooks/useKnowledge';
import { createRun, runUrl } from '../services/runApi';
import Button from '../components/ui/Button';
import ErrorMessage from '../components/ui/ErrorMessage';
const ResearchPlanPage = lazy(() => import('./ResearchPlanPage'));
export default function ResearchEntryPage() {
  const { requestId } = useParams();
  return <Entry key={requestId} requestId={requestId} />;
}
function Entry({ requestId }) {
  const list = useKnowledge('/research'),
    research = useKnowledge(`/research/${encodeURIComponent(requestId)}`),
    navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    key = useRef(null),
    lock = useRef(false),
    options = useRef(null);
  const latest = list.data?.find((r) => r.id === requestId);
  if (latest?.latestRunId) return <Navigate to={runUrl(requestId, latest.latestRunId)} replace />;
  if (list.loading || research.loading) return <p role="status">Đang tải nghiên cứu…</p>;
  if (list.error || research.error)
    return (
      <div className="os-panel">
        <ErrorMessage error={list.error || research.error} />
        <Button
          onClick={() => {
            list.reload();
            research.reload();
          }}
        >
          Tải lại nghiên cứu
        </Button>
      </div>
    );
  if (research.data?.request?.status !== 'created') return <ResearchPlanPage />;
  async function submit(e) {
    e.preventDefault();
    if (lock.current) return;
    const f = Object.fromEntries(new FormData(e.currentTarget));
    options.current ||= {
      language: f.language,
      numberOfSources: Number(f.numberOfSources),
      searchMore: f.searchMore === 'on',
      orchestration: 'backend',
    };
    key.current ||= crypto.randomUUID();
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const run = await createRun(requestId, options.current, key.current);
      navigate(runUrl(requestId, run.runId));
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="page-enter os-page">
      <h1>{research.data?.request?.topic}</h1>
      <Button to={`/research/${encodeURIComponent(requestId)}/chat`} variant="secondary">
        Hỏi AI về nghiên cứu
      </Button>
      <section className="os-panel">
        <h2>Yêu cầu đã lưu, chưa có run được xác nhận</h2>
        <p>{research.data?.request?.goal}</p>
        <p>Tạo run để bắt đầu sáu giai đoạn. Kiểm tra lại trước nếu bạn vừa gặp lỗi kết nối.</p>
        <Button variant="secondary" onClick={list.reload}>
          Kiểm tra run gần nhất
        </Button>
        <form className="os-form" onSubmit={submit}>
          <fieldset className="os-fieldset" disabled={busy || !!options.current}>
            <label>
              Ngôn ngữ
              <select name="language">
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              Số nguồn
              <input
                type="number"
                name="numberOfSources"
                min={1}
                max={30}
                defaultValue={12}
                required
              />
            </label>
            <label className="knowledge-checkbox">
              <input type="checkbox" name="searchMore" defaultChecked />
              Tìm thêm nguồn khi thiếu bằng chứng
            </label>
          </fieldset>
          <ErrorMessage error={error} />
          <Button type="submit" loading={busy}>
            Tạo run nghiên cứu
          </Button>
        </form>
      </section>
    </div>
  );
}
