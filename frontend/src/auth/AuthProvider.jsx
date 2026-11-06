import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { setStorageUser } from '../utils/researchStorage';
const Context = createContext(null);
export async function authApi(path, body, signal) {
  const response = await fetch(`${API_BASE_URL}/api/auth/${path}`, {
    signal,
    credentials: 'include',
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => null);
  if (response.status === 401 && !['login', 'me'].includes(path))
    window.dispatchEvent(new Event('auth:expired'));
  if (!response.ok) throw new Error(result?.error || 'Không thể xác thực.');
  return result.data;
}
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [expired, setExpired] = useState(false);
  const update = useCallback((user) => {
    setStorageUser(user?.id);
    setUser(user);
  }, []);
  useEffect(() => {
    try {
      sessionStorage.removeItem('knowledge:key');
    } catch {}
    let active = true;
    const controller = new AbortController();
    authApi('me', undefined, controller.signal)
      .then((user) => {
        if (active) update(user);
      })
      .catch(() => {
        if (active) update(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const expire = () => {
      update(null);
      setExpired(true);
    };
    window.addEventListener('auth:expired', expire);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener('auth:expired', expire);
    };
  }, [update]);
  const signIn = useCallback(
    async (mode, body) => {
      const data = await authApi(mode, body);
      update(data);
      setExpired(false);
    },
    [update],
  );
  const logout = useCallback(async () => {
    await authApi('logout', {});
    update(null);
  }, [update]);
  const value = useMemo(
    () => ({ user, loading, expired, signIn, logout }),
    [user, loading, expired, signIn, logout],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useAuth = () => useContext(Context);
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status">Đang kiểm tra phiên đăng nhập…</p>;
  return user ? (
    <Outlet key={user.id} />
  ) : (
    <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  );
}
