import { useAuth } from '../auth/AuthProvider';
import { useState, useRef, useEffect } from 'react';
import { Check, Cpu, Globe2, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { checkHealth } from '../services/researchApi';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ErrorMessage from '../components/ui/ErrorMessage';
export default function SettingsPage() {
  const { user } = useAuth();
  const pending = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  async function checkConnection() {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    setHealth(null);
    try {
      const result = await checkHealth(
        AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      );
      if (!controller.signal.aborted) setHealth(result);
    } catch (error) {
      if (controller.signal.aborted) return;
      setError(
        error.name === 'TimeoutError' ? new Error('Backend không phản hồi trong 10 giây.') : error,
      );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="page-enter">
      <div className="page-intro">
        <div>
          <p className="eyebrow">KHÔNG GIAN CÁ NHÂN</p>
          <h1>Cài đặt không gian nghiên cứu</h1>
          <p>Thông tin kết nối và hồ sơ tài khoản của bạn.</p>
        </div>
      </div>
      <div className="settings-grid">
        <Card className="settings-card">
          <div className="panel-heading">
            <h2>
              <span className="heading-icon blue">
                <Globe2 size={20} />
              </span>
              Kết nối backend
            </h2>
          </div>
          <p>Frontend sử dụng API thật của Node.js + Express.</p>
          <label htmlFor="api-url">API Base URL</label>
          <input id="api-url" readOnly value={API_BASE_URL} />
          <p className="field-hint">
            Thay đổi qua VITE_API_BASE_URL trong frontend/.env, sau đó restart Vite.
          </p>
          <Button onClick={checkConnection} loading={busy} variant="secondary">
            {!busy && <RefreshCw size={16} />}
            {busy ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
          </Button>
          {health && (
            <div className="connection-success" role="status">
              <Check size={18} />
              Backend đang hoạt động
            </div>
          )}
          <ErrorMessage error={error} />
        </Card>
        <Card className="settings-card">
          <div className="panel-heading">
            <h2>
              <span className="heading-icon violet">
                <UserRound size={20} />
              </span>
              Tài khoản của bạn
            </h2>
            <Badge tone="neutral">{user.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</Badge>
          </div>
          <div className="settings-profile">
            <span className="avatar large">{user.name.slice(0, 1).toLocaleUpperCase()}</span>
            <div>
              <h3>{user.name}</h3>
              <p>{user.email}</p>
            </div>
          </div>
          <p>
            Phiên đăng nhập được bảo vệ bằng cookie HttpOnly. Bạn có thể đổi mật khẩu và đăng xuất
            trong menu tài khoản.
          </p>
          <div className="settings-info">
            <ShieldCheck size={18} />
            <span>API keys chỉ được cấu hình tại backend.</span>
          </div>
        </Card>
        <Card className="settings-card settings-full">
          <div className="panel-heading">
            <h2>
              <span className="heading-icon teal">
                <Cpu size={20} />
              </span>
              Công cụ nghiên cứu
            </h2>
          </div>
          <div className="engine-grid">
            <div>
              <strong>Lập kế hoạch nghiên cứu</strong>
              <p>LLM hoặc Mock LLM theo cấu hình backend.</p>
            </div>
            <div>
              <strong>Tìm kiếm & Thu thập</strong>
              <p>Tavily hoặc Mock Search; provider hiển thị theo response.</p>
            </div>
            <div>
              <strong>SQLite persistence</strong>
              <p>Kế hoạch và nguồn tài liệu được lưu trên backend.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
