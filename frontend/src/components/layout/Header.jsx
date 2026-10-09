import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, ChevronDown, FileText, Menu, Search, X } from 'lucide-react';
import useResearchHistory from '../../hooks/useResearchHistory';

export default function Header({ onMenu }) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const input = useRef(null);
  const header = useRef(null);
  const history = useResearchHistory();
  const location = useLocation();
  useEffect(() => {
    setSearchOpen(false);
    setNotificationOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    function keydown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setNotificationOpen(false);
      }
    }
    function outside(event) {
      if (!header.current?.contains(event.target)) {
        setSearchOpen(false);
        setNotificationOpen(false);
      }
    }
    window.addEventListener('keydown', keydown);
    window.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('pointerdown', outside);
    };
  }, []);
  const matches = history
    .filter((item) => `${item.topic} ${item.requestId}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 5);
  return (
    <header className="top-header" ref={header}>
      <button
        className="icon-button menu-toggle"
        type="button"
        aria-label="Mở menu điều hướng"
        onClick={onMenu}
      >
        <Menu size={22} />
      </button>
      <div className="global-search">
        <Search size={18} />
        <input
          ref={input}
          aria-label="Tìm kiếm dự án, chủ đề, tài liệu"
          placeholder="Tìm kiếm dự án, chủ đề, tài liệu..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
        />
        <kbd>⌘ K</kbd>
        {searchOpen && (
          <div className="search-popover">
            <div className="popover-heading">
              Nghiên cứu trong trình duyệt này
              <button
                className="icon-button"
                type="button"
                aria-label="Đóng tìm kiếm"
                onClick={() => setSearchOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            {matches.length ? (
              matches.map((item) => (
                <Link to={`/research/${item.requestId}`} key={item.requestId}>
                  <FileText size={18} />
                  <span>{item.topic}</span>
                </Link>
              ))
            ) : (
              <p>Không có nghiên cứu phù hợp.</p>
            )}
          </div>
        )}
      </div>
      <div className="header-right">
        <div className="notification">
          <button
            className="icon-button notification-button"
            aria-label="Thông báo"
            aria-expanded={notificationOpen}
            type="button"
            onClick={() => setNotificationOpen((value) => !value)}
          >
            <Bell size={20} />
          </button>
          {notificationOpen && (
            <div className="notification-popover">
              <strong>Thông báo</strong>
              <p>
                Chưa có thông báo mới.
                <br />
                Mọi kết quả nghiên cứu đều được lưu tự động.
              </p>
            </div>
          )}
        </div>
        <div className="header-divider" />
        <Link className="profile" to="/settings" aria-label="Cài đặt hồ sơ Nguyễn Minh Anh">
          <span className="avatar">N</span>
          <span className="profile-copy">
            <strong>Nguyễn Minh Anh</strong>
            <small>Sinh viên</small>
          </span>
          <ChevronDown size={15} className="profile-chevron" />
        </Link>
      </div>
    </header>
  );
}
