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
    error.code = payload?.code;
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
export const analyzeEvidence = (id) => request(`${resource(id)}/analyze`, { method: 'POST' });
export const getEvidence = (id, signal) => request(`${resource(id)}/evidence`, { signal });
export const generateReport = (id, config) =>
  request(`${resource(id)}/report`, { method: 'POST', body: config });
export const getReport = (id, signal) => request(`${resource(id)}/report`, { signal });
export async function checkHealth(signal) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/health`, { signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Không thể kết nối backend. Kiểm tra server, địa chỉ API và cấu hình CORS.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.status !== 'ok') {
    const error = new Error(data?.error || `Kiểm tra backend thất bại (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function exportReportFile(requestId, format) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${resource(requestId)}/report/export/${format}`);
  } catch {
    throw new Error(`Không thể xuất báo cáo ${format === 'docx' ? 'Word' : 'PDF'}.`);
  }
  if (!response.ok) {
    const error = new Error(`Không thể xuất báo cáo ${format === 'docx' ? 'Word' : 'PDF'}.`);
    error.status = response.status;
    throw error;
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = (match?.[1] || `Bao_cao_nghien_cuu_${requestId.slice(0, 8)}.${format}`).replace(
    /[\\/\r\n]/g,
    '_',
  );
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}
export const exportReportDocx = (requestId) => exportReportFile(requestId, 'docx');
export const exportReportPdf = (requestId) => exportReportFile(requestId, 'pdf');
