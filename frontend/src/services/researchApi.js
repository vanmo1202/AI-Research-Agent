import { API_BASE_URL } from '../config/api';

// API backend luôn bọc kết quả trong { success, data }; error giữ message từ backend.
async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal,
      ...(body !== undefined
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        : {}),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Không thể kết nối backend. Kiểm tra server, địa chỉ API và cấu hình CORS.');
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const error = new Error(payload?.error || `Yêu cầu thất bại (HTTP ${response.status}).`);
    error.status = response.status;
    error.requestId = payload?.requestId;
    throw error;
  }
  return payload.data;
}

const resource = (id) => `/api/research/${encodeURIComponent(id)}`;
export const createResearch = (data) => request('/api/research', { method: 'POST', body: data });
export const getResearch = (id, signal) => request(resource(id), { signal });
export const searchAndCollect = (id) => request(`${resource(id)}/search`, { method: 'POST' });
export const getSources = (id, signal) => request(`${resource(id)}/sources`, { signal });
export async function checkHealth(signal) {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { signal });
    const data = await response.json();
    if (!response.ok || data.status !== 'ok') throw new Error();
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Chưa kết nối được backend. Hãy chạy server và kiểm tra CORS.');
  }
}
