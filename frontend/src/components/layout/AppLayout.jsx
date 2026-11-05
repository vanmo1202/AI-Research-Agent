import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

function pageTitle(path) {
  if (path==='/') return 'Tổng quan';
  if (path.startsWith('/documents')) return 'Thư viện tài liệu';
  if (path==='/chat'||path.includes('/chat')) return 'Chat với tài liệu';
  if (path.startsWith('/memories')) return 'Agent Memory';
  if (path.startsWith('/workflow-4')) return 'Báo cáo nghiên cứu';
  if (path.startsWith('/workflow-3')) return 'Phân tích bằng chứng';
  if (path.startsWith('/workflow-1')||path.startsWith('/research')||path.startsWith('/workflow-2')) return 'Quy trình nghiên cứu';
  if (path.startsWith('/settings')) return 'Cài đặt';
  return 'ResearchOS';
}
export default function AppLayout() {
  const [open,setOpen] = useState(false);
  const location=useLocation();
  useEffect(()=>{window.scrollTo(0,0);setOpen(false);document.title=`${pageTitle(location.pathname)} · ResearchOS`;},[location.pathname]);
  useEffect(()=>{if(!open)return;const close=(event)=>{if(event.key==='Escape')setOpen(false);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[open]);
  return <div className="app-shell">
    <a href="#main-content" className="skip-link">Đi tới nội dung chính</a>
    <Sidebar open={open} onClose={()=>setOpen(false)}/>
    <div className="app-workspace"><Header onMenu={()=>setOpen(v=>!v)}/>
      <main id="main-content" className="page-content" tabIndex={-1}><Outlet/></main>
    </div>
  </div>;
}