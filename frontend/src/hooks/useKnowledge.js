import { useCallback, useEffect, useState } from 'react';
import { knowledgeApi } from '../services/knowledgeApi';
export default function useKnowledge(path, poll = false) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ path, loading: true, data: null, error: null });
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timer,
      count = 0,
      failures = 0;
    setState((s) =>
      s.path === path
        ? { ...s, loading: !s.data, error: null, paused: false }
        : { path, loading: true, data: null, error: null, paused: false },
    );
    function schedule(delay) {
      if (++count >= 240) {
        setState((s) => ({ ...s, paused: true }));
        return;
      }
      timer = setTimeout(load, delay);
    }
    async function load() {
      if (!path) {
        setState({ path, loading: false, data: null, error: null });
        return;
      }
      try {
        const data = await knowledgeApi(path, { signal: controller.signal });
        if (controller.signal.aborted) return;
        failures = 0;
        setState({ path, loading: false, data, error: null, paused: false });
        if (typeof poll === 'function' ? poll(data) : poll)
          schedule(document.hidden ? 15000 : Math.min(10000, 2200 + count * 100));
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((s) => ({ ...s, loading: false, error }));
        if (poll && ![401, 403, 404].includes(error.status) && ++failures <= 4)
          schedule(Math.min(30000, 2000 * 2 ** failures));
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
