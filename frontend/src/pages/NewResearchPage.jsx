import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { createResearch } from '../services/researchApi';
import { createRun, runUrl, stages } from '../services/runApi';
import Button from '../components/ui/Button';
import ErrorMessage from '../components/ui/ErrorMessage';
import PageHeader from '../components/ui/PageHeader';
export default function NewResearchPage({ embedded = false }) {
  const navigate = useNavigate(),
    lock = useRef(false),
    attempt = useRef(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [requestId, setRequestId] = useState(null);
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const form = Object.fromEntries(new FormData(event.currentTarget));
    if (!requestId && (!form.topic?.trim() || !form.goal?.trim())) {
      setError(new Error('Nhập chủ đề và mục tiêu nghiên cứu.'));
      return;
    }
    if (!requestId) attempt.current = null;
    attempt.current ||= {
      key: crypto.randomUUID(),
      options: {
        language: form.language,
        numberOfSources: Number(form.numberOfSources),
        searchMore: form.searchMore === 'on',
        orchestration: 'backend',
      },
    };
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      // A successful request is retained if the subsequent run POST has an ambiguous outcome.
      let id = requestId;
      if (!id) {
        const result = await createResearch({
          topic: form.topic.trim(),
          goal: form.goal.trim(),
          scope: form.scope.trim(),
          outputLength: form.outputLength,
          executionMode: 'async',
        });
        id = result.requestId;
        setRequestId(id);
      }
      const run = await createRun(id, attempt.current.options, attempt.current.key);
      navigate(runUrl(id, run.runId));
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className={`page-enter os-page ${embedded ? 'ref-embedded-form' : ''}`}>
      {!embedded && (
        <PageHeader
          eyebrow="RESEARCH / NEW"
          title="Bắt đầu một nghiên cứu"
          description="Từ câu hỏi cụ thể đến báo cáo có bằng chứng, qua sáu giai đoạn."
        />
      )}
      <div className="os-split">
        <section className="os-panel">
          <form className="os-form" onSubmit={submit}>
            <div className="os-section-title">
              <span>01</span>
              <div>
                <h2>Câu hỏi của bạn</h2>
                <p>Xác định rõ điều bạn muốn khám phá.</p>
              </div>
            </div>
            <fieldset disabled={busy || !!requestId} className="os-fieldset">
              <label>
                Chủ đề nghiên cứu
                <input
                  name="topic"
                  required
                  placeholder="Ví dụ: Lưu trữ năng lượng tái tạo tại Việt Nam"
                />
              </label>
              <label>
                Mục tiêu
                <textarea
                  name="goal"
                  required
                  rows={3}
                  placeholder="Bạn muốn trả lời câu hỏi nào? Kết quả phục vụ mục đích gì?"
                />
              </label>
              <label>
                Phạm vi <small>Không bắt buộc</small>
                <textarea
                  name="scope"
                  rows={2}
                  placeholder="Giai đoạn, khu vực hoặc giới hạn nghiên cứu"
                />
              </label>
              <div className="os-section-title">
                <span>02</span>
                <div>
                  <h2>Cấu hình nghiên cứu</h2>
                  <p>Chọn ngôn ngữ và mức độ thu thập.</p>
                </div>
              </div>
              <div className="os-form-grid">
                <label>
                  Ngôn ngữ
                  <select name="language">
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label>
                  Số nguồn cần tìm
                  <input
                    type="number"
                    name="numberOfSources"
                    min={1}
                    max={30}
                    defaultValue={12}
                    required
                  />
                </label>
                <label>
                  Độ dài báo cáo
                  <select name="outputLength" defaultValue="medium">
                    <option value="short">Ngắn</option>
                    <option value="medium">Trung bình</option>
                    <option value="long">Dài</option>
                  </select>
                </label>
              </div>
              <label className="knowledge-checkbox">
                <input type="checkbox" name="searchMore" defaultChecked />
                Tìm kiếm bổ sung khi còn thiếu bằng chứng
              </label>
            </fieldset>
            <ErrorMessage error={error} />
            {requestId && (
              <p role="status">
                Đã lưu yêu cầu <code>{requestId}</code>. Nếu chưa nhận được phản hồi, thử lại sẽ
                dùng cùng mã tạo run. <Link to="/researches">Kiểm tra lịch sử</Link>
              </p>
            )}
            {error && !requestId && (
              <p>
                Yêu cầu tạo nghiên cứu chưa có phản hồi xác nhận. Kiểm tra lịch sử trước khi gửi lại
                để tránh trùng yêu cầu.
              </p>
            )}
            <div className="os-form-footer">
              <span>Báo cáo và trích dẫn sẽ được lưu tự động.</span>
              <Button type="submit" loading={busy}>
                {requestId ? 'Thử lại tạo run' : 'Bắt đầu nghiên cứu'}
                <ArrowRight size={17} />
              </Button>
            </div>
          </form>
        </section>
        <aside className="os-aside">
          <p className="os-overline">QUY TRÌNH NGHIÊN CỨU</p>
          <h2>
            Một quy trình.
            <br />
            Sáu giai đoạn rõ ràng.
          </h2>
          <ol className="os-method">
            {stages.map(([key, name, label], i) => (
              <li key={key}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{name}</strong>
                  <p>{label}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="os-note">
            <CheckCircle2 size={18} />
            Bạn có thể rời trang và quay lại theo dõi bất cứ lúc nào sau khi có Run ID.
          </p>
        </aside>
      </div>
    </div>
  );
}
