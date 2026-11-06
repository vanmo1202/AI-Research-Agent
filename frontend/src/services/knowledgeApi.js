import { API_BASE_URL } from '../config/api';
export async function knowledgeApi(path, { method = 'GET', body, signal, file = false } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, {
      credentials: 'include',
      method,
      signal,
      headers: {
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('Mất kết nối workspace. Kiểm tra trạng thái trước khi thử lại.');
  }
  if (response.status === 401) window.dispatchEvent(new Event('auth:expired'));
  if (file && response.ok) return response.blob();
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success)
    throw new Error(result?.error || `Yêu cầu thất bại (${response.status}).`);
  return result.data;
}
export const resourcePath = (type, id) => `/${type}/${encodeURIComponent(id)}`;
