import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
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
import { getLastRequestId } from '../../utils/researchStorage';

export default function Sidebar({ open, onClose }) {
  const { pathname } = useLocation();
  useResearchHistory();
  const routeId = pathname.match(/^\/(?:research|workflow-2)\/([^/]+)/)?.[1];
  const id = routeId || getLastRequestId();
  const sourcesActive = pathname.endsWith('/sources');
  const items = [
    { to: '/', label: 'Dashboard', icon: House, active: pathname === '/' },
    {
      to: '/workflow-1',
      label: 'Workflow 1',
      detail: 'Research Planning',
      icon: FileText,
      active: pathname === '/workflow-1' || (pathname.startsWith('/research/') && !sourcesActive),
    },
    {
      to: id ? `/workflow-2/${id}` : '/workflow-2',
      label: 'Workflow 2',
      detail: 'Search & Collect',
      icon: Database,
      active: pathname.startsWith('/workflow-2') || sourcesActive,
    },
    { to: '/sources', label: 'Sources', icon: Link2, active: pathname === '/sources' },
    { to: '/settings', label: 'Settings', icon: Settings, active: pathname === '/settings' },
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
            <small>From ideas to insights</small>
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
        <div className="nav-caption">WORKSPACE</div>
        <nav className="sidebar-nav">
          {items.map(({ icon: Icon, ...item }) => (
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
