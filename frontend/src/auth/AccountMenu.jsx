import { useState } from 'react';
import { useAuth, authApi } from './AuthProvider';
export default function AccountMenu() {
  const { user, logout } = useAuth(),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
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
    <details className="account-menu">
      <summary aria-label="Menu tài khoản">{user.name}</summary>
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
