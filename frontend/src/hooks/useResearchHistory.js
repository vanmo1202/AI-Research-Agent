import useKnowledge from './useKnowledge';
// Navigation metadata is loaded from the authenticated server, never a local business store.
export default function useResearchHistory() {
  const result = useKnowledge('/research');
  return (result.data || []).map((r) => ({
    requestId: r.id,
    topic: r.topic,
    status: r.runStatus || r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    latestRunId: r.latestRunId,
  }));
}
