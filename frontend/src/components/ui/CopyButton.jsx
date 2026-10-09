import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
export default function CopyButton({ text, label = 'Sao chép' }) {
  const [state, setState] = useState('idle');
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
  }
  return (
    <span className="copy-control">
      <button type="button" className="icon-button" aria-label={label} title={label} onClick={copy}>
        {state === 'copied' ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <span className="sr-only" role="status">
        {state === 'copied'
          ? 'Đã sao chép'
          : state === 'failed'
            ? 'Không thể truy cập clipboard.'
            : ''}
      </span>
    </span>
  );
}
