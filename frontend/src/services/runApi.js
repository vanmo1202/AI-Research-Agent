import { apiRequest, downloadFile } from './apiClient';
const root = '/api/research';
export const stages = [
  ['planning', 'Lập kế hoạch', 'Lập kế hoạch'],
  ['collecting', 'Thu thập nguồn', 'Thu thập nguồn'],
  ['analyzing', 'Phân tích bằng chứng', 'Phân tích bằng chứng'],
  ['evaluating', 'Đánh giá độ phủ', 'Đánh giá độ phủ'],
  ['composing', 'Biên soạn báo cáo', 'Biên soạn báo cáo'],
  ['verifying', 'Xác minh trích dẫn', 'Xác minh trích dẫn'],
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
    `Bao_cao_${id}.${format}`,
  );
