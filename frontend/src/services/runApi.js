import { apiRequest, downloadFile } from './apiClient';
const root = '/api/research';
export const stages = [
  ['planning', 'Planning', 'Lập kế hoạch'],
  ['collecting', 'Collecting', 'Thu thập nguồn'],
  ['analyzing', 'Analyzing', 'Phân tích bằng chứng'],
  ['evaluating', 'Evaluating', 'Đánh giá độ phủ'],
  ['composing', 'Composing', 'Biên soạn báo cáo'],
  ['verifying', 'Verifying', 'Xác minh trích dẫn'],
];
export const terminal = (status) =>
  ['completed', 'partial', 'failed', 'cancelled'].includes(status);
export const runUrl = (requestId, runId) =>
  `/research/${encodeURIComponent(requestId)}/runs/${encodeURIComponent(runId)}`;
export const createRun = (id, options, key) =>
  apiRequest(`${root}/${encodeURIComponent(id)}/runs`, {
    method: 'POST',
    body: options,
    headers: { 'Idempotency-Key': key },
  });
export const mutateRun = (id, action, key) =>
  apiRequest(`${root}/runs/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    body: {},
    headers: key ? { 'Idempotency-Key': key } : {},
  });
export const exportRunReport = (id, format) =>
  downloadFile(
    `${root}/reports/${encodeURIComponent(id)}/export/${format}`,
    `Report_${id}.${format}`,
  );
