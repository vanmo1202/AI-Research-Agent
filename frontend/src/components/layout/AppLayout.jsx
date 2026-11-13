import { useEffect, useState, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import WorkspaceUI from '../workspace/WorkspaceUI';

function pageTitle(path) {
  if (path === '/') return 'Tổng quan';
  if (path === '/automations') return 'Tự động hóa (n8n)';
  if (path === '/workflows') return '5 luồng làm việc';
  if (path === '/activity') return 'Thống kê & hoạt động';
  if (path === '/help') return 'Trợ giúp & Tài liệu';
  if (path === '/reports') return 'Báo cáo';
  if (path === '/evidence') return 'Phân tích bằng chứng';
  if (path.startsWith('/schedules')) return 'Lịch nghiên cứu';
  if (path === '/researches') return 'Nghiên cứu của bạn';
  if (path.startsWith('/documents')) return 'Thư viện tài liệu';
  if (path.includes('/chat')) return 'AI Research Chat';
  if (path.startsWith('/memories')) return 'Agent Memory';
  if (path.startsWith('/workflow-4')) return 'Báo cáo nghiên cứu';
  if (path.startsWith('/workflow-3')) return 'Phân tích bằng chứng';
  if (
    path.startsWith('/workflow-1') ||
    path.startsWith('/research') ||
    path.startsWith('/workflow-2')
  )
    return 'Quy trình nghiên cứu';
  if (path.startsWith('/settings')) return 'Cài đặt';
  return 'ResearchOS';
}
export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    window.scrollTo(0, 0);
    setOpen(false);
    document.title = `${pageTitle(location.pathname)} · ResearchOS`;
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  return (
    <WorkspaceUI>
      <div className="ref-app ref-horizontal-app">
        <a href="#main-content" className="skip-link">
          Đi tới nội dung chính
        </a>
        <Sidebar open={open} onClose={close} onToggle={() => setOpen((value) => !value)} />
        <div className="ref-main" inert={open}>
          <Header />
          <main id="main-content" className="page-content ref-content" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </WorkspaceUI>
  );
}
