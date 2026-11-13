import { apiRequest as request, downloadFile } from './apiClient';
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
export const checkHealth = (signal) => request('/health', { signal, timeout: 10000 });
export const exportReportDocx = (id) =>
  downloadFile(`${resource(id)}/report/export/docx`, `Report_${id}.docx`);
export const exportReportPdf = (id) =>
  downloadFile(`${resource(id)}/report/export/pdf`, `Report_${id}.pdf`);
