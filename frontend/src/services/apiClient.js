import { API_BASE_URL } from '../config/api';

// CSRF is Origin/Referer based in Express. Browser sends Origin automatically.
// Never retry mutations automatically: a timeout can follow a committed write.
export async function apiRequest(
  path,
  { method = 'GET', body, signal, headers, file = false, timeout = 90000, expire = true } = {},
) {
  if (!path.startsWith('/api/') && path !== '/health') throw new Error('API path không hợp lệ.');
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(
    () => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
    timeout,
  );
  try {
    const multipart = body instanceof FormData;
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        ...(body !== undefined && !multipart ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: multipart ? body : JSON.stringify(body) } : {}),
    });
    if (response.status === 401 && expire) window.dispatchEvent(new Event('auth:expired'));
    if (file && response.ok) return { blob: await response.blob(), headers: response.headers };
    const result = await response.json().catch(() => null);
    if (!response.ok || (path !== '/health' && result?.success !== true)) {
      throw Object.assign(
        new Error(result?.error || `Yêu cầu thất bại (HTTP ${response.status}).`),
        {
          status: response.status,
          code: result?.code,
          stage: result?.stage,
          requestId: result?.requestId,
        },
      );
    }
    if (method !== 'GET' && method !== 'HEAD' && !path.startsWith('/api/auth/')) {
      const message = path.includes('/messages')
        ? 'Đã lưu lượt hội thoại.'
        : path.includes('/documents')
          ? 'Đã lưu thay đổi tài liệu.'
          : path.includes('/memories')
            ? 'Đã cập nhật bộ nhớ.'
            : path.includes('/schedules')
              ? 'Đã lưu lịch nghiên cứu.'
              : path.endsWith('/cancel')
                ? 'Đã hủy nghiên cứu.'
                : path.endsWith('/retry')
                  ? 'Đã tiếp nhận yêu cầu thử lại.'
                  : path.endsWith('/runs')
                    ? 'Đã tiếp nhận run nghiên cứu.'
                    : 'Thay đổi đã được máy chủ xác nhận.';
      window.dispatchEvent(new CustomEvent('workspace:success', { detail: { message } }));
    }
    return path === '/health' ? result : result.data;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted)
      throw new Error('Hết thời gian chờ. Kiểm tra trạng thái trước khi thử lại.');
    if (error instanceof TypeError)
      throw new Error('Không thể kết nối backend. Kiểm tra kết nối rồi tải lại trạng thái.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
export async function downloadFile(path, fallback) {
  const { blob, headers } = await apiRequest(path, { file: true });
  const name =
    /filename="?([^";]+)"?/i.exec(headers.get('Content-Disposition') || '')?.[1] || fallback;
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = name.replace(/[\\/\r\n]/g, '_');
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
