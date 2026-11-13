import { Bell, Search } from 'lucide-react';
import AccountMenu from '../../auth/AccountMenu';
import { useWorkspaceUI } from '../workspace/WorkspaceUI';

export default function Header() {
  const { openDialog } = useWorkspaceUI();
  return (
    <header className="ref-topbar">
      <div className="ref-topbar-left">
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
          type="button"
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
