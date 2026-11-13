import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Workflow, Plus } from 'lucide-react';
import useKnowledge from '../hooks/useKnowledge';
import { knowledgeApi } from '../services/knowledgeApi';
import PageHeader from '../components/ui/PageHeader';
import WorkspaceDialog from '../components/workspace/WorkspaceDialog';
import Button from '../components/ui/Button';
import ErrorMessage from '../components/ui/ErrorMessage';
import { languageLabel } from '../utils/displayLabels';
export default function SchedulesPage({ automation = false }) {
  const result = useKnowledge('/research/schedules'),
    research = useKnowledge('/research');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [notice, setNotice] = useState(''),
    lock = useRef(false);
  async function act(body, id) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      await knowledgeApi(`/research/schedules${id ? `/${encodeURIComponent(id)}` : ''}`, {
        method: id ? 'PATCH' : 'POST',
        body,
      });
      setNotice(
        id
          ? 'Đã lưu trạng thái lịch.'
          : 'Đã tạo lịch ở trạng thái tắt. Bật lịch khi tự động hóa đã được cấu hình.',
      );
      if (!id) setCreating(false);
      result.reload();
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const creationForm = (
    <section className="os-panel">
      <h2>Tạo lịch nghiên cứu</h2>
      <ErrorMessage error={research.error || error} />
      <form
        className="os-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget));
          act({
            requestId: f.requestId,
            enabled: false,
            maxConcurrent: Number(f.maxConcurrent),
            options: {
              language: f.language,
              numberOfSources: Number(f.numberOfSources),
              searchMore: f.searchMore === 'on',
              orchestration: 'backend',
            },
          });
        }}
      >
        <label>
          Nghiên cứu
          <select name="requestId" required disabled={research.loading || !!research.error}>
            <option value="">Chọn nghiên cứu</option>
            {research.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.topic}
              </option>
            ))}
          </select>
        </label>
        <div className="os-form-grid">
          <label>
            Ngôn ngữ
            <select name="language">
              <option value="vi">Tiếng Việt</option>
              <option value="en">Tiếng Anh</option>
            </select>
          </label>
          <label>
            Số nguồn
            <input
              name="numberOfSources"
              type="number"
              min={1}
              max={30}
              defaultValue={12}
              required
            />
          </label>
        </div>
        <label>
          Số lượt chạy đồng thời tối đa
          <input name="maxConcurrent" type="number" min={1} max={3} defaultValue={1} required />
        </label>
        <label className="knowledge-checkbox">
          <input type="checkbox" name="searchMore" defaultChecked />
          Tìm thêm khi thiếu bằng chứng
        </label>
        <Button
          type="submit"
          loading={busy}
          disabled={
            !!result.error || research.loading || !!research.error || !research.data?.length
          }
        >
          Tạo lịch
        </Button>
        <p className="os-muted">
          Tạo tối đa 10 lịch mỗi tài khoản. Hạn mức và giới hạn chạy do máy chủ kiểm tra.
        </p>
      </form>
    </section>
  );

  return (
    <div className="page-enter os-page">
      <PageHeader
        eyebrow="TỰ ĐỘNG HÓA / WF05"
        title={automation ? 'Tự động hóa (n8n)' : 'Lịch nghiên cứu'}
        description="Quản lý lịch của tài khoản. Hệ thống tự điều phối các lần nghiên cứu."
      >
        {automation && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} />
            Tạo lịch chạy
          </Button>
        )}
      </PageHeader>
      {automation && (
        <section className="ref-card ref-panel-pad ref-automation-connection">
          <Workflow size={22} />
          <div>
            <h2>Kết nối n8n: Chưa có dữ liệu xác nhận</h2>
            <p>
              Chưa có API cung cấp trạng thái kết nối hoặc lịch sử thực thi n8n. Các lịch bên dưới
              được quản lý bởi máy chủ.
            </p>
          </div>
          <Link className="ref-secondary ref-btn-sm" to="/settings">
            Thông tin hệ thống
          </Link>
        </section>
      )}
      <p className="os-notice">
        Chưa hỗ trợ thay đổi chu kỳ, múi giờ, chỉnh sửa cấu hình hoặc xem lịch sử chạy. Cửa sổ lịch
        hiện tại là hằng ngày theo Asia/Ho_Chi_Minh; lịch chỉ chạy khi tự động hóa đã được triển khai
        và liên kết bởi người vận hành.
      </p>
      <div className={automation ? 'ref-automation-list' : 'os-split'}>
        <section className="os-panel">
          <div className="os-between">
            <h2>Lịch đã lưu</h2>
            <Button variant="secondary" onClick={result.reload}>
              Làm mới
            </Button>
          </div>
          <ErrorMessage error={result.error || error} />
          {notice && <p role="status">{notice}</p>}
          {result.loading ? (
            <p role="status">Đang tải lịch…</p>
          ) : !result.error && !result.data?.length ? (
            <div className="os-empty">
              <CalendarClock size={30} />
              <h3>Chưa có lịch nghiên cứu</h3>
              <p>Chọn một nghiên cứu đã lưu để tạo lịch.</p>
            </div>
          ) : (
            result.data?.map((s) => (
              <article className="os-schedule" key={s.scheduleId}>
                <div>
                  <h3>
                    {research.data?.find((r) => r.id === s.requestId)?.topic || 'Nghiên cứu đã lưu'}
                  </h3>
                  <code>{s.scheduleId}</code>
                  <p>
                    {s.enabled ? 'Đã bật' : 'Đã tắt'} · Tối đa {s.maxConcurrent} lượt chạy đồng thời
                  </p>
                  <p>
                    {languageLabel(s.options?.language)} · {s.options?.numberOfSources} nguồn
                  </p>
                  <Link to={`/research/${encodeURIComponent(s.requestId)}`}>Mở nghiên cứu</Link>
                </div>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => act({ enabled: !s.enabled }, s.scheduleId)}
                >
                  {s.enabled ? 'Tắt lịch' : 'Bật lịch'}
                </Button>
              </article>
            ))
          )}
        </section>
        {!automation && creationForm}
      </div>
      {automation && (
        <section className="ref-technical-workflows">
          <h2>Các luồng kỹ thuật WF01–WF05</h2>
          <p className="ref-small-note">
            Thông tin từ kiến trúc hiện có; không phải trạng thái đang chạy của n8n.
          </p>
          <div className="ref-tile-grid">
            {[
              [
                'WF01',
                'Nghiên cứu toàn diện',
                'Lập kế hoạch → Thu thập → Phân tích → Đánh giá → Biên soạn → Xác minh',
              ],
              ['WF02', 'Xử lý tài liệu', 'Quan sát trạng thái xử lý PDF của Backend/Worker'],
              ['WF03', 'Hội thoại nghiên cứu', 'Hội thoại với nguồn và trích dẫn được kiểm tra'],
              ['WF04', 'Bảo trì bộ nhớ', 'Tái kiểm tra nguồn bộ nhớ; không tự phê duyệt'],
              ['WF05', 'Nghiên cứu theo lịch', 'Điều phối lịch theo cửa sổ ngày Asia/Ho_Chi_Minh'],
            ].map(([id, name, detail]) => (
              <article className="ref-card ref-tile ref-technical-workflow" key={id}>
                <span className="ref-pill ref-running">{id}</span>
                <h3>{name}</h3>
                <p>{detail}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      {automation && creating && (
        <WorkspaceDialog title="Tạo lịch chạy tự động" onClose={() => setCreating(false)}>
          {creationForm}
        </WorkspaceDialog>
      )}
    </div>
  );
}
