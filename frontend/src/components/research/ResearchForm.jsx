import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, AlignLeft, AlignJustify, BookOpen, RotateCcw, Sparkles } from 'lucide-react';
import Button from '../ui/Button';
import ErrorMessage from '../ui/ErrorMessage';
import { createResearch } from '../../services/researchApi';
import { rememberResearch } from '../../utils/researchStorage';

const defaults = { topic: '', goal: '', scope: '', outputLength: 'medium' };
const lengths = [
  { value: 'short', title: 'Ngắn', description: '~ 1–2 trang', icon: AlignLeft },
  { value: 'medium', title: 'Trung bình', description: '~ 3–5 trang', icon: AlignJustify },
  { value: 'long', title: 'Dài', description: '~ 8–10 trang', icon: BookOpen },
];
export default function ResearchForm() {
  const [values, setValues] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const lock = useRef(false);
  const navigate = useNavigate();
  function change(event) {
    setValues((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  }
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    if (!values.topic.trim() || !values.goal.trim()) {
      setError(new Error('Vui lòng nhập chủ đề và mục tiêu nghiên cứu.'));
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const input = {
        ...values,
        topic: values.topic.trim(),
        goal: values.goal.trim(),
        scope: values.scope.trim(),
      };
      const plan = await createResearch(input);
      rememberResearch({ ...input, requestId: plan.requestId, status: plan.status }, plan);
      navigate(`/research/${encodeURIComponent(plan.requestId)}`);
    } catch (error) {
      setError(error);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form className="research-form" onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy} className="form-fields">
        <div className="field-group">
          <div className="label-row">
            <label htmlFor="topic">
              Chủ đề <span aria-hidden="true">*</span>
            </label>
            <span className="character-count">{values.topic.length}/200</span>
          </div>
          <input
            id="topic"
            name="topic"
            required
            maxLength={200}
            value={values.topic}
            onChange={change}
            placeholder="Nhập chủ đề nghiên cứu của bạn..."
            aria-describedby="topic-hint"
          />
          <p id="topic-hint" className="field-hint">
            Ví dụ: Ứng dụng trí tuệ nhân tạo trong giáo dục đại học tại Việt Nam
          </p>
        </div>
        <div className="field-group">
          <div className="label-row">
            <label htmlFor="goal">
              Mục tiêu <span aria-hidden="true">*</span>
            </label>
            <span className="character-count">{values.goal.length}/500</span>
          </div>
          <textarea
            id="goal"
            name="goal"
            required
            maxLength={500}
            rows={3}
            value={values.goal}
            onChange={change}
            placeholder="Bạn muốn đạt được điều gì thông qua nghiên cứu này?"
            aria-describedby="goal-hint"
          />
          <p id="goal-hint" className="field-hint">
            Ví dụ: Phân tích thực trạng, đánh giá hiệu quả và đề xuất giải pháp ứng dụng AI.
          </p>
        </div>
        <div className="field-group">
          <div className="label-row">
            <label htmlFor="scope">
              Phạm vi <span className="optional-label">(tùy chọn)</span>
            </label>
            <span className="character-count">{values.scope.length}/500</span>
          </div>
          <textarea
            id="scope"
            name="scope"
            maxLength={500}
            rows={3}
            value={values.scope}
            onChange={change}
            placeholder="Giới hạn về thời gian, địa lý, lĩnh vực hoặc các khía cạnh cụ thể cần tập trung..."
            aria-describedby="scope-hint"
          />
          <p id="scope-hint" className="field-hint">
            Ví dụ: Tập trung vào Việt Nam trong giai đoạn 2020 – 2024.
          </p>
        </div>
        <fieldset className="length-fieldset">
          <legend>Độ dài đầu ra</legend>
          <div className="length-options">
            {lengths.map(({ icon: Icon, ...option }) => (
              <label
                className={`length-option ${values.outputLength === option.value ? 'selected' : ''}`}
                key={option.value}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="outputLength"
                  value={option.value}
                  checked={values.outputLength === option.value}
                  onChange={change}
                />
                <Icon size={23} strokeWidth={1.6} />
                <span>
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                </span>
                <span className="radio-mark" />
              </label>
            ))}
          </div>
          <p className="field-hint">
            Định hướng độ chi tiết của kế hoạch; số trang là gợi ý cho báo cáo sau này.
          </p>
        </fieldset>
      </fieldset>
      <ErrorMessage error={error}>
        {error?.requestId && (
          <p className="mt-2">
            Request ID: <code>{error.requestId}</code>
          </p>
        )}
      </ErrorMessage>
      <div className="form-actions">
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setValues(defaults);
            setError(null);
          }}
        >
          <RotateCcw size={16} />
          Xóa nội dung
        </Button>
        <Button type="submit" loading={busy}>
          {!busy && <Sparkles size={18} />}
          {busy ? 'Đang tạo kế hoạch...' : 'Tạo Research Plan'}
          {!busy && <ArrowRight size={17} />}
        </Button>
      </div>
      <p className="form-footnote">
        <span className="status-dot" /> Kế hoạch được lưu tự động để bạn tiếp tục bất cứ lúc nào.
      </p>
    </form>
  );
}
