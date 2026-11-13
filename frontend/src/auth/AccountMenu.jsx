import { useState, useRef, useEffect } from 'react';
import { useAuth, authApi } from './AuthProvider';
import { ChevronDown } from 'lucide-react';
export default function AccountMenu() {
  const { user, logout } = useAuth(),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const menu = useRef(null);
  useEffect(() => {
    const outside = (event) => {
      if (!menu.current?.contains(event.target) && menu.current) menu.current.open = false;
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  async function change(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const form = e.currentTarget;
    try {
      await authApi('change-password', Object.fromEntries(new FormData(form)));
      form.reset();
      setMessage('Đã thay đổi mật khẩu và thu hồi các phiên cũ.');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      ref={menu}
      className="account-menu"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }
      }}
    >
      <summary aria-label="Menu tài khoản">
        <span className="ref-avatar" aria-hidden="true">
          {user.name?.slice(0, 1).toLocaleUpperCase()}
        </span>
        <span className="ref-account-name">{user.name}</span>
        <ChevronDown size={14} />
      </summary>
      <div className="account-popover">
        <strong>{user.name}</strong>
        <p>{user.email}</p>
        <form onSubmit={change}>
          <label>
            Mật khẩu hiện tại
            <input
              aria-label="Mật khẩu hiện tại"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label>
            Mật khẩu mới
            <input
              aria-label="Mật khẩu mới"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              maxLength={128}
            />
          </label>
          <button disabled={busy}>Thay đổi mật khẩu</button>
        </form>
        {message && <p role="status">{message}</p>}
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await logout();
            } catch (e) {
              setMessage(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Đăng xuất
        </button>
      </div>
    </details>
  );
}
