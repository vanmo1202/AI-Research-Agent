import { useCallback, useEffect, useState } from 'react';
import { knowledgeApi } from '../services/knowledgeApi';
export default function useKnowledge(path, poll = false) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ path, loading: true, data: null, error: null });
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    setState((s) =>
      s.path === path
        ? { ...s, loading: !s.data, error: null }
        : { path, loading: true, data: null, error: null },
    );
    async function load() {
      if (!path) {
        setState({ path, loading: false, data: null, error: null });
        return;
      }
      try {
        const data = await knowledgeApi(path, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setState({ path, loading: false, data, error: null });
        if (typeof poll === 'function' ? poll(data) : poll) timer = setTimeout(load, 2200);
      } catch (error) {
        if (!controller.signal.aborted) setState((s) => ({ ...s, loading: false, error }));
      }
    }
    load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [path, poll, revision]);
  return state.path === path
    ? { ...state, reload }
    : { loading: true, data: null, error: null, reload };
}

export const pollDocuments = (data) =>
  (Array.isArray(data) ? data : [data]).some((d) => ['pending', 'processing'].includes(d?.status));
export const pollMessages = (data) => data?.some((message) => message.status === 'pending');
