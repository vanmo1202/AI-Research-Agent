import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';
import WorkspaceDialog from './WorkspaceDialog';
const NewResearchPage = lazy(() => import('../../pages/NewResearchPage'));
const WorkspaceSearch = lazy(() => import('./WorkspaceSearch'));
const WorkspaceNotifications = lazy(() => import('./WorkspaceNotifications'));
const UploadDialog = lazy(() => import('./UploadDialog'));
const Context = createContext(null);
export const useWorkspaceUI = () => useContext(Context);
export default function WorkspaceUI({ children }) {
  const [dialog, setDialog] = useState(null),
    [toasts, setToasts] = useState([]),
    timers = useRef(new Set());
  const location = useLocation();
  const closeDialog = useCallback(() => setDialog(null), []);
  useEffect(() => {
    setDialog(null);
  }, [location.pathname, location.search]);
  useEffect(() => {
    function notify(e) {
      const id = crypto.randomUUID();
      setToasts((items) =>
        [
          ...items,
          { id, message: e.detail?.message || 'Thao tác đã được máy chủ xác nhận.' },
        ].slice(-3),
      );
      const timer = setTimeout(() => {
        setToasts((items) => items.filter((t) => t.id !== id));
        timers.current.delete(timer);
      }, 4500);
      timers.current.add(timer);
    }
    window.addEventListener('workspace:success', notify);
    return () => {
      window.removeEventListener('workspace:success', notify);
      timers.current.forEach(clearTimeout);
    };
  }, []);
  useEffect(() => {
    function key(e) {
      if ((e.ctrlKey || e.metaKey) && ['k', 'n'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        if (document.querySelector('dialog[open]')) return;
        if (e.key.toLowerCase() === 'k' && document.activeElement === document.body)
          document.querySelector('[data-workspace-search]')?.focus();
        setDialog(e.key.toLowerCase() === 'k' ? 'search' : 'research');
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const titles = {
    search: 'Tìm kiếm trong workspace',
    research: 'Tạo phiên nghiên cứu mới',
    notifications: 'Thông báo gần đây',
    upload: 'Tải tài liệu PDF',
  };
  return (
    <Context.Provider value={{ openDialog: setDialog, closeDialog }}>
      {children}
      {dialog && (
        <WorkspaceDialog
          title={titles[dialog]}
          onClose={closeDialog}
          wide={dialog === 'research' || dialog === 'search'}
        >
          <Suspense fallback={<p role="status">Đang tải…</p>}>
            {dialog === 'research' ? (
              <NewResearchPage embedded />
            ) : dialog === 'search' ? (
              <WorkspaceSearch onClose={closeDialog} />
            ) : dialog === 'upload' ? (
              <UploadDialog />
            ) : (
              <WorkspaceNotifications />
            )}
          </Suspense>
        </WorkspaceDialog>
      )}
      <div className="ref-toast-wrap" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div className="ref-toast" role="status" key={t.id}>
            <CheckCircle2 size={18} />
            <span>{t.message}</span>
            <button
              aria-label="Đóng thông báo"
              onClick={() => setToasts((items) => items.filter((i) => i.id !== t.id))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}
