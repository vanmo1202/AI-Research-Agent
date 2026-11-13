import { useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { RefreshCw, MessageSquareText } from 'lucide-react';
import useKnowledge from '../hooks/useKnowledge';
import { exportRunReport, mutateRun, terminal } from '../services/runApi';
import { describeResearchValue } from '../utils/researchDisplay';
import { coverageLabel, stageLabel, statusLabel } from '../utils/displayLabels';
import Button from '../components/ui/Button';
import ErrorMessage from '../components/ui/ErrorMessage';
import { StatusBadge } from '../components/ui/Badge';
import RunProgress from '../components/research/RunProgress';
import { RunSources, RunEvidence, RunReport } from '../components/research/RunResults';

const pollRun = (data) => !terminal(data.status);
const tabs = [
  ['sources', 'Nguồn'],
  ['evidence', 'Bằng chứng'],
  ['report', 'Báo cáo'],
];

export default function RunWorkspacePage() {
  const { requestId, runId } = useParams();
  return <RunWorkspace key={`${requestId}/${runId}`} requestId={requestId} runId={runId} />;
}

function RunWorkspace({ requestId, runId }) {
  const root = `/research/runs/${encodeURIComponent(runId)}`;
  const progress = useKnowledge(
    `/research/${encodeURIComponent(requestId)}/runs/${encodeURIComponent(runId)}/progress`,
    pollRun,
  );
  const research = useKnowledge(`/research/${encodeURIComponent(requestId)}`);
  const active = progress.data && !terminal(progress.data.status);
  const sources = useKnowledge(`${root}/sources`, !!active);
  const evidence = useKnowledge(`${root}/evidence`, !!active);
  const reports = useKnowledge(`${root}/reports`, !!active);
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab');
  const tab = tabs.some(([key]) => key === requestedTab) ? requestedTab : 'sources';
  const setTab = (value) => setParams({ tab: value }, { replace: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const lock = useRef(false);
  const retryKey = useRef(null);
  const run = progress.data;

  function refreshResults() {
    sources.reload();
    evidence.reload();
    reports.reload();
  }

  async function handleAction(action, reportId) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (action === 'pdf' || action === 'docx') await exportRunReport(reportId, action);
      else {
        if (action === 'retry') retryKey.current ||= crypto.randomUUID();
        await mutateRun(runId, action, retryKey.current);
        if (action === 'retry') retryKey.current = null;
        progress.reload();
        refreshResults();
      }
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function refresh() {
    progress.reload();
    research.reload();
    refreshResults();
  }

  return (
    <div className="page-enter os-page">
      <Link className="os-back" to="/researches">
        ← Tất cả nghiên cứu
      </Link>
      <div className="os-page-head">
        <div>
          <p className="os-overline">KHÔNG GIAN NGHIÊN CỨU</p>
          <h1>Tiến trình nghiên cứu</h1>
          <p>{research.data?.request?.topic || 'Theo dõi kết quả từ máy chủ'}</p>
        </div>
        <div className="knowledge-actions">
          <Button variant="secondary" onClick={refresh}>
            <RefreshCw size={16} />
            Làm mới
          </Button>
          <Button variant="secondary" to={`/research/${encodeURIComponent(requestId)}/chat`}>
            <MessageSquareText size={16} />
            Hỏi AI về nghiên cứu
          </Button>
        </div>
      </div>
      <div className="os-run-meta">
        <span>
          Mã yêu cầu <code>{requestId}</code> · Mã lượt chạy <code>{runId}</code>
        </span>
        {run && <StatusBadge status={run.status} />}
      </div>
      <ErrorMessage error={progress.error || research.error || error} />
      {progress.loading && (
        <p role="status" className="os-panel">
          Đang tải tiến trình nghiên cứu…
        </p>
      )}
      {progress.paused && (
        <p className="os-notice">
          Đã tạm dừng theo dõi tự động. Nhấn Làm mới để tiếp tục; lượt nghiên cứu vẫn được xử lý
          trên máy chủ.
        </p>
      )}
      {run && (
        <RunProgress progress={run} disabled={busy || !!progress.error} onAction={handleAction} />
      )}
      <div className="os-run-columns">
        <section className="os-panel os-results">
          <div className="os-tabs" role="group" aria-label="Kết quả nghiên cứu">
            {tabs.map(([key, label]) => (
              <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'sources' && <RunSources result={sources} />}
          {tab === 'evidence' && <RunEvidence result={evidence} sources={sources.data} />}
          {tab === 'report' && (
            <RunReport
              result={reports}
              evidence={evidence.data}
              sources={sources.data}
              busy={busy}
              onExport={handleAction}
            />
          )}
        </section>
        <aside className="os-panel os-events">
          <h2>Hoạt động của lượt nghiên cứu</h2>
          <p className="os-muted">Các sự kiện gần nhất từ máy chủ</p>
          {run?.recentEvents?.length ? (
            <ol>
              {run.recentEvents.map((e) => (
                <li key={e.id}>
                  <strong>{stageLabel(e.stage) || statusLabel(e.type)}</strong>
                  <p>{e.message || e.event_type}</p>
                  <small>
                    {e.created_at ? new Date(e.created_at).toLocaleString('vi-VN') : ''}
                  </small>
                </li>
              ))}
            </ol>
          ) : (
            <p className="os-empty">
              {progress.loading ? 'Đang tải hoạt động…' : 'Chưa có sự kiện.'}
            </p>
          )}
          <section className="os-gaps">
            <h3>Độ phủ hiện tại</h3>
            {evidence.error ? (
              <ErrorMessage error={evidence.error} />
            ) : (
              <>
                <p>{coverageLabel(evidence.data?.coverage_status) || 'Chưa đánh giá'}</p>
                {evidence.data?.gaps?.map((gap, i) => (
                  <p key={i}>{describeResearchValue(gap)}</p>
                ))}
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
