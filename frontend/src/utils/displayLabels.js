// Only localize presentation. Keep API, database and workflow keys unchanged.
const stages = {
  planning: 'Lập kế hoạch',
  collecting: 'Thu thập nguồn',
  analyzing: 'Phân tích bằng chứng',
  evaluating: 'Đánh giá độ phủ',
  composing: 'Biên soạn báo cáo',
  verifying: 'Xác minh trích dẫn',
};
const statuses = {
  created: 'Đã tạo nghiên cứu',
  planning: 'Đang lập kế hoạch',
  planned: 'Đã lập kế hoạch',
  searching: 'Đang tìm kiếm',
  collecting: 'Đang thu thập nguồn',
  collected: 'Đã thu thập',
  translating: 'Đang dịch sang tiếng Việt',
  analyzing: 'Đang phân tích',
  analyzed: 'Đã phân tích',
  analyzed_partial: 'Phân tích một phần',
  evaluating: 'Đang đánh giá',
  composing: 'Đang biên soạn báo cáo',
  verifying: 'Đang xác minh',
  generating_report: 'Đang tạo báo cáo',
  queued: 'Đang chờ xử lý',
  pending: 'Chờ xử lý',
  processing: 'Đang xử lý',
  running: 'Đang xử lý',
  completed: 'Đã hoàn thành',
  complete: 'Hoàn thành',
  partial: 'Hoàn thành một phần',
  failed: 'Thất bại',
  cancelled: 'Đã hủy',
  ready: 'Sẵn sàng',
  verified: 'Đã xác minh',
  unverified: 'Chưa xác minh',
  accepted: 'Được chấp nhận',
  inaccessible: 'Không truy cập được',
  unavailable: 'Không khả dụng',
  unsupported: 'Không được hỗ trợ',
  not_required: 'Không cần xử lý',
  stale: 'Cần kiểm tra lại',
  no_run: 'Chưa có lượt chạy',
};
const qualities = {
  planned: 'Đã lập kế hoạch',
  accepted: 'Được chấp nhận',
  traceable: 'Có thể truy vết',
  insufficient: 'Chưa đủ bằng chứng',
  verified: 'Đã xác minh',
  unverified: 'Chưa xác minh',
  unavailable: 'Không khả dụng',
  conflicting: 'Có mâu thuẫn',
  rejected: 'Không được chấp nhận',
  supported: 'Có bằng chứng hỗ trợ',
  unsupported: 'Chưa có bằng chứng hỗ trợ',
  partial: 'Đạt một phần',
  complete: 'Đầy đủ',
  completed: 'Đã hoàn thành',
  pending: 'Chưa đánh giá',
  ready: 'Sẵn sàng',
  failed: 'Thất bại',
};
const coverages = {
  complete: 'Đầy đủ',
  completed: 'Đã hoàn thành',
  full: 'Đầy đủ',
  sufficient: 'Đủ bằng chứng',
  adequate: 'Đạt yêu cầu',
  partial: 'Bao phủ một phần',
  insufficient: 'Chưa đủ bằng chứng',
  none: 'Chưa có bằng chứng',
  missing: 'Thiếu bằng chứng',
  unavailable: 'Không khả dụng',
  unknown: 'Chưa đánh giá',
  unverified: 'Chưa xác minh',
  verified: 'Đã xác minh',
};
const translations = {
  complete: 'Đã dịch',
  partial: 'Dịch một phần',
  pending: 'Chờ dịch',
  processing: 'Đang dịch',
  failed: 'Dịch thất bại',
  not_required: 'Không cần dịch',
};
function label(value, dictionary) {
  if (value == null || value === '') return '';
  const text = String(value).trim();
  return dictionary[text] || text;
}
export const stageLabel = (value) => label(value, stages);
export const statusLabel = (value) => label(value, statuses);
export const qualityLabel = (value) => label(value, qualities);
export const coverageLabel = (value) => label(value, coverages);
export const translationLabel = (value) => label(value, translations);
export const languageLabel = (value) =>
  ({ vi: 'Tiếng Việt', en: 'Tiếng Anh' })[value] || value || 'Chưa chọn';
