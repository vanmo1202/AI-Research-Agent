import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { setStorageUser } from '../utils/researchStorage';
const Context = createContext(null);
export async function authApi(path, body) {
  const response = await fetch(`${API_BASE_URL}/api/auth/${path}`, {
    credentials: 'include',
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (response.status === 401 && !['login', 'me'].includes(path))
    window.dispatchEvent(new Event('auth:expired'));
  if (!response.ok) throw new Error(result.error || 'Không thể xác thực.');
  return result.data;
}
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [expired, setExpired] = useState(false);
  function update(user) {
    setStorageUser(user?.id);
    setUser(user);
  }
  useEffect(() => {
    try {
      sessionStorage.removeItem('knowledge:key');
    } catch {}
    authApi('me')
      .then(update)
      .catch(() => update(null))
      .finally(() => setLoading(false));
    const expire = () => {
      update(null);
      setExpired(true);
    };
    window.addEventListener('auth:expired', expire);
    return () => window.removeEventListener('auth:expired', expire);
  }, []);
  async function signIn(mode, body) {
    const data = await authApi(mode, body);
    update(data);
    setExpired(false);
  }
  async function logout() {
    await authApi('logout', {});
    update(null);
  }
  return (
    <Context.Provider value={{ user, loading, expired, signIn, logout }}>
      {children}
    </Context.Provider>
  );
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
