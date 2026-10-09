import { CircleAlert } from 'lucide-react';
export default function ErrorMessage({ error, children }) {
  if (!error) return null;
  return (
    <div className="error-message" role="alert">
      <CircleAlert size={20} className="shrink-0" />
      <div>
        <p>{error.message || error}</p>
        {children}
      </div>
    </div>
  );
}
