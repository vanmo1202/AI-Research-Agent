const HISTORY_KEY = 'aiResearch:history';
const LAST_ID_KEY = 'aiResearch:lastRequestId';
const LAST_RESEARCH_KEY = 'aiResearch:lastResearch';
const CHANGE_EVENT = 'aiResearch:updated';

export function getHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(value)
      ? value.filter(
          (item) => typeof item?.requestId === 'string' && typeof item?.topic === 'string',
        )
      : [];
  } catch {
    return [];
  }
}
export function getLastRequestId() {
  try {
    return localStorage.getItem(LAST_ID_KEY) || '';
  } catch {
    return '';
  }
}
// Chỉ lưu metadata để điều hướng; nội dung result luôn tải lại từ SQLite qua API.
export function rememberResearch(request, plan = {}, collection) {
  try {
    const history = getHistory();
    const previous = history.find((item) => item.requestId === request.requestId);
    const entry = {
      ...previous,
      requestId: request.requestId,
      topic: request.topic,
      status: request.status,
      createdAt: request.createdAt || previous?.createdAt || new Date().toISOString(),
      updatedAt: request.updatedAt || new Date().toISOString(),
      questionCount: plan.researchQuestions?.length ?? previous?.questionCount ?? 0,
      queryCount: plan.searchQueries?.length ?? previous?.queryCount ?? 0,
      ...(collection ? { sourceCount: collection.sourceCount } : {}),
    };
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(
        [entry, ...history.filter((item) => item.requestId !== entry.requestId)].slice(0, 20),
      ),
    );
    localStorage.setItem(LAST_ID_KEY, entry.requestId);
    localStorage.setItem(LAST_RESEARCH_KEY, JSON.stringify(entry));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* Chế độ private/quota có thể chặn storage; API vẫn hoạt động. */
  }
}
export function subscribeHistory(callback) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}
