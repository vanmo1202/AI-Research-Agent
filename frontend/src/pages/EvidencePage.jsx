import '../styles/research-workspace.css';
import { sourceDisplay } from '../utils/sourceDisplay';
import { researchJourney } from '../utils/researchJourney';
import { Link, useParams } from 'react-router-dom';
import { BrainCircuit, ChevronRight, ExternalLink, FileText, Sparkles, Search, BookOpen, Layers3, Target, ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Alert from '../components/ui/Alert';
import PageState from '../components/ui/PageState';
import ErrorMessage from '../components/ui/ErrorMessage';
import WorkflowProgress from '../components/research/WorkflowProgress';
import useResearch from '../hooks/useResearch';
import { analyzeEvidence, getEvidence } from '../services/researchApi';
import { providerLabel, safeExternalUrl } from '../utils/format';

export default function EvidencePage() {
  const { requestId } = useParams();
  const resource = useResearch(requestId, true);
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [relevance, setRelevance] = useState('all');
  const [error, setError] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setAnalysis(null);
    setError(null);
    getEvidence(requestId, controller.signal)
      .then(setAnalysis)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err);
      });
    return () => controller.abort();
  }, [requestId, resource.data?.request?.status]);
  if (resource.loading || resource.error)
    return (
      <PageState loading={resource.loading} error={resource.error} onRetry={resource.reload} />
    );
  const data = resource.data;
  const evidence = analysis?.evidence || [];
  const sources = data.collection?.sources || [];
  const status = busy ? 'analyzing' : data.request.status;
  const journeyProps = {
    status,
    stage: 3,
    planned: data.researchQuestions?.length > 0,
    collected: sources.length > 0,
    analysisStatus: analysis?.status,
    evidenceCount: evidence.length,
  };
  const step = researchJourney(journeyProps).steps[2];
  const partial = !busy && (analysis?.partial || status === 'analyzed_partial');
  const questions = analysis?.questions || [];
  const completeCount = questions.filter((question) => question.status === 'complete').length;
  const incompleteCount = questions.filter((question) => question.status !== 'complete').length;
  const answeredQuestions = questions.length ? completeCount : new Set(evidence.map((item) => item.researchQuestion).filter(Boolean)).size;
  const questionTotal = questions.length || data.researchQuestions?.length || 0;
  const citedSources = new Set(evidence.map((item) => item.sourceId).filter(Boolean)).size;
  const averageRelevance = evidence.length
    ? Math.round(evidence.reduce((sum, item) => sum + (Number(item.relevanceScore) || 0), 0) / evidence.length * 100)
    : null;
  const filteredEvidence = evidence.filter((item) => {
    const score = Number(item.relevanceScore) || 0;
    if (relevance === 'high' && score < 0.75) return false;
    if (relevance === 'medium' && (score < 0.5 || score >= 0.75)) return false;
    if (relevance === 'low' && score >= 0.5) return false;
    const source = sources.find((entry) => entry.id === item.sourceId);
    const searchText = [item.researchQuestion, item.evidenceText, sourceDisplay(source).title, item.citationLabel].join(' ').toLocaleLowerCase('vi');
    return searchText.includes(query.trim().toLocaleLowerCase('vi'));
  });
  async function runAnalysis() {
    setBusy(true);
    setError(null);
    try {
      await analyzeEvidence(requestId);
      setAnalysis(await getEvidence(requestId));
      resource.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-enter insight-page">
      <div className="breadcrumb">
        <Link to={`/workflow-2/${requestId}`}>Thu thập tài liệu</Link>
        <ChevronRight size={13} />
        <strong>Phân tích bằng chứng</strong>
      </div>
      <div className="page-intro insight-hero">
        <div>
          <p className="eyebrow">BƯỚC 3 · CHUẨN BỊ NGỮ CẢNH</p>
          <h1>Phân tích bằng chứng</h1>
          <p>Đối chiếu các đoạn trích, mức độ liên quan và nguồn tham khảo trước khi tổng hợp thành báo cáo.</p>
          <div className="insight-hero-links">
            <Link to={`/workflow-2/${requestId}`}><BookOpen size={15} /> Xem nguồn thu thập</Link>
            <Link to={`/workflow-4/${requestId}`}><ArrowUpRight size={15} /> Tạo báo cáo</Link>
          </div>
        </div>
        <Badge
          tone={
            step.state === 'partial'
              ? 'amber'
              : step.state === 'complete'
                ? 'teal'
                : step.state === 'failed'
                  ? 'red'
                  : 'violet'
          }
        >
          {step.label}
        </Badge>
      </div>
      <section className="insight-metrics" aria-label="Thống kê phân tích">
        <div className="insight-stat"><span className="insight-stat-icon indigo"><Layers3 size={20} /></span><div><span>Bằng chứng đã lưu</span><strong>{evidence.length}</strong><small>Đoạn trích đã xác định</small></div></div>
        <div className="insight-stat"><span className="insight-stat-icon mint"><Target size={20} /></span><div><span>Câu hỏi được phân tích</span><strong>{questionTotal ? Math.min(answeredQuestions, questionTotal) : answeredQuestions}{questionTotal ? ' / ' + questionTotal : ''}</strong><small>Theo kết quả phân tích</small></div></div>
        <div className="insight-stat"><span className="insight-stat-icon sky"><BookOpen size={20} /></span><div><span>Nguồn có trích dẫn</span><strong>{citedSources}</strong><small>Trong {sources.length} nguồn thu thập</small></div></div>
        <div className="insight-stat"><span className="insight-stat-icon peach"><BrainCircuit size={20} /></span><div><span>Độ liên quan trung bình</span><strong>{averageRelevance === null ? '—' : averageRelevance + '%'}</strong><small>Dựa trên điểm của bằng chứng</small></div></div>
      </section>
      <ErrorMessage error={error} />
      {partial && (
        <Alert
          title="Phân tích hoàn tất một phần"
          action={
            <Button variant="secondary" onClick={runAnalysis} loading={busy}>
              Thử lại các câu hỏi chưa hoàn tất
            </Button>
          }
        >
          <p>{completeCount} câu hỏi đã được phân tích.</p>
          <p>
            {incompleteCount} câu hỏi chưa thể xử lý do giới hạn Gemini hoặc chưa đủ nội dung tiếng
            Việt.
          </p>
        </Alert>
      )}
      <div className="content-with-panel">
        <div className="main-column">
          {evidence.length > 0 ? (
            <section className="evidence-list" aria-label="Bằng chứng theo câu hỏi nghiên cứu">
              <div className="insight-section-heading">
                <div><p className="eyebrow">THƯ VIỆN BẰNG CHỨNG</p><h2>Bằng chứng theo câu hỏi nghiên cứu</h2><p>Tìm theo câu hỏi, nội dung hoặc tên nguồn; lọc nhanh theo mức độ liên quan.</p></div>
                <Badge>{filteredEvidence.length} / {evidence.length} bằng chứng</Badge>
              </div>
              <div className="insight-toolbar">
                <label className="insight-search"><Search size={18} /><span className="sr-only">Tìm trong bằng chứng</span><input type="search" aria-label="Tìm trong bằng chứng" placeholder="Tìm trong bằng chứng, câu hỏi, nguồn..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
                <div className="insight-filter" role="group" aria-label="Lọc theo độ liên quan"><SlidersHorizontal size={16} aria-hidden="true" />
                  {[['all', 'Tất cả'], ['high', 'Rất liên quan'], ['medium', 'Liên quan'], ['low', 'Trung bình']].map(([value, label]) => (
                    <button key={value} type="button" className={relevance === value ? 'insight-filter-button is-active' : 'insight-filter-button'} aria-pressed={relevance === value} onClick={() => setRelevance(value)}>{label}</button>
                  ))}
                </div>
              </div>
              {filteredEvidence.length === 0 && (
                <Card className="insight-empty"><Search size={25} /><h3>Không có bằng chứng phù hợp</h3><p>Hãy thử từ khóa khác hoặc hiển thị lại tất cả mức độ liên quan.</p><Button variant="secondary" onClick={() => { setQuery(''); setRelevance('all'); }}>Xóa bộ lọc</Button></Card>
              )}
              {filteredEvidence.map((item) => {
                const source = sources.find((s) => s.id === item.sourceId);
                const href = safeExternalUrl(source?.url);
                const score = Number(item.relevanceScore || 0);
                return (
                  <Card key={item.id} className="evidence-card" as="article">
                    <div className="insight-evidence-top"><span className="insight-evidence-index">BẰNG CHỨNG {filteredEvidence.indexOf(item) + 1}</span>
                    <Badge tone={score >= 0.75 ? 'teal' : score >= 0.5 ? 'blue' : 'neutral'}>
                      {score >= 0.75 ? 'Rất liên quan' : score >= 0.5 ? 'Liên quan' : 'Trung bình'}{' '}
                      · {score.toFixed(4)}
                    </Badge></div>
                    <h3>{item.researchQuestion}</h3>
                    <div className="insight-relevance-track" aria-label={"Độ liên quan " + Math.round(score * 100) + "%"}><span style={{ width: Math.max(0, Math.min(100, Math.round(score * 100))) + "%" }} /></div>
                    <blockquote className="evidence-text">{item.evidenceText}</blockquote>
                    {item.reason && (
                      <p className="evidence-reason">
                        <strong>Lý do liên quan:</strong> {item.reason}
                      </p>
                    )}
                    <footer className="evidence-source">
                      <div>
                        <span className="eyebrow">NGUỒN {item.citationLabel}</span>
                        <p>{sourceDisplay(source).title}</p>
                        <small>{providerLabel(source?.provider)}</small>
                      </div>
                      {href && (
                        <a
                          className="button button-secondary"
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Mở nguồn <ExternalLink size={16} />
                        </a>
                      )}
                    </footer>
                  </Card>
                );
              })}
            </section>
          ) : (
            <Card className="insight-empty insight-empty-primary">
              <BrainCircuit size={29} />
              <h2>Chưa có bằng chứng để phân tích</h2>
              <p className="muted">
                {busy || status === 'analyzing'
                  ? 'Đang phân tích các câu hỏi nghiên cứu...'
                  : 'Chưa có bằng chứng tiếng Việt để hiển thị.'}
              </p>
              {!sources.length && <Button variant="secondary" to={`/workflow-2/${requestId}`}>Quay lại thu thập nguồn</Button>}
              {!partial && (
                <Button
                  onClick={runAnalysis}
                  loading={busy}
                  disabled={status === 'analyzing' || !sources.length}
                >
                  <BrainCircuit size={16} />
                  Bắt đầu phân tích bằng chứng
                </Button>
              )}
            </Card>
          )}
          {!partial && !['complete', 'active'].includes(step.state) && evidence.length > 0 && (
            <Button onClick={runAnalysis} loading={busy}>
              Thử lại phân tích bằng chứng
            </Button>
          )}
          {evidence.length > 0 && (
            <Card className="next-step-card">
              <Sparkles size={20} />
              <div>
                <h2>Sẵn sàng tạo báo cáo</h2>
                <p>Bằng chứng đã lưu có thể dùng để tổng hợp báo cáo nghiên cứu.</p>
              </div>
              <Button to={`/workflow-4/${requestId}`}>Tiếp tục tạo báo cáo</Button>
            </Card>
          )}
        </div>
        <aside className="right-panel">
          <WorkflowProgress {...journeyProps} />
          <Card className="metric-card insight-side-metric">
            <FileText size={20} />
            <div>
              <span>Nguồn tài liệu</span>
              <strong>{sources.length}</strong>
              <small>{evidence.length} bằng chứng đã lưu</small>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
