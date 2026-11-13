import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  FolderOpen,
  Layers,
  FileText,
  Workflow,
  BookOpen,
  BrainCircuit,
  Files,
  House,
  MessageSquareText,
  Settings,
  X,
} from 'lucide-react';

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
    const media = window.matchMedia('(min-width: 791px)');
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
  const groups = [
    [{ to: '/', label: 'Trang chủ', icon: House, active: pathname === '/' }],
    [
      {
        to: '/researches',
        label: 'Nghiên cứu chuyên sâu',
        icon: FolderOpen,
        active:
          pathname === '/workflow-1' ||
          (pathname.startsWith('/research/') && !pathname.includes('/chat')),
      },
      {
        to: '/workflows',
        label: 'Workflow (5 luồng)',
        icon: Workflow,
        sub: true,
        active: pathname === '/workflows',
      },
      {
        to: '/researches',
        label: 'Các phiên nghiên cứu',
        icon: Layers,
        sub: true,
        active: pathname === '/researches',
      },
      {
        to: '/reports',
        label: 'Báo cáo',
        icon: FileText,
        sub: true,
        active: pathname === '/reports' || pathname.startsWith('/workflow-4'),
      },
    ],
    [
      { to: '/documents', label: 'Không gian tri thức', icon: BookOpen },
      {
        to: '/documents',
        label: 'Tài liệu (PDF)',
        icon: Files,
        sub: true,
        active: pathname.startsWith('/documents'),
      },
      {
        to: '/chat',
        label: 'AI Research Chat',
        icon: MessageSquareText,
        active: pathname.includes('/chat'),
      },
      {
        to: '/memories',
        label: 'Bộ nhớ (Memory)',
        icon: BrainCircuit,
        sub: true,
        active: pathname.startsWith('/memories'),
      },
    ],
    [
      {
        to: '/automations',
        label: 'Tự động hóa (n8n)',
        icon: Workflow,
        active: pathname.startsWith('/automations') || pathname.startsWith('/schedules'),
      },
      {
        to: '/activity',
        label: 'Thống kê & hoạt động',
        icon: ChartNoAxesCombined,
        active: pathname === '/activity',
      },
    ],
  ];
  const item = ({ icon: Icon, ...it }) => (
    <Link
      key={it.label}
      to={it.to}
      className={`${it.sub ? 'ref-navsub' : 'ref-navitem'} ${it.active ? 'ref-active' : ''}`}
      onClick={onClose}
      aria-current={it.active ? 'page' : undefined}
    >
      <Icon className="ref-ico" />
      <span>{it.label}</span>
      {!it.sub && ['Nghiên cứu chuyên sâu', 'Không gian tri thức'].includes(it.label) && (
        <ChevronDown size={14} className="ref-chevron" />
      )}
    </Link>
  );
  return (
    <>
      {open && (
        <button
          className="ref-mobile-backdrop ref-show"
          aria-label="Đóng menu điều hướng"
          onClick={onClose}
        />
      )}
      <aside
        ref={panel}
        id="studio-navigation"
        className={`ref-sidebar ${open ? 'ref-open' : ''}`}
        aria-label="Điều hướng chính"
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
      >
        <Link className="ref-brand" to="/" onClick={onClose}>
          <span className="ref-brand-logo">
            <Layers size={22} />
          </span>
          <span>
            <strong className="ref-brand-name">ResearchOS</strong>
            <span className="ref-brand-tagline">AI Research & Knowledge Workspace</span>
          </span>
        </Link>
        <button
          type="button"
          className="ref-icon-btn mobile-close ref-mobile-close"
          aria-label="Đóng menu"
          onClick={onClose}
        >
          <X size={21} />
        </button>
        <nav aria-label="Điều hướng workspace">
          {groups.map((g, i) => (
            <div className="ref-navgroup" key={i}>
              {g.map(item)}
            </div>
          ))}
        </nav>
        <div className="ref-nav-spacer" />
        <div className="ref-side-divider" />
        {item({
          to: '/settings',
          label: 'Cài đặt',
          icon: Settings,
          active: pathname === '/settings',
        })}
        {item({
          to: '/help',
          label: 'Trợ giúp & Tài liệu',
          icon: CircleHelp,
          active: pathname === '/help',
        })}
        <div className="ref-sidebar-footer">
          <span className="ref-version">ResearchOS Workspace</span>
        </div>
      </aside>
    </>
  );
}
