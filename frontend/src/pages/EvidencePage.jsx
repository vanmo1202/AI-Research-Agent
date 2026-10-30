import { sourceDisplay } from '../utils/sourceDisplay';
import { researchJourney } from '../utils/researchJourney';
import { Link, useParams } from 'react-router-dom';
import { BrainCircuit, ChevronRight, ExternalLink, FileText, Sparkles } from 'lucide-react';
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
  const [error, setError] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setAnalysis(null);
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
    <div className="page-enter">
      <div className="breadcrumb">
        <Link to={`/workflow-2/${requestId}`}>Thu thập tài liệu</Link>
        <ChevronRight size={13} />
        <strong>Phân tích bằng chứng</strong>
      </div>
      <div className="page-intro">
        <div>
          <p className="eyebrow">BƯỚC 3 · CHUẨN BỊ NGỮ CẢNH</p>
          <h1>Phân tích bằng chứng & RAG</h1>
          <p>Xác định bằng chứng từ các nguồn đã thu thập để chuẩn bị báo cáo nghiên cứu.</p>
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
              <div className="panel-heading">
                <h2>Bằng chứng theo câu hỏi nghiên cứu</h2>
                <Badge>{evidence.length} bằng chứng</Badge>
              </div>
              {evidence.map((item) => {
                const source = sources.find((s) => s.id === item.sourceId);
                const href = safeExternalUrl(source?.url);
                const score = Number(item.relevanceScore || 0);
                return (
                  <Card key={item.id} className="evidence-card" as="article">
                    <Badge tone={score >= 0.75 ? 'teal' : score >= 0.5 ? 'blue' : 'neutral'}>
                      {score >= 0.75 ? 'Rất liên quan' : score >= 0.5 ? 'Liên quan' : 'Trung bình'}{' '}
                      · {score.toFixed(4)}
                    </Badge>
                    <h3>{item.researchQuestion}</h3>
                    <p className="evidence-text">{item.evidenceText}</p>
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
            <Card>
              <h2>Phân tích bằng chứng</h2>
              <p className="muted">
                {busy || status === 'analyzing'
                  ? 'Đang phân tích các câu hỏi nghiên cứu...'
                  : 'Chưa có bằng chứng tiếng Việt để hiển thị.'}
              </p>
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
          <Card className="metric-card">
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
