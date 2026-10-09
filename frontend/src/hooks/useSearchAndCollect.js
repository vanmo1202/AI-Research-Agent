import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchAndCollect } from '../services/researchApi';
import { rememberResearch } from '../utils/researchStorage';

export default function useSearchAndCollect(request, plan, reload) {
  const navigate = useNavigate();
  const lock = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function start() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await searchAndCollect(request.requestId);
      rememberResearch({ ...request, status: result.status }, plan, result);
      if (mounted.current) {
        navigate(`/research/${encodeURIComponent(request.requestId)}/sources`);
        reload?.();
      }
    } catch (error) {
      if (mounted.current) {
        setError(error);
        reload?.();
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { start, busy, error };
}
