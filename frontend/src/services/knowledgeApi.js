const messages = {
  'Document not found': 'Tài liệu không còn khả dụng hoặc bạn không có quyền truy cập.',
  'Document not ready': 'PDF chưa sẵn sàng. Hãy chờ xử lý hoặc kiểm tra lỗi tài liệu.',
  'Chat not found': 'Không tìm thấy hội thoại hoặc bạn không có quyền truy cập.',
  'Memory not found': 'Không tìm thấy bộ nhớ.',
  'Memory source is stale': 'Nguồn bộ nhớ đã thay đổi. Vui lòng kiểm tra lại trích dẫn.',
  'Memory unavailable or not verified': 'Bộ nhớ chưa được xác minh hoặc không còn hợp lệ.',
  'Select at least one ready PDF': 'Chọn ít nhất một PDF đã sẵn sàng.',
  'Document chat requires selected PDFs': 'Chọn PDF hoặc chuyển sang hội thoại nghiên cứu.',
  'Document must be attached to research': 'Hãy gắn PDF vào nghiên cứu trước khi chọn nguồn này.',
  'Document no longer attached': 'PDF đã bị bỏ gắn khỏi nghiên cứu. Hãy chọn lại nguồn.',
  'Document detached during chat':
    'PDF bị bỏ gắn khi đang trả lời. Hãy kiểm tra nguồn trước khi thử lại.',
  'Source changed during chat; retry manually':
    'Nguồn thay đổi trong lúc trả lời. Hãy kiểm tra trước khi thử lại.',
  'Chat capacity busy; retry manually': 'Hệ thống đang xử lý hội thoại khác. Vui lòng thử lại sau.',
  'This message was already submitted; reload messages':
    'Lượt này đã được gửi. Hãy kiểm tra lịch sử, không gửi câu hỏi trùng.',
  'Chat provider failed or timed out; retry manually':
    'Chưa thể nhận câu trả lời. Hãy kiểm tra lịch sử trước khi thử lại.',
  'Citation integrity check failed': 'Không xác minh được trích dẫn; câu trả lời chưa được lưu.',
  'Only application/pdf is supported': 'Chỉ hỗ trợ tệp PDF.',
  'PDF exceeds size limit': 'PDF vượt giới hạn dung lượng tải lên.',
  'Workspace storage quota reached': 'Kho lưu trữ đã đạt giới hạn.',
  'Invalid PDF signature': 'Tệp không có định dạng PDF hợp lệ.',
};
import { apiRequest } from './apiClient';
export async function knowledgeApi(path, options = {}) {
  try {
    const result = await apiRequest(`/api${path}`, options);
    return options.file ? result.blob : result;
  } catch (error) {
    if (messages[error.message]) error.message = messages[error.message];
    throw error;
  }
}
export const resourcePath = (type, id) => `/${type}/${encodeURIComponent(id)}`;
