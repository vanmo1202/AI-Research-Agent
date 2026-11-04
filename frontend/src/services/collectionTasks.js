import { getResearch, searchAndCollect } from './researchApi';

// In-memory only: refresh never restores an instruction to POST.
const tasks = new Map();
const listeners = new Set();
const idle = Object.freeze({ busy: false, error: null });
export const collectionSnapshot = (id) => tasks.get(id) || idle;
export function subscribeCollection(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function publish(id, state) {
  tasks.set(id, state);
  listeners.forEach((listener) => listener());
}
export function startCollection(id, freshPlan = false) {
  if (!id || collectionSnapshot(id).busy) return;
  publish(id, { busy: true, error: null });
  // Called only from submit/click handlers, never from a mount effect.
  void (async () => {
    try {
      if (!freshPlan) {
        const { request, researchQuestions, searchQueries } = await getResearch(id);
        if (
          !['planned', 'failed', 'collected'].includes(request.status) ||
          !researchQuestions.length ||
          !searchQueries.length
        ) {
          throw new Error(
            'Trạng thái chưa cho phép thu thập. Hãy kiểm tra lại trạng thái backend.',
          );
        }
      }
      await searchAndCollect(id);
      publish(id, { busy: false, error: null });
    } catch (error) {
      publish(id, { busy: false, error });
    }
  })();
}
