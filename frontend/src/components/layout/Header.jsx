import { Bell, Menu, Search } from 'lucide-react';
import AccountMenu from '../../auth/AccountMenu';
import { useWorkspaceUI } from '../workspace/WorkspaceUI';
export default function Header({ onMenu, menuOpen }) {
  const { openDialog } = useWorkspaceUI();
  return (
    <header className="ref-topbar">
      <div className="ref-topbar-left">
        <button
          type="button"
          className="ref-icon-btn ref-hamburger"
          aria-label="Mở menu điều hướng"
          aria-expanded={menuOpen}
          aria-controls="studio-navigation"
          onClick={onMenu}
        >
          <Menu size={21} />
        </button>
        <button
          type="button"
          className="ref-searchbox"
          data-workspace-search
          aria-label="Tìm kiếm nghiên cứu, tài liệu, báo cáo"
          onClick={() => openDialog('search')}
        >
          <Search size={18} />
          <span>Tìm kiếm nghiên cứu, tài liệu, báo cáo...</span>
          <kbd>Ctrl + K</kbd>
        </button>
      </div>
      <div className="ref-topbar-right">
        <button
          className="ref-icon-btn"
          aria-label="Thông báo"
          onClick={() => openDialog('notifications')}
        >
          <Bell size={21} />
        </button>
        <AccountMenu />
      </div>
    </header>
  );
}
