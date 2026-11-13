import { useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  BookOpen,
  BrainCircuit,
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  FileText,
  Files,
  FolderOpen,
  House,
  Layers,
  Menu,
  MessageSquareText,
  Settings,
  Workflow,
  X,
} from 'lucide-react';

function NavigationLink({ to, label, icon: Icon, onNavigate, end = false, submenu = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        ['ro-topnav-link', submenu && 'ro-topnav-sublink', isActive && 'ro-nav-active']
          .filter(Boolean)
          .join(' ')
      }
    >
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  );
}

const researchLinks = [
  { to: '/workflow-1', label: 'Nghiên cứu chuyên sâu', icon: FolderOpen },
  { to: '/researches', label: 'Các phiên nghiên cứu', icon: Layers },
  { to: '/workflows', label: 'Workflow (5 luồng)', icon: Workflow },
  { to: '/evidence', label: 'Phân tích bằng chứng', icon: BookOpen },
  { to: '/reports', label: 'Báo cáo', icon: FileText },
];

const knowledgeLinks = [
  { to: '/documents', label: 'Tài liệu (PDF)', icon: Files },
  { to: '/chat', label: 'AI Research Chat', icon: MessageSquareText },
  { to: '/memories', label: 'Bộ nhớ (Memory)', icon: BrainCircuit },
];

function NavigationGroup({ label, icon: Icon, links, active, onNavigate }) {
  return (
    <details className={'ro-topnav-group' + (active ? ' ro-nav-section-active' : '')}>
      <summary>
        <Icon size={18} aria-hidden="true" />
        <span>{label}</span>
        <ChevronDown className="ro-topnav-chevron" size={15} aria-hidden="true" />
      </summary>
      <div className="ro-topnav-dropdown">
        {links.map((link) => (
          <NavigationLink key={link.to} {...link} submenu onNavigate={onNavigate} />
        ))}
      </div>
    </details>
  );
}

// Keep the existing component entry point while presenting it as a top navigation bar.
export default function Sidebar({ open, onClose, onToggle }) {
  const { pathname } = useLocation();
  const navigation = useRef(null);

  useEffect(() => {
    navigation.current?.querySelectorAll('details[open]').forEach((item) => {
      item.open = false;
    });
  }, [pathname]);

  useEffect(() => {
    const dismiss = (event) => {
      if (!navigation.current?.contains(event.target)) {
        navigation.current?.querySelectorAll('details[open]').forEach((item) => {
          item.open = false;
        });
      }
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const media = window.matchMedia('(min-width: 1081px)');
    const resize = () => {
      if (media.matches) onClose();
    };
    const trap = (event) => {
      if (event.key !== 'Tab') return;
      const candidates = navigation.current?.querySelectorAll(
        'a[href], button:not([disabled]), summary',
      );
      const items = [...(candidates || [])].filter((el) => el.getClientRects().length);
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    media.addEventListener('change', resize);
    document.addEventListener('keydown', trap);
    return () => {
      media.removeEventListener('change', resize);
      document.removeEventListener('keydown', trap);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  const navigate = () => {
    navigation.current?.querySelectorAll('details[open]').forEach((item) => {
      item.open = false;
    });
    onClose();
  };
  const researchActive =
    pathname.startsWith('/research') ||
    pathname.startsWith('/workflow-') ||
    ['/workflows', '/evidence', '/reports'].includes(pathname);
  const knowledgeActive =
    pathname.startsWith('/documents') ||
    pathname.includes('/chat') ||
    pathname.startsWith('/memories');

  return (
    <>
      {open && (
        <button
          type="button"
          className="ro-topnav-backdrop"
          aria-label="Đóng menu điều hướng"
          tabIndex={-1}
          onClick={onClose}
        />
      )}
      <header className="ro-topnav-shell" ref={navigation}>
        <div className="ro-topnav-inner">
          <Link className="ro-topnav-brand" to="/" onClick={navigate}>
            <span className="ref-brand-logo" aria-hidden="true">
              <Layers size={23} />
            </span>
            <span className="ro-topnav-brand-copy">
              <strong className="ref-brand-name">ResearchOS</strong>
              <span className="ref-brand-tagline">Không gian nghiên cứu và tri thức AI</span>
            </span>
          </Link>

          <button
            type="button"
            className="ro-topnav-toggle"
            aria-label={open ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            aria-expanded={open}
            aria-controls="studio-navigation"
            onClick={onToggle}
          >
            {open ? <X size={23} /> : <Menu size={23} />}
          </button>

          <nav
            id="studio-navigation"
            className={'ro-topnav-links' + (open ? ' is-open' : '')}
            aria-label="Điều hướng chính"
          >
            <NavigationLink to="/" end label="Trang chủ" icon={House} onNavigate={navigate} />
            <NavigationGroup
              label="Nghiên cứu"
              icon={FolderOpen}
              links={researchLinks}
              active={researchActive}
              onNavigate={navigate}
            />
            <NavigationGroup
              label="Tri thức"
              icon={BookOpen}
              links={knowledgeLinks}
              active={knowledgeActive}
              onNavigate={navigate}
            />
            <NavigationLink
              to="/automations"
              label="Tự động hóa (n8n)"
              icon={Workflow}
              onNavigate={navigate}
            />
            <NavigationLink
              to="/activity"
              label="Hoạt động"
              icon={ChartNoAxesCombined}
              onNavigate={navigate}
            />
            <NavigationLink to="/help" label="Trợ giúp" icon={CircleHelp} onNavigate={navigate} />
            <NavigationLink to="/settings" label="Cài đặt" icon={Settings} onNavigate={navigate} />
          </nav>
        </div>
      </header>
    </>
  );
}
