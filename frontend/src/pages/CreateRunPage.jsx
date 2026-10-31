import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/runApi';
export default function CreateRunPage() {
  const navigate = useNavigate(),
    pending = useRef(false),
    requestId = useRef(null),
    idempotencyKey = useRef(crypto.randomUUID());
  const [form, setForm] = useState({
    topic: '',
    goal: '',
    scope: '',
    outputLength: 'medium',
    language: 'vi',
    numberOfSources: 12,
    searchMore: true,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const change = (e) =>
    setForm((v) => ({
      ...v,
      [e.target.name]:
        e.target.type === 'checkbox'
          ? e.target.checked
          : e.target.type === 'number'
            ? Number(e.target.value)
            : e.target.value,
    }));
  async function submit(e) {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (!requestId.current)
        requestId.current = (
          await api('', { body: { ...form, executionMode: 'async' } })
        ).requestId;
      const run = await api(`/${requestId.current}/runs`, {
        body: form,
        key: idempotencyKey.current,
      });
      navigate(`/research/${run.requestId}/runs/${run.runId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="flow-v2">
      <header>
        <small>NGHIÊN CỨU MỚI</small>
        <h1>Bạn muốn tìm hiểu điều gì?</h1>
        <p>Đặt mục tiêu rõ ràng để thu thập bằng chứng phù hợp.</p>
      </header>
      <form className="flow-panel flow-form" onSubmit={submit}>
        {error && <p role="alert">{error}</p>}
        <fieldset disabled={busy || !!requestId.current}>
          <label>
            Chủ đề
            <input required maxLength={1000} name="topic" value={form.topic} onChange={change} />
          </label>
          <label>
            Mục tiêu
            <textarea required maxLength={4000} name="goal" value={form.goal} onChange={change} />
          </label>
          <label>
            Phạm vi
            <textarea maxLength={4000} name="scope" value={form.scope} onChange={change} />
          </label>
          <div className="flow-grid">
            <label>
              Độ dài
              <select name="outputLength" value={form.outputLength} onChange={change}>
                <option value="short">Ngắn</option>
                <option value="medium">Trung bình</option>
                <option value="long">Chi tiết</option>
              </select>
            </label>
            <label>
              Ngôn ngữ
              <select name="language" value={form.language} onChange={change}>
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              Số nguồn tối đa
              <input
                type="number"
                min="1"
                max="30"
                name="numberOfSources"
                value={form.numberOfSources}
                onChange={change}
              />
            </label>
          </div>
          <label>
            <input type="checkbox" name="searchMore" checked={form.searchMore} onChange={change} />{' '}
            Tìm thêm khi thiếu bằng chứng (tối đa 2 vòng)
          </label>
        </fieldset>
        <button className="flow-primary" disabled={busy}>
          {busy ? 'Đang tạo…' : requestId.current ? 'Thử tạo lại lần chạy' : 'Bắt đầu nghiên cứu'}
        </button>
      </form>
    </div>
  );
}
