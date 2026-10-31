import { useEffect, useState } from 'react';
import { getResearch, getEvidence } from '../../services/researchApi';
import { researchJourney } from '../../utils/researchJourney';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  Check,
  AlertTriangle,
  BrainCircuit,
  Database,
  FileText,
  House,
  Lightbulb,
  Link2,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import useResearchHistory from '../../hooks/useResearchHistory';
import { getLastRequestId, rememberResearch } from '../../utils/researchStorage';

export default function Sidebar({ open, onClose }) {
  const { pathname } = useLocation();
  const history = useResearchHistory();
  const isRunPage = pathname.includes('/runs/') || pathname === '/research/new';
  const [backend, setBackend] = useState(null);
  const routeId = pathname.match(/^\/(?:research|workflow-[234])\/([^/]+)/)?.[1];
  const id = routeId || getLastRequestId();
  const remembered = history.find((item) => item.requestId === id);
  useEffect(() => {
    if (!id || isRunPage) {
      setBackend(null);
      return;
    }
    const controller = new AbortController();
    getResearch(id, controller.signal)
      .then(async (data) => {
        let analysis;
        if (
          [
            'analyzing',
            'analyzed',
            'analyzed_partial',
            'generating_report',
            'completed',
            'failed',
          ].includes(data.request.status)
        ) {
          analysis = await getEvidence(id, controller.signal).catch(() => null);
        }
        if (!controller.signal.aborted) rememberResearch(data.request, { ...data, analysis });
        if (!controller.signal.aborted)
          setBackend({
            id,
            status: data.request.status,
            planned: data.researchQuestions.length > 0,
            analysisStatus: analysis?.status,
            evidenceCount: analysis?.evidence?.length || 0,
          });
      })
      .catch(() => {
        if (!controller.signal.aborted) setBackend(null);
      });
    return () => controller.abort();
  }, [id, pathname, remembered?.status, isRunPage]);
  const journey = researchJourney({
    ...(backend?.id === id ? backend : { status: remembered?.status }),
    stage: pathname.startsWith('/workflow-4') ? 4 : pathname.startsWith('/workflow-3') ? 3 : 2,
  });
  const sourcesActive = pathname.endsWith('/sources');
  const items = [
    { to: '/', label: 'Tổng quan', icon: House, active: pathname === '/' },
    {
      to: '/research/new',
      label: 'Nghiên cứu tự động',
      icon: Sparkles,
      active: pathname === '/research/new' || pathname.includes('/runs/'),
    },
    {
      to: '/workflow-1',
      label: 'Lập kế hoạch nghiên cứu',
      icon: FileText,
      active:
        pathname === '/workflow-1' ||
        (pathname.startsWith('/research/') && !sourcesActive && !isRunPage),
    },
    {
      to: id ? `/workflow-2/${id}` : '/workflow-2',
      label: 'Tìm kiếm & Thu thập',
      icon: Database,
      active: pathname.startsWith('/workflow-2') || sourcesActive,
    },
    {
      to: id ? `/workflow-3/${id}` : '/workflow-3',
      label: 'Phân tích bằng chứng',
      journeyStep: 2,
      detail: id && !isRunPage ? journey.steps[2].label : undefined,
      icon: BrainCircuit,
      active: pathname.startsWith('/workflow-3'),
    },
    {
      to: id ? `/workflow-4/${id}` : '/workflow-4',
      label: 'Tạo báo cáo',
      journeyStep: 3,
      detail: id && !isRunPage ? journey.steps[3].label : undefined,
      icon: FileText,
      active: pathname.startsWith('/workflow-4'),
    },
    { to: '/sources', label: 'Nguồn tài liệu', icon: Link2, active: pathname === '/sources' },
    { to: '/settings', label: 'Cài đặt', icon: Settings, active: pathname === '/settings' },
  ];
  return (
    <>
      {open && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Đóng menu điều hướng"
          onClick={onClose}
        />
      )}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`} aria-label="Điều hướng chính">
        <div className="brand">
          <div className="brand-mark">
            <BrainCircuit size={26} />
          </div>
          <div className="brand-copy">
            <strong>
              AI Research <span>Agent</span>
            </strong>
            <small>Trợ lý nghiên cứu thông minh</small>
          </div>
          <button
            type="button"
            className="icon-button mobile-close"
            aria-label="Đóng menu"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="nav-caption">KHÔNG GIAN NGHIÊN CỨU</div>
        <nav className="sidebar-nav">
          {items.map(({ icon: Icon, journeyStep, ...item }) => (
            <Link
              key={item.label}
              to={item.to}
              className={`nav-item ${item.active ? 'active' : ''}`}
              aria-label={item.label}
              aria-current={item.active ? 'page' : undefined}
              onClick={onClose}
            >
              <Icon size={20} strokeWidth={1.8} />
              <span className="nav-label">
                <strong>{item.label}</strong>
                {item.detail && <small>{item.detail}</small>}
              </span>
              {!isRunPage &&
                journeyStep !== undefined &&
                journey.steps[journeyStep].state === 'complete' && (
                  <Check size={15} className="nav-step-complete" />
                )}
              {!isRunPage &&
                journeyStep !== undefined &&
                journey.steps[journeyStep].state === 'partial' && (
                  <AlertTriangle size={15} className="nav-step-partial" />
                )}
              {item.active && <span className="nav-active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="idea-card">
            <div className="idea-icon">
              <Lightbulb size={25} />
              <Sparkles size={15} />
            </div>
            <h2>
              Biến ý tưởng
              <br />
              thành tri thức giá trị
            </h2>
            <p>AI đồng hành cùng hành trình nghiên cứu của bạn.</p>
            <NavLink to="/workflow-1" onClick={onClose}>
              Bắt đầu khám phá <ArrowUpRight size={15} />
            </NavLink>
            <span className="idea-orbit" />
          </div>
          <div className="sidebar-foot">
            <span className="tiny-mark">
              <Sparkles size={13} />
            </span>
            <span>Không gian nghiên cứu của bạn</span>
          </div>
        </div>
      </aside>
    </>
  );
}
