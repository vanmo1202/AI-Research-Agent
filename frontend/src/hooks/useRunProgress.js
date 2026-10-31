import { useEffect, useState } from 'react';
import { api, runPath, terminal } from '../services/runApi';
export default function useRunProgress(requestId, runId) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer,
      attempts = 0,
      failures = 0;
    setData(null);
    setError('');
    async function poll() {
      try {
        const progress = await api(runPath(requestId, runId), { signal: controller.signal });
        if (controller.signal.aborted) return;
        setData(progress);
        setError('');
        failures = 0;
        if (terminal.includes(progress.status)) return;
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e.message);
        failures++;
      }
      if (++attempts >= 240 || failures >= 6) {
        setError('Đã tạm dừng theo dõi tự động. Nhấn Kết nối lại để tiếp tục.');
        return;
      }
      timer = setTimeout(
        poll,
        Math.min(15000, 1500 * 1.3 ** (failures || Math.floor(attempts / 12))),
      );
    }
    poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [requestId, runId, revision]);
  return { data, error, reconnect: () => setRevision((v) => v + 1) };
}
