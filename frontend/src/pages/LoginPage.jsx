import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import '../auth/auth.css';
export default function LoginPage({ register = false }) {
  const { user, loading, expired, signIn } = useAuth(),
    location = useLocation(),
    navigate = useNavigate();
  const [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (loading) return <p role="status">Đang kiểm tra phiên…</p>;
  const from = location.state?.from;
  const destination =
    typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';
  if (user) return <Navigate to={destination} replace />;
  async function submit(event) {
    event.preventDefault();
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (register && data.password !== data.confirm) {
      setError('Mật khẩu xác nhận chưa khớp.');
      return;
    }
    setBusy(true);
    try {
      await signIn(register ? 'register' : 'login', {
        email: data.email,
        password: data.password,
        ...(register ? { name: data.name } : {}),
      });
      navigate(destination, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link to="/" className="auth-brand">
          <BookOpen /> ResearchOS
        </Link>
        <div>
          <span>KHÔNG GIAN NGHIÊN CỨU CỦA BẠN</span>
          <h1>
            Từ câu hỏi hay
            <br />
            đến tri thức có căn cứ.
          </h1>
          <p>Nghiên cứu, tài liệu và những cuộc hội thoại — cùng một không gian riêng tư.</p>
          <p>
            <ShieldCheck size={20} /> Dữ liệu được phân quyền theo tài khoản
          </p>
        </div>
        <small>ResearchOS · AI Research Companion</small>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <BookOpen color="#3656ED" size={32} />
          <h1>{register ? 'Tạo tài khoản ResearchOS' : 'Chào mừng trở lại'}</h1>
          <p>
            {register
              ? 'Bắt đầu hành trình nghiên cứu của bạn.'
              : 'Đăng nhập để tiếp tục nghiên cứu của bạn.'}
          </p>
          {expired && <p role="status">Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</p>}
          <form onSubmit={submit}>
            {register && (
              <label>
                Họ và tên
                <input name="name" autoComplete="name" required maxLength={100} />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="ban@example.com"
              />
            </label>
            <label>
              Mật khẩu
              <div className="auth-password">
                <input
                  name="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  required
                  minLength={register ? 12 : 1}
                  maxLength={128}
                />
                <button
                  type="button"
                  aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {register && (
              <>
                <small>Mật khẩu từ 12 đến 128 ký tự. Nên dùng một cụm từ dài, khó đoán.</small>
                <label>
                  Xác nhận mật khẩu
                  <input
                    name="confirm"
                    type={visible ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                  />
                </label>
              </>
            )}
            {error && (
              <p role="alert" className="auth-error">
                {error}
              </p>
            )}
            <button className="auth-submit" disabled={busy}>
              {busy ? 'Đang xử lý…' : register ? 'Tạo tài khoản' : 'Đăng nhập'}
            </button>
          </form>
          <p>
            {register ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
            <Link state={{ from: destination }} to={register ? '/login' : '/register'}>
              {register ? 'Đăng nhập' : 'Đăng ký'}
            </Link>
          </p>
          <small>Phiên đăng nhập được ghi nhớ an toàn bằng cookie.</small>
        </div>
      </section>
    </main>
  );
}
