import { API_BASE_URL } from '../config/api';
export const terminal = ['completed', 'partial', 'failed', 'cancelled'];
export async function api(path, { body, key, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/research${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Mất kết nối backend. Kiểm tra kết nối rồi thử lại.');
  }
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.error || 'Yêu cầu thất bại');
  return payload.data;
}
export const runPath = (requestId, runId) =>
  `/${encodeURIComponent(requestId)}/runs/${encodeURIComponent(runId)}/progress`;
export const resourcePath = (runId, type) => `/runs/${encodeURIComponent(runId)}/${type}`;
