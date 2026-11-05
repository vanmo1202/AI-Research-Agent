import CitationCard from './CitationCard';
export default function ChatMessage({ message }) {
  return (
    <article className={`chat-message ${message.role}`}>
      <strong>{message.role === 'user' ? 'Bạn' : 'Trợ lý nghiên cứu'}</strong>
      <p className="chat-content">
        {message.status === 'pending'
          ? 'Đang tìm nguồn và trả lời...'
          : message.content || 'Chưa thể trả lời.'}
      </p>
      {message.status === 'failed' && (
        <p role="status">
          Lượt trả lời thất bại. Bạn có thể gửi lại câu hỏi bằng thao tác thủ công.
        </p>
      )}
      {(message.citations || []).map((citation, i) => (
        <CitationCard key={`${citation.referenceId}-${i}`} citation={citation} />
      ))}
    </article>
  );
}
