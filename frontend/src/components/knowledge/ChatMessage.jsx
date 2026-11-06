import CitationCard from './CitationCard';
const stages = {
  planning: 'Đang hiểu câu hỏi và tạo truy vấn...',
  searching: 'Đang tìm Internet bằng Tavily...',
  reading: 'Đang đọc và lọc nội dung nguồn...',
  answering: 'Đang tổng hợp câu trả lời và kiểm tra trích dẫn...',
  validating: 'Đang xác minh trích dẫn và quyền truy cập...',
};
export default function ChatMessage({ message }) {
  return (
    <article className={`chat-message ${message.role}`}>
      <strong>{message.role === 'user' ? 'Bạn' : 'Trợ lý nghiên cứu'}</strong>
      <p className="chat-content">
        {message.status === 'pending'
          ? stages[message.research?.stage] || 'Đang tìm nguồn và trả lời...'
          : message.content || 'Chưa thể trả lời.'}
      </p>
      {message.research?.mode === 'auto' && message.role === 'assistant' && (
        <div className="ro-auto-research-note">
          {message.research.searchStatus === 'sources_ready' && (
            <p>
              {message.status === 'failed'
                ? 'Đã đọc nguồn web; bước trả lời chưa hoàn tất.'
                : 'Đã tìm Internet và kiểm tra nội dung nguồn.'}
            </p>
          )}
          {!message.research.searchStatus &&
            message.research.searched &&
            message.status === 'complete' &&
            message.citations?.length > 0 && <p>Đã tìm Internet và kiểm tra nội dung nguồn.</p>}
          {message.research.cached && <p>Dùng bản nguồn đã kiểm tra trong 30 phút gần đây.</p>}
          {message.research.mock && (
            <p>Chế độ mô phỏng: đây không phải kết quả nghiên cứu Internet thật.</p>
          )}
          {message.research.searchFailures?.map((failure) => (
            <p key={`${failure.code}-${failure.stage}`}>{failure.message}</p>
          ))}
          {!message.research.searchFailures?.length &&
            message.research.warnings?.includes('SEARCH_UNAVAILABLE') && (
              <p>Chưa thể tìm Internet. Câu trả lời chỉ dựa trên nguồn còn khả dụng.</p>
            )}
          {message.research.warnings?.includes('NO_RELEVANT_WEB_SOURCES') && (
            <p>Không tìm được nguồn web đủ phù hợp; không dùng kết quả sai chủ đề.</p>
          )}
        </div>
      )}
      {message.status === 'failed' && (
        <p role="status">
          {message.research?.error
            ? `Mã lỗi: ${message.research.error.code} · Bước: ${stages[message.research.failedStage] || 'Kiểm tra nguồn'}`
            : 'Lượt trả lời thất bại. Bạn có thể gửi lại câu hỏi bằng thao tác thủ công.'}
        </p>
      )}
      {(message.citations || []).map((citation, i) => (
        <CitationCard key={`${citation.referenceId}-${i}`} citation={citation} />
      ))}
    </article>
  );
}
