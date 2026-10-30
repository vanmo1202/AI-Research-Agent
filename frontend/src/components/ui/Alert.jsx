import { AlertTriangle } from 'lucide-react';
export default function Alert({ title, children, action }) {
  return (
    <section className="notice-alert" role="status" aria-label={title}>
      <AlertTriangle size={22} aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        {children}
        {action && <div className="alert-action">{action}</div>}
      </div>
    </section>
  );
}
