import AccountMenu from '../../auth/AccountMenu';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, FileText, HelpCircle, Menu, Search, X } from 'lucide-react';
import useResearchHistory from '../../hooks/useResearchHistory';

export default function Header({ onMenu }) {
  const [query,setQuery] = useState('');
  const [searchOpen,setSearchOpen] = useState(false);
  const [notificationOpen,setNotificationOpen] = useState(false);
  const input = useRef(null);
  const header = useRef(null);
  const history = useResearchHistory();
  const location = useLocation();
  useEffect(() => { setSearchOpen(false); setNotificationOpen(false); }, [location.pathname]);
  useEffect(() => {
    function keydown(event) {
      if ((event.metaKey||event.ctrlKey) && event.key.toLowerCase()==='k') {
        event.preventDefault(); input.current?.focus(); setSearchOpen(true);
      }
      if (event.key==='Escape') { setSearchOpen(false); setNotificationOpen(false); }
    }
    function outside(event) {
      if (!header.current?.contains(event.target)) { setSearchOpen(false); setNotificationOpen(false); }
    }
    window.addEventListener('keydown',keydown);
    window.addEventListener('pointerdown',outside);
    return () => { window.removeEventListener('keydown',keydown); window.removeEventListener('pointerdown',outside); };
  }, []);
  const matches=history.filter(item=>`${item.topic} ${item.requestId}`.toLowerCase().includes(query.toLowerCase())).slice(0,5);
  return <header className="top-header ro-header" ref={header}>
    <button className="icon-button menu-toggle" type="button" aria-label="Mở menu điều hướng" onClick={onMenu}><Menu size={22}/></button>
    <div className="global-search ro-global-search">
      <Search size={18}/>
      <input ref={input} aria-label="Tìm kiếm nghiên cứu" placeholder="Tìm kiếm nghiên cứu..." value={query}
        onChange={event=>{setQuery(event.target.value);setSearchOpen(true);}} onFocus={()=>setSearchOpen(true)}/>
      <kbd>Ctrl K</kbd>
      {searchOpen && query.trim() && <div className="search-popover">
        <div className="popover-heading">Nghiên cứu gần đây <button type="button" className="icon-button" aria-label="Đóng tìm kiếm" onClick={()=>setSearchOpen(false)}><X size={16}/></button></div>
        {matches.length ? matches.map(item=><Link key={item.requestId} to={`/research/${encodeURIComponent(item.requestId)}`}><FileText size={17}/><span>{item.topic}</span></Link>):<p>Không tìm thấy nghiên cứu trong lịch sử trình duyệt.</p>}
      </div>}
    </div>
    <div className="header-right ro-header-right">
      <div className="notification">
        <button className="icon-button" aria-label="Thông báo" aria-expanded={notificationOpen} type="button" onClick={()=>setNotificationOpen(v=>!v)}><Bell size={19}/></button>
        {notificationOpen && <div className="notification-popover"><strong>Thông báo</strong><p>Chưa có thông báo mới.</p></div>}
      </div>
      <Link to="/settings" className="icon-button" aria-label="Trợ giúp và cài đặt"><HelpCircle size={19}/></Link>
      <AccountMenu/>
    </div>
  </header>;
}