import AccountMenu from '../../auth/AccountMenu';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, FileText, Menu, Search, X } from 'lucide-react';
import useResearchHistory from '../../hooks/useResearchHistory';
export default function Header({ onMenu, menuOpen, title }) {
  const [query, setQuery] = useState(''),
    [searchOpen, setSearchOpen] = useState(false);
  const input = useRef(null),
    header = useRef(null);
  const history = useResearchHistory(),
    location = useLocation();
  useEffect(() => {
    setSearchOpen(false);
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
        input.current?.blur();
      }
    }
    function outside(event) {
      if (!header.current?.contains(event.target)) setSearchOpen(false);
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
    <header className="top-header studio-header" ref={header}>
      <button
        className="icon-button menu-toggle"
        type="button"
        aria-label="Mở menu điều hướng"
        aria-expanded={menuOpen}
        aria-controls="studio-navigation"
        onClick={onMenu}
      >
        <Menu size={22} />
      </button>
      <nav className="studio-breadcrumb" aria-label="Đường dẫn trang">
        <Link to="/">Không gian</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">{title}</span>
      </nav>
      <div
        className="global-search studio-search"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
        }}
      >
        <Search size={17} aria-hidden="true" />
        <input
          ref={input}
          type="search"
          aria-label="Tìm kiếm nghiên cứu"
          aria-controls={searchOpen && query.trim() ? 'studio-search-results' : undefined}
          placeholder="Tìm trong nghiên cứu…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
        />
        <kbd>⌘ / Ctrl K</kbd>
        {searchOpen && query.trim() && (
          <div className="search-popover" id="studio-search-results">
            <div className="popover-heading">
              Lịch sử trên trình duyệt
              <button
                type="button"
                className="icon-button"
                aria-label="Đóng tìm kiếm"
                onClick={() => {
                  setSearchOpen(false);
                  input.current?.focus();
                }}
              >
                <X size={16} />
              </button>
            </div>
            {matches.length ? (
              matches.map((item) => (
                <Link
                  key={item.requestId}
                  to={`/research/${encodeURIComponent(item.requestId)}`}
                  onClick={() => setSearchOpen(false)}
                >
                  <FileText size={17} />
                  <span>{item.topic}</span>
                </Link>
              ))
            ) : (
              <p role="status">Không tìm thấy nghiên cứu trong lịch sử trình duyệt.</p>
            )}
          </div>
        )}
      </div>
      <div className="header-right studio-header-account">
        <AccountMenu />
      </div>
    </header>
  );
}
