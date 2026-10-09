import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    setOpen(false);
    const title = location.pathname.startsWith('/workflow-1')
      ? 'Research Planning'
      : location.pathname.includes('sources') || location.pathname.startsWith('/workflow-2')
        ? 'Search & Collect'
        : location.pathname.startsWith('/research')
          ? 'Research Plan'
          : location.pathname === '/settings'
            ? 'Settings'
            : 'Dashboard';
    document.title = `${title} · AI Research Agent`;
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    function close(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Đi tới nội dung chính
      </a>
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="app-workspace">
        <Header onMenu={() => setOpen((value) => !value)} />
        <main id="main-content" className="page-content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>AI Research Agent</span>
          <span>Từ một ý tưởng, mở ra nhiều khả năng.</span>
        </footer>
      </div>
    </div>
  );
}
