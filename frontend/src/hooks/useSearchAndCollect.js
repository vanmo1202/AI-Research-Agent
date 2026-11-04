import { useEffect, useSyncExternalStore } from 'react';
import {
  collectionSnapshot,
  startCollection,
  subscribeCollection,
} from '../services/collectionTasks';

export default function useSearchAndCollect(request, plan, reload) {
  const id = request?.requestId;
  const state = useSyncExternalStore(subscribeCollection, () => collectionSnapshot(id));
  useEffect(() => {
    if (!id) return;
    reload?.();
    if (!state.busy) return;
    const timer = setInterval(() => reload?.(), 1800);
    return () => clearInterval(timer);
  }, [id, state, reload]);
  return { ...state, start: () => startCollection(id) };
}
