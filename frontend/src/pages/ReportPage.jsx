import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Download, FileBarChart, FileText, File, LockKeyhole } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ErrorMessage from '../components/ui/ErrorMessage';
import PageState from '../components/ui/PageState';
import WorkflowProgress from '../components/research/WorkflowProgress';
import {
  generateReport,
  getReport,
  getResearch,
  getEvidence,
  exportReportDocx,
  exportReportPdf,
} from '../services/researchApi';
import { rememberResearch } from '../utils/researchStorage';
import { safeExternalUrl } from '../utils/format';

const ReportMarkdown = lazy(() => import('../components/research/ReportMarkdown'));

export default function ReportPage() {
  const { requestId } = useParams();
  const [request, setRequest] = useState(null);
  const [report, setReport] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const menuButton = useRef(null);
  const [config, setConfig] = useState({
    title: 'Báo cáo nghiên cứu',
    outputLength: 'medium',
    language: 'vi',
    style: 'academic',
  });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      getResearch(requestId, controller.signal),
      getReport(requestId, controller.signal).catch((err) => {
        if (err.status === 404) return null;
        throw err;
      }),
      getEvidence(requestId, controller.signal),
    ])
      .then(([data, saved, evidence]) => {
        if (!controller.signal.aborted) {
          setRequest(data.request);
          setReport(saved);
          setAnalysis(evidence);
          rememberResearch(data.request, data);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [requestId]);
  useEffect(() => {
    if (!menu) return;
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenu(false);
    };
    document.addEventListener('pointerdown', close);
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);
  if (loading) return <PageState loading />;
  if (!request) return <ErrorMessage error={error || 'Không tìm thấy nghiên cứu.'} />;
  const ready = ['analyzed', 'analyzed_partial', 'completed'].includes(request.status);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const generated = await generateReport(requestId, config);
      setReport(generated);
      setRequest((value) => ({ ...value, status: 'completed' }));
      rememberResearch({ ...request, status: 'completed' });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  async function download(format) {
    setMenu(false);
    setExporting(format);
    setExportError(null);
    try {
      await (format === 'docx' ? exportReportDocx : exportReportPdf)(requestId);
    } catch (err) {
      setExportError(err);
    } finally {
      setExporting(null);
      menuButton.current?.focus();
    }
  }
  function menuKeys(event) {
    if (!menu && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      setMenu(true);
      return;
    }
    const items = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
    const current = items.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenu(false);
      menuButton.current?.focus();
    }
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      items[
        (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      ]?.focus();
    }
  }
  const content =
    report && !report.content.includes('\n') && report.content.includes('\\n##')
      ? report.content.replace(/\\n/g, '\n')
      : report?.content;
  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <Link to={`/workflow-3/${requestId}`}>Phân tích bằng chứng</Link>
        <ChevronRight size={13} />
        <strong>Tạo báo cáo</strong>
      </div>
      <div className="page-intro">
        <div>
          <p className="eyebrow">BƯỚC 4 · TỔNG HỢP TRI THỨC</p>
          <h1>Tạo báo cáo nghiên cứu</h1>
          <p>Tổng hợp bằng chứng thành báo cáo học thuật và tải xuống Word hoặc PDF.</p>
        </div>
        <Badge tone={report ? 'teal' : 'violet'}>{report ? 'Đã hoàn thành' : 'Sẵn sàng'}</Badge>
      </div>
      <ErrorMessage error={error} />
      <div className="content-with-panel">
        <div className="main-column">
          {report ? (
            <>
              <Card className="report-card">
                <div className="panel-heading report-toolbar">
                  <h2>{report.title}</h2>
                  <div className="export-menu" ref={menuRef} onKeyDown={menuKeys}>
                    <button
                      ref={menuButton}
                      type="button"
                      className="button button-primary"
                      aria-haspopup="menu"
                      aria-controls="report-export-menu"
                      aria-expanded={menu}
                      disabled={Boolean(exporting)}
                      onClick={() => setMenu((value) => !value)}
                    >
                      <Download size={17} />
                      {exporting
                        ? `Đang tạo file ${exporting === 'docx' ? 'Word' : 'PDF'}...`
                        : 'Xuất báo cáo'}
                    </button>
                    {menu && (
                      <div id="report-export-menu" role="menu" aria-label="Định dạng xuất báo cáo">
                        <button type="button" role="menuitem" onClick={() => download('docx')}>
                          <FileText size={17} />
                          Xuất Word (.docx)
                        </button>
                        <button type="button" role="menuitem" onClick={() => download('pdf')}>
                          <File size={17} />
                          Xuất PDF (.pdf)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <ErrorMessage error={exportError} />
                {exporting && (
                  <p role="status">Đang tạo file {exporting === 'docx' ? 'Word' : 'PDF'}...</p>
                )}
                <article className="report-document" aria-label="Nội dung báo cáo">
                  <Suspense fallback={<p>Đang hiển thị báo cáo...</p>}>
                    <ReportMarkdown>{content}</ReportMarkdown>
                  </Suspense>
                </article>
              </Card>
              <Card className="report-references-card">
                <h2>Tài liệu tham khảo</h2>
                <ol className="report-references">
                  {(report.references || []).map((ref) => (
                    <li key={ref.citationLabel}>
                      <strong>{ref.citationLabel}</strong> {ref.title} —{' '}
                      {safeExternalUrl(ref.url) ? (
                        <a href={ref.url} target="_blank" rel="noopener noreferrer">
                          {ref.url}
                        </a>
                      ) : (
                        <span>{ref.url}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </Card>
            </>
          ) : (
            <Card>
              <div className="panel-heading">
                <h2>
                  <FileBarChart size={20} />
                  Cấu hình báo cáo
                </h2>
              </div>
              <form onSubmit={submit}>
                <div className="form-grid">
                  <label>
                    Tiêu đề báo cáo
                    <input
                      value={config.title}
                      onChange={(e) => setConfig({ ...config, title: e.target.value })}
                    />
                  </label>
                  <label>
                    Độ dài báo cáo
                    <select
                      value={config.outputLength}
                      onChange={(e) => setConfig({ ...config, outputLength: e.target.value })}
                    >
                      <option value="short">Ngắn</option>
                      <option value="medium">Trung bình</option>
                      <option value="long">Chi tiết</option>
                    </select>
                  </label>
                  <label>
                    Ngôn ngữ
                    <select value="vi" disabled>
                      <option value="vi">Tiếng Việt</option>
                    </select>
                  </label>
                  <label>
                    Phong cách trình bày
                    <select
                      value={config.style}
                      onChange={(e) => setConfig({ ...config, style: e.target.value })}
                    >
                      <option value="academic">Học thuật</option>
                      <option value="professional">Chuyên nghiệp</option>
                      <option value="summary">Tóm tắt</option>
                    </select>
                  </label>
                </div>
                <Button type="submit" disabled={!ready} loading={busy}>
                  Tạo báo cáo nghiên cứu
                </Button>
                {!ready && (
                  <p className="field-hint">
                    <LockKeyhole size={14} />
                    Cần hoàn thành bước Phân tích bằng chứng & RAG trước.
                  </p>
                )}
              </form>
            </Card>
          )}
        </div>
        <aside className="right-panel">
          <WorkflowProgress
            stage={4}
            status={busy ? 'generating_report' : request.status}
            planned
            collected={ready}
            reportExists={Boolean(report)}
            analysisStatus={analysis?.status}
            evidenceCount={analysis?.evidence?.length || 0}
          />
        </aside>
      </div>
    </div>
  );
}
