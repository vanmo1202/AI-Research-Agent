import useKnowledge from '../../hooks/useKnowledge';
import { accountActivity } from './activity';
import ActivityList from './ActivityList';
import ErrorMessage from '../ui/ErrorMessage';
export default function WorkspaceNotifications() {
  const research = useKnowledge('/research'),
    docs = useKnowledge('/documents'),
    chats = useKnowledge('/chats'),
    memories = useKnowledge('/memories');
  const items = accountActivity({
    researches: research.data || [],
    documents: docs.data || [],
    chats: chats.data || [],
    memories: memories.data || [],
  });
  return (
    <>
      <p className="ref-small-note">
        Hoạt động từ dữ liệu tài khoản. Chưa có dịch vụ thông báo riêng hoặc trạng thái đã đọc.
      </p>
      <ErrorMessage error={research.error || docs.error || chats.error || memories.error} />
      {research.loading || docs.loading || chats.loading || memories.loading ? (
        <p role="status">Đang tải hoạt động…</p>
      ) : (
        <ActivityList
          items={items.slice(0, 6)}
          unavailable={!!(research.error || docs.error || chats.error || memories.error)}
        />
      )}
    </>
  );
}
