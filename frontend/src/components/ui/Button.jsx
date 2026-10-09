import { Link } from 'react-router-dom';
import Spinner from './Spinner';
export default function Button({
  children,
  variant = 'primary',
  className = '',
  to,
  loading = false,
  disabled = false,
  ...props
}) {
  const style = `button button-${variant} ${className}`;
  if (to)
    return (
      <Link to={to} className={style} {...props}>
        {children}
      </Link>
    );
  return (
    <button
      type="button"
      className={style}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
