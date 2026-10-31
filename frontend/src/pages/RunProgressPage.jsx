import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import useRunProgress from '../hooks/useRunProgress';
import { api, resourcePath, terminal } from '../services/runApi';
import { API_BASE_URL } from '../config/api';
const stages = ['planning', 'collecting', 'analyzing', 'evaluating', 'composing', 'verifying'];
const names = [
  'Lập kế hoạch',
  'Thu thập nguồn',
  'Phân tích',
  'Đánh giá độ phủ',
  'Soạn báo cáo',
  'Kiểm tra trích dẫn',
];
export default function RunProgressPage() {
  const { requestId, runId } = useParams();
  const { data, error, reconnect } = useRunProgress(requestId, runId);
  const [tab, setTab] = useState('sources'),
    [sources, setSources] = useState([]),
    [analysis, setAnalysis] = useState(null),
    [reports, setReports] = useState([]),
    [resourceError, setResourceError] = useState(''),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      ['sources', 'evidence', 'reports'].map((type) =>
        api(resourcePath(runId, type), { signal: controller.signal }),
      ),
    )
      .then(([s, a, r]) => {
        if (!controller.signal.aborted) {
          setSources(s);
          setAnalysis(a);
          setReports(r);
          setResourceError('');
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setResourceError(e.message);
      });
    return () => controller.abort();
  }, [runId, data?.sourceCount, data?.evidenceCount, data?.status, data?.currentStage, revision]);
  async function action(name) {
    setBusy(true);
    try {
      await api(resourcePath(runId, name), { body: {}, key: crypto.randomUUID() });
      reconnect();
    } catch (e) {
      setResourceError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flow-v2">
      <header className="flow-heading">
        <div>
          <Link to="/">← Nghiên cứu</Link>
          <h1>Tiến trình nghiên cứu</h1>
          <small>{runId}</small>
        </div>
        <div className="flow-actions">
          {['failed', 'partial'].includes(data?.status) && (
            <button disabled={busy} onClick={() => action('retry')}>
              Retry
            </button>
          )}
          {data && !terminal.includes(data.status) && (
            <button disabled={busy} onClick={() => action('cancel')}>
              Cancel
            </button>
          )}
        </div>
      </header>
      {error && (
        <p role="alert">
          {error} <button onClick={reconnect}>Kết nối lại</button>
        </p>
      )}
      {!data && !error && <p role="status">Đang tải tiến trình…</p>}
      {data && (
        <section className="flow-panel">
          <div className="flow-heading">
            <h2>
              {data.status} · {data.currentStage}
            </h2>
            <span>
              Vòng {data.currentRound + 1} · {data.percent}%
            </span>
          </div>
          <progress aria-label="Tiến độ nghiên cứu" max="100" value={data.percent} />
          <ol className="flow-stages">
            {stages.map((stage, i) => (
              <li
                key={stage}
                aria-current={stage === data.currentStage ? 'step' : undefined}
                className={data.completedStages.includes(stage) ? 'done' : ''}
              >
                {i + 1}. {names[i]}
              </li>
            ))}
            <li className={data.status === 'completed' ? 'done' : ''}>7. Hoàn thành</li>
          </ol>
          <p role="status">{data.recentEvents[0]?.message}</p>
          <p>
            {data.sourceCount} nguồn · {data.evidenceCount} bằng chứng · {data.answeredQuestions}{' '}
            câu hỏi có bằng chứng
          </p>
          {data.lastError && (
            <p role="alert">
              {data.lastError.code}: {data.lastError.message}
            </p>
          )}
          <details>
            <summary>Nhật ký hoạt động</summary>
            {data.recentEvents.map((e) => (
              <p key={e.id}>
                <small>{e.created_at}</small> {e.message}
              </p>
            ))}
          </details>
        </section>
      )}
      <nav className="flow-tabs" aria-label="Kết quả nghiên cứu">
        {[
          ['sources', 'Nguồn'],
          ['evidence', 'Bằng chứng'],
          ['reports', 'Báo cáo'],
        ].map(([type, label]) => (
          <button key={type} aria-pressed={tab === type} onClick={() => setTab(type)}>
            {label}
          </button>
        ))}
      </nav>
      {resourceError && (
        <p role="alert">
          {resourceError} <button onClick={() => setRevision((v) => v + 1)}>Tải lại kết quả</button>
        </p>
      )}
      {tab === 'sources' && (
        <section className="flow-panel">
          <h2>Nguồn tài liệu ({sources.length})</h2>
          {!sources.length && <p>Chưa thu thập được nguồn.</p>}
          {sources.map((s) => (
            <article className="flow-source" id={`source-${s.id}`} key={s.id}>
              <h3>{s.title}</h3>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.url}
              </a>
              <p>
                {s.provider} · {s.language} · Dịch: {s.translation_status} · {s.collected_at}
              </p>
              <details>
                <summary>Nội dung gốc</summary>
                <p>{s.original_content || 'Không tải được nội dung.'}</p>
              </details>
              <details>
                <summary>Nội dung tiếng Việt</summary>
                <p>{s.display_content_vi || 'Chưa có bản dịch.'}</p>
              </details>
            </article>
          ))}
        </section>
      )}
      {tab === 'evidence' && (
        <section className="flow-panel">
          <h2>Bằng chứng · {analysis?.coverage_status}</h2>
          {!analysis?.evidence?.length && <p>Chưa có bằng chứng đủ điều kiện.</p>}
          {analysis?.evidence?.map((e) => (
            <article key={e.id} className="flow-source">
              <h3>{e.researchQuestion}</h3>
              <p>{e.evidenceText}</p>
              <blockquote>{e.originalQuote}</blockquote>
              <a href={`#source-${e.sourceVersionId}`} onClick={() => setTab('sources')}>
                Xem nguồn {sources.find((s) => s.id === e.sourceVersionId)?.title}
              </a>
              <p>
                Chunk: {e.chunkId} · Relevance: {e.relevanceScore}
              </p>
              <p>{e.reason}</p>
            </article>
          ))}
        </section>
      )}
      {tab === 'reports' && (
        <section className="flow-panel">
          <h2>Báo cáo ({reports.length} phiên bản)</h2>
          {!reports.length && <p>Báo cáo sẽ xuất hiện sau khi phân tích hoàn tất.</p>}
          {reports.map((r, i) => (
            <article className="flow-source" key={r.id}>
              <h3>
                Phiên bản {reports.length - i} · {r.status}
              </h3>
              {r.status === 'partial' && (
                <p role="alert">
                  Báo cáo chưa đủ bằng chứng hoặc có lỗi trích dẫn. Hãy xem giới hạn nghiên cứu.
                </p>
              )}
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p>{children}</p>,
                  a: ({ href, children }) =>
                    href?.startsWith('#source-') ? (
                      <a
                        href={href}
                        onClick={(event) => {
                          event.preventDefault();
                          setTab('sources');
                          setTimeout(
                            () => document.getElementById(href.slice(1))?.scrollIntoView(),
                            0,
                          );
                        }}
                      >
                        {children}
                      </a>
                    ) : (
                      <a href={href} target="_blank" rel="noreferrer">
                        {children}
                      </a>
                    ),
                }}
              >
                {r.content.replace(/\[(\d+)\]/g, (label) => {
                  const ref = r.references.find((item) => item.citationLabel === label);
                  return ref ? `${label}(#source-${ref.sourceVersionId})` : label;
                })}
              </ReactMarkdown>
              <div className="flow-actions">
                {r.references.map((ref) => (
                  <button
                    key={ref.sourceVersionId}
                    onClick={() => {
                      setTab('sources');
                      setTimeout(
                        () =>
                          document
                            .getElementById(`source-${ref.sourceVersionId}`)
                            ?.scrollIntoView(),
                        0,
                      );
                    }}
                  >
                    {ref.citationLabel} {ref.title}
                  </button>
                ))}
              </div>
              <p className="flow-actions">
                {['docx', 'pdf'].map((f) => (
                  <a key={f} href={`${API_BASE_URL}/api/research/reports/${r.id}/export/${f}`}>
                    Export {f.toUpperCase()}
                  </a>
                ))}
              </p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
