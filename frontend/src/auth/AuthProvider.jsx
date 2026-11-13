import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { apiRequest } from '../services/apiClient';
import { setStorageUser } from '../utils/researchStorage';
const Context = createContext(null);
export async function authApi(path, body, signal) {
  return apiRequest(`/api/auth/${path}`, {
    method: body ? 'POST' : 'GET',
    body,
    signal,
    expire: !['login', 'register', 'me'].includes(path),
  });
}
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [expired, setExpired] = useState(false),
    [authError, setAuthError] = useState(null),
    [revision, setRevision] = useState(0);
  const update = useCallback((user) => {
    setStorageUser(user?.id);
    setUser(user);
  }, []);
  useEffect(() => {
    try {
      sessionStorage.removeItem('knowledge:key');
    } catch {}
    setLoading(true);
    setAuthError(null);
    let active = true;
    const controller = new AbortController();
    authApi('me', undefined, controller.signal)
      .then((user) => {
        if (active) update(user);
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401) update(null);
        else setAuthError(error);
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
  }, [update, revision]);
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
    () => ({
      user,
      loading,
      expired,
      signIn,
      logout,
      authError,
      restore: () => setRevision((n) => n + 1),
    }),
    [user, loading, expired, signIn, logout, authError],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useAuth = () => useContext(Context);
export function ProtectedRoute() {
  const { user, loading, authError, restore } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status">Đang kiểm tra phiên đăng nhập…</p>;
  if (authError) return <SessionError error={authError} retry={restore} />;
  return user ? (
    <Outlet key={user.id} />
  ) : (
    <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  );
}

export function SessionError({ error, retry }) {
  return (
    <main className="boundary-state">
      <h1>Chưa thể kiểm tra phiên đăng nhập</h1>
      <p role="alert">{error.message}</p>
      <button className="button button-primary" onClick={retry}>
        Thử lại kết nối
      </button>
    </main>
  );
}
