import { useEffect, useState } from 'react';
import { getResearch, getSources } from '../services/researchApi';
import { rememberResearch } from '../utils/researchStorage';

export default function useResearch(requestId, withSources = false) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    setState(current => current.data?.request?.requestId === requestId ? { ...current, error: null } : { loading: true, data: null, error: null });
    async function load() {
      try {
        const [plan, collection] = await Promise.all([
          getResearch(requestId, controller.signal),
          withSources ? getSources(requestId, controller.signal) : Promise.resolve(null),
        ]);
        if (controller.signal.aborted) return;
        setState({ loading: false, data: { ...plan, collection }, error: null });
        rememberResearch(plan.request, plan, collection);
        // Sau refresh, theo dõi công việc đang chạy mà không gửi lại POST.
        if (['planning', 'searching', 'translating', 'analyzing'].includes(plan.request.status)) timer = setTimeout(load, 1800);
      } catch (error) {
        if (!controller.signal.aborted) setState({ loading: false, data: null, error });
      }
    }
    load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [requestId, withSources, revision]);
  return { ...state, reload: () => setRevision((value) => value + 1) };
}
