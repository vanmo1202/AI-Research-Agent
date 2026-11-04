import { API_BASE_URL } from '../config/api';
let workspaceKey = '';
try {
  workspaceKey = sessionStorage.getItem('knowledge:key') || '';
} catch {
  /* Memory-only access when storage is blocked. */
}
export const getWorkspaceKey = () => workspaceKey;
export function setWorkspaceKey(key) {
  workspaceKey = key.trim();
  try {
    if (workspaceKey) sessionStorage.setItem('knowledge:key', workspaceKey);
    else sessionStorage.removeItem('knowledge:key');
  } catch {
    /* The key remains available only until refresh. */
  }
  window.dispatchEvent(new Event('knowledge:access'));
}
export async function knowledgeApi(path, { method = 'GET', body, signal, file = false } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, {
      method,
      signal,
      headers: {
        'X-Workspace-Key': workspaceKey,
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('Mất kết nối workspace. Kiểm tra trạng thái trước khi thử lại.');
  }
  if (file && response.ok) return response.blob();
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success)
    throw new Error(result?.error || `Yêu cầu thất bại (${response.status}).`);
  return result.data;
}
export const resourcePath = (type, id) => `/${type}/${encodeURIComponent(id)}`;
