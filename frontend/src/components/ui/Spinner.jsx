import { LoaderCircle } from 'lucide-react';
export default function Spinner({ label = 'Đang tải…', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} role="status">
      <LoaderCircle size={18} className="animate-spin shrink-0" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
