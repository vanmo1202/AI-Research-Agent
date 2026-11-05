import '../styles/research-workspace.css';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Download, FileBarChart, FileText, File, LockKeyhole, BookOpen, CheckCircle2, Layers3, ArrowUpRight, RefreshCw, ShieldCheck } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import ResearchStepper from '../components/research/ResearchStepper';
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
  const [editMode, setEditMode] = useState(false);
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
  const evidenceCount = analysis?.evidence?.length || 0;
  const referenceCount = report?.references?.length || 0;
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const generated = await generateReport(requestId, config);
      setReport(generated);
      setEditMode(false);
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
    <div className="page-enter insight-page">
      <div className="breadcrumb">
        <Link to={`/workflow-3/${requestId}`}>Phân tích bằng chứng</Link>
        <ChevronRight size={13} />
        <strong>Tạo báo cáo</strong>
      </div>
      <div className="page-intro insight-hero insight-report-hero">
        <div>
          <p className="eyebrow">BƯỚC 4 · TỔNG HỢP TRI THỨC</p>
          <h1>Tạo báo cáo nghiên cứu</h1>
          <p>Tổng hợp bằng chứng đã xác thực thành tài liệu có cấu trúc, trích dẫn và bản xuất Word/PDF.</p>
          <div className="insight-hero-links"><Link to={`/workflow-3/${requestId}`}><BookOpen size={15} /> Kiểm tra bằng chứng</Link>{report && <span><CheckCircle2 size={15} /> Báo cáo đã lưu</span>}</div>
        </div>
        <Badge tone={report ? 'teal' : 'violet'}>{report ? 'Đã hoàn thành' : 'Sẵn sàng'}</Badge>
      </div>
      <section className="insight-metrics insight-report-metrics" aria-label="Tổng quan báo cáo">
        <div className="insight-stat"><span className="insight-stat-icon indigo"><Layers3 size={20} /></span><div><span>Bằng chứng đầu vào</span><strong>{evidenceCount}</strong><small>Đoạn trích từ phân tích</small></div></div>
        <div className="insight-stat"><span className="insight-stat-icon mint"><BookOpen size={20} /></span><div><span>Tài liệu tham khảo</span><strong>{referenceCount}</strong><small>{report ? 'Đã đưa vào báo cáo' : 'Sẽ hiển thị khi tạo xong'}</small></div></div>
        <div className="insight-stat"><span className="insight-stat-icon sky"><FileText size={20} /></span><div><span>Định dạng xuất</span><strong>2</strong><small>Word (.docx) và PDF (.pdf)</small></div></div>
      </section>
      <ErrorMessage error={error} />
      <ResearchStepper status={request.status} />
      <div className="content-with-panel">
        <div className="main-column">
          {report && !editMode ? (
            <>
              <Card className="report-card">
                <div className="insight-report-kicker"><FileBarChart size={17} /><span>BÁO CÁO ĐÃ HOÀN THÀNH</span><Badge tone="teal">Sẵn sàng xuất file</Badge></div>
                <div className="panel-heading report-toolbar">
                  <div className="insight-report-heading"><h2>{report.title}</h2><p>Được tạo từ bằng chứng nghiên cứu và lưu tại backend của bạn.</p></div>
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
                <div className="insight-report-secondary-actions"><Button variant="secondary" onClick={() => { setEditMode(true); setConfig({ title: report.title || config.title, outputLength: report.outputLength || config.outputLength, style: report.style || config.style, language: "vi" }); }}> <RefreshCw size={15} /> Tạo lại báo cáo</Button><Link to={`/workflow-3/${requestId}`}>Xem bằng chứng <ArrowUpRight size={15} /></Link></div>
                <ErrorMessage error={exportError} />
                {exporting && (
                  <p role="status">Đang tạo file {exporting === 'docx' ? 'Word' : 'PDF'}...</p>
                )}
                <article className="report-document insight-report-paper" aria-label="Nội dung báo cáo">
                  <Suspense fallback={<p>Đang hiển thị báo cáo...</p>}>
                    <ReportMarkdown>{content}</ReportMarkdown>
                  </Suspense>
                </article>
              </Card>
              <Card className="report-references-card">
                <div className="insight-section-heading"><div><p className="eyebrow">DANH MỤC NGUỒN</p><h2>Tài liệu tham khảo</h2><p>Các nguồn được báo cáo trích dẫn, có thể mở để đối chiếu.</p></div><Badge>{referenceCount} nguồn</Badge></div>
                <ol className="report-references">
                  {(report.references || []).map((ref) => (
                    <li key={ref.citationLabel}>
                      <strong>{ref.citationLabel}</strong><span className="insight-reference-detail">{ref.title || "Nguồn tài liệu"}
                      {safeExternalUrl(ref.url) ? (
                        <a href={ref.url} target="_blank" rel="noopener noreferrer">
                          {ref.url}
                        </a>
                      ) : (
                        <span>{ref.url}</span>
                      )}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            </>
          ) : (
            <Card className="insight-config-card">
              <div className="insight-config-heading"><div className="insight-config-mark"><FileBarChart size={23} /></div><div><p className="eyebrow">THIẾT LẬP ĐẦU RA</p><h2>Cấu hình báo cáo</h2><p>Chọn cách trình bày trước khi AI tổng hợp nội dung từ bằng chứng đã có.</p></div></div>
              {editMode && <div className="insight-edit-note"><ShieldCheck size={17} /> Báo cáo hiện tại chỉ bị thay thế sau khi bạn tạo lại thành công. <Button variant="ghost" onClick={() => setEditMode(false)}>Hủy chỉnh sửa</Button></div>}
              <form className="insight-report-form" onSubmit={submit}>
                <div className="form-grid insight-form-grid">
                  <label>
                    Tiêu đề báo cáo
                    <input
                      required
                      maxLength={160}
                      placeholder="Nhập tiêu đề báo cáo..."
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
                <div className="insight-form-footer"><div><strong>Trước khi tạo báo cáo</strong><p>Kiểm tra rằng các nguồn và bằng chứng đã được đối chiếu. Báo cáo sử dụng tiếng Việt.</p></div><Button type="submit" disabled={!ready || evidenceCount === 0} loading={busy}><FileBarChart size={17} /> {editMode ? "Tạo lại báo cáo" : "Tạo báo cáo nghiên cứu"}</Button></div>
                {(!ready || evidenceCount === 0) && (
                  <p className="field-hint insight-form-warning">
                    <LockKeyhole size={14} />
                    {ready ? "Chưa có bằng chứng phù hợp để tạo báo cáo. Hãy quay lại bước phân tích." : "Cần hoàn thành bước Phân tích bằng chứng & RAG trước."}
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
            evidenceCount={evidenceCount}
          />
          <Card className="insight-side-note">
            <div className="insight-side-note-icon"><ShieldCheck size={19} /></div>
            <h3>Kiểm soát chất lượng</h3>
            <p>Báo cáo được tổng hợp từ bằng chứng đã lưu. Hãy mở nguồn gốc và rà soát trích dẫn trước khi sử dụng.</p>
            <Link to={`/workflow-3/${requestId}`}>Xem lại bằng chứng <ArrowUpRight size={15} /></Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
