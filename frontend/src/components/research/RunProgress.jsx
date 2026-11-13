import { AlertTriangle, Check, Square } from 'lucide-react';
import { stages } from '../../services/runApi';
import Button from '../ui/Button';

const incompleteQuality = ['insufficient', 'unavailable', 'conflicting', 'unverified'];

export default function RunProgress({ progress, disabled, onAction }) {
  return (
    <section className="os-panel os-progress">
      <div className="os-between">
        <h2>{stages.find(([key]) => key === progress.currentStage)?.[2] || 'Tiến trình'}</h2>
        <strong>{progress.percent}%</strong>
      </div>
      <progress aria-label="Tiến độ nghiên cứu" max={100} value={progress.percent} />
      <p className="os-muted">
        Tiến độ thực thi các giai đoạn, không phải tỷ lệ trích dẫn đã xác minh. Partial là trạng
        thái đã dừng và còn thiếu điều kiện chất lượng.
      </p>
      <ol className="os-stage-list" aria-label="Sáu giai đoạn nghiên cứu">
        {stages.map(([key, name, label], i) => {
          const current = progress.currentStage === key;
          const done = progress.completedStages?.includes(key);
          const lacking = incompleteQuality.includes(progress.stageQuality?.[key]);
          return (
            <li
              key={key}
              data-current={current}
              data-done={done && !lacking}
              aria-current={current ? 'step' : undefined}
            >
              <span>
                {lacking ? <AlertTriangle size={16} /> : done ? <Check size={16} /> : i + 1}
              </span>
              <strong>{name}</strong>
              <small>{label}</small>
              {progress.stageQuality?.[key] && (
                <small>Chất lượng: {progress.stageQuality[key]}</small>
              )}
              {current && (
                <small>
                  {progress.status === 'running' || progress.status === 'queued'
                    ? 'Đang xử lý'
                    : 'Đã dừng tại đây'}
                </small>
              )}
            </li>
          );
        })}
      </ol>
      <div className="os-between">
        <p className="os-muted">
          {progress.sourceCount} nguồn · {progress.evidenceCount} bằng chứng · Vòng{' '}
          {progress.currentRound ?? 0}
        </p>
        <div className="knowledge-actions">
          {['queued', 'running'].includes(progress.status) && (
            <Button variant="secondary" disabled={disabled} onClick={() => onAction('cancel')}>
              <Square size={14} />
              Hủy nghiên cứu
            </Button>
          )}
          {['failed', 'partial'].includes(progress.status) && (
            <Button disabled={disabled} onClick={() => onAction('retry')}>
              Thử lại giai đoạn lỗi
            </Button>
          )}
        </div>
      </div>
      {progress.status === 'partial' && (
        <p className="os-notice">
          Nghiên cứu hoàn thành một phần. Hãy kiểm tra khoảng trống bằng chứng và xác minh báo cáo
          trước khi sử dụng.
        </p>
      )}
      {progress.lastError && (
        <p role="alert" className="os-notice">
          {progress.lastError.code}: {progress.lastError.message}
        </p>
      )}
      {progress.orchestration === 'n8n' && (
        <p className="os-notice">
          Run này do n8n điều phối. Tiến trình phụ thuộc kết nối automation của hệ thống.
        </p>
      )}
    </section>
  );
}
