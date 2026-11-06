import { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  BrainCircuit,
  Check,
  FileBarChart2,
  Files,
  House,
  Link2,
  MessageSquareText,
  SearchCheck,
  Settings,
  X,
} from 'lucide-react';
import { getResearch, getEvidence } from '../../services/researchApi';
import { researchJourney } from '../../utils/researchJourney';
import useResearchHistory from '../../hooks/useResearchHistory';
import { getLastRequestId, rememberResearch } from '../../utils/researchStorage';

export default function Sidebar({ open, onClose }) {
  const panel = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() =>
      panel.current?.querySelector('.mobile-close')?.focus(),
    );
    const focusTimer = setTimeout(() => {
      if (panel.current && !panel.current.contains(document.activeElement))
        panel.current.querySelector('.mobile-close')?.focus({ preventScroll: true });
    }, 220);
    const trap = (event) => {
      if (event.key !== 'Tab') return;
      const items = [...panel.current.querySelectorAll('a[href],button:not([disabled])')].filter(
        (el) => el.getClientRects().length,
      );
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const media = window.matchMedia('(min-width: 901px)');
    const resize = () => {
      if (media.matches) onClose();
    };
    media.addEventListener('change', resize);
    document.addEventListener('keydown', trap);
    return () => {
      cancelAnimationFrame(focusFrame);
      clearTimeout(focusTimer);
      media.removeEventListener('change', resize);
      document.removeEventListener('keydown', trap);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [open, onClose]);
  const { pathname } = useLocation();
  const history = useResearchHistory();
  const [backend, setBackend] = useState(null);
  const routeId = pathname.match(/^\/(?:research|workflow-[234])\/([^/]+)/)?.[1];
  const id = routeId || getLastRequestId();
  const remembered = history.find((item) => item.requestId === id);
  useEffect(() => {
    if (!id) {
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
        if (controller.signal.aborted) return;
        rememberResearch(data.request, { ...data, analysis });
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
  }, [id, pathname, remembered?.status]);
  const journey = researchJourney({
    ...(backend?.id === id ? backend : { status: remembered?.status }),
    stage: pathname.startsWith('/workflow-4') ? 4 : pathname.startsWith('/workflow-3') ? 3 : 2,
  });
  const groups = [
    {
      label: 'TỔNG QUAN',
      items: [{ to: '/', label: 'Tổng quan', icon: House, active: pathname === '/' }],
    },
    {
      label: 'NGHIÊN CỨU',
      items: [
        {
          to: '/workflow-1',
          label: 'Quy trình nghiên cứu',
          icon: SearchCheck,
          active:
            pathname === '/workflow-1' ||
            (pathname.startsWith('/research/') && !pathname.includes('/chat')) ||
            pathname.startsWith('/workflow-2'),
        },
        {
          to: id ? `/workflow-3/${encodeURIComponent(id)}` : '/workflow-3',
          label: 'Bằng chứng',
          icon: BookOpen,
          step: 1,
          active: pathname.startsWith('/workflow-3'),
        },
        {
          to: id ? `/workflow-4/${encodeURIComponent(id)}` : '/workflow-4',
          label: 'Báo cáo',
          icon: FileBarChart2,
          step: 2,
          active: pathname.startsWith('/workflow-4'),
        },
      ],
    },
    {
      label: 'TRI THỨC',
      items: [
        {
          to: '/documents',
          label: 'Tài liệu (PDF)',
          icon: Files,
          active: pathname.startsWith('/documents'),
        },
        {
          to: id ? `/research/${encodeURIComponent(id)}/chat` : '/chat',
          label: 'Trò chuyện AI',
          icon: MessageSquareText,
          active: pathname === '/chat' || pathname.includes('/chat'),
        },
        {
          to: '/memories',
          label: 'Bộ nhớ AI',
          icon: BrainCircuit,
          active: pathname === '/memories',
        },
      ],
    },
    {
      label: 'PHÒNG NGHIÊN CỨU',
      items: [
        {
          to: '/sources',
          label: 'Nguồn tài liệu',
          icon: Link2,
          active: pathname === '/sources' || pathname.startsWith('/sources/'),
        },
      ],
    },
    {
      label: 'CẤU HÌNH',
      items: [
        { to: '/settings', label: 'Cài đặt', icon: Settings, active: pathname === '/settings' },
      ],
    },
  ];
  return (
    <>
      {open && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Đóng menu điều hướng"
          onClick={onClose}
        />
      )}
      <aside
        ref={panel}
        id="studio-navigation"
        className={`sidebar ${open ? 'sidebar-open' : ''}`}
        aria-label="Điều hướng chính"
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
      >
        <Link className="brand ro-brand" to="/" onClick={onClose}>
          <span className="brand-mark">
            <BookOpen size={25} />
          </span>
          <span className="brand-copy">
            <strong>
              Research<span>OS</span>
            </strong>
            <small>Không gian nghiên cứu</small>
          </span>
        </Link>
        <button
          type="button"
          className="icon-button mobile-close"
          aria-label="Đóng menu"
          onClick={onClose}
        >
          <X size={21} />
        </button>
        <nav className="sidebar-nav ro-sidebar-nav" aria-label="Điều hướng workspace">
          {groups.map((group) => (
            <div className="ro-nav-group" key={group.label}>
              <p className="ro-nav-caption">{group.label}</p>
              {group.items.map(({ icon: Icon, step, ...item }) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`nav-item ${item.active ? 'active' : ''}`}
                  onClick={onClose}
                  aria-current={item.active ? 'page' : undefined}
                  aria-label={item.label === 'Agent Memory' ? 'Bộ nhớ AI' : item.label}
                >
                  <Icon size={18} strokeWidth={1.9} />
                  <span className="nav-label">
                    <strong>{item.label}</strong>
                  </span>
                  {step !== undefined && journey.workflowSteps?.[step]?.state === 'complete' && (
                    <Check className="nav-step-complete" size={14} />
                  )}
                  {step !== undefined && journey.workflowSteps?.[step]?.state === 'partial' && (
                    <AlertTriangle className="nav-step-partial" size={14} />
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="ro-sidebar-foot">
          <span className="ro-status-dot" /> Không gian cho tri thức{' '}
          <span className="ro-sidebar-version">↗</span>
        </div>
      </aside>
    </>
  );
}
