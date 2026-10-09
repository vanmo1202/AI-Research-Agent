import { useEffect, useState } from 'react';
import { getHistory, subscribeHistory } from '../utils/researchStorage';

export default function useResearchHistory() {
  const [history, setHistory] = useState(getHistory);
  useEffect(() => subscribeHistory(() => setHistory(getHistory())), []);
  return history;
}
