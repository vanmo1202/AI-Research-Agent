import { useState } from 'react';
import { Check, Cpu, Globe2, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { checkHealth } from '../services/researchApi';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ErrorMessage from '../components/ui/ErrorMessage';
export default function SettingsPage() {
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  async function checkConnection() {
    setBusy(true);
    setError(null);
    setHealth(null);
    try {
      setHealth(await checkHealth(AbortSignal.timeout(10000)));
    } catch (error) {
      setError(
        error.name === 'TimeoutError' ? new Error('Backend không phản hồi trong 10 giây.') : error,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-enter">
      <div className="page-intro">
        <div>
          <p className="eyebrow">WORKSPACE SETTINGS</p>
          <h1>Cài đặt không gian nghiên cứu</h1>
          <p>Thông tin kết nối và hồ sơ cho phiên bản demo của bạn.</p>
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
              Hồ sơ demo
            </h2>
            <Badge tone="neutral">Demo</Badge>
          </div>
          <div className="settings-profile">
            <span className="avatar large">N</span>
            <div>
              <h3>Nguyễn Minh Anh</h3>
              <p>Sinh viên · Research workspace</p>
            </div>
          </div>
          <p>
            Phiên bản hiện tại sử dụng hồ sơ minh họa, chưa có đăng nhập hoặc quản lý tài khoản.
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
              Research engine
            </h2>
          </div>
          <div className="engine-grid">
            <div>
              <strong>Research Planning</strong>
              <p>LLM hoặc Mock LLM theo cấu hình backend.</p>
            </div>
            <div>
              <strong>Search & Collect</strong>
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
