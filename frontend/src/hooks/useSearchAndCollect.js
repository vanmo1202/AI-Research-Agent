import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  collectionSnapshot,
  startCollection,
  subscribeCollection,
} from '../services/collectionTasks';

export default function useSearchAndCollect(request, plan, reload) {
  const id = request?.requestId;
  const state = useSyncExternalStore(subscribeCollection, () => collectionSnapshot(id));
  const previous = useRef(null);
  useEffect(() => {
    if (!id) return;
    const changed = previous.current?.id === id && previous.current.busy !== state.busy;
    previous.current = { id, busy: state.busy };
    if (changed) reload?.();
    if (!state.busy) return;
    const timer = setInterval(() => reload?.(), 1800);
    return () => clearInterval(timer);
  }, [id, state, reload]);
  return { ...state, start: () => startCollection(id) };
}
