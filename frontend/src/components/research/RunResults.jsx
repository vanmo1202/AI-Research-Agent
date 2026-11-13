import { Download, ExternalLink } from 'lucide-react';
import { formatDate, safeExternalUrl } from '../../utils/format';
import { describeResearchValue } from '../../utils/researchDisplay';
import { coverageLabel, statusLabel, translationLabel } from '../../utils/displayLabels';
import Button from '../ui/Button';
import ErrorMessage from '../ui/ErrorMessage';
import ReportMarkdown from './ReportMarkdown';

function sourceStatusLabel(source) {
  if (source.sourceStatus === 'accepted') return 'Nguồn được chấp nhận';
  if (source.sourceStatus === 'inaccessible') return 'Nguồn không truy cập được';
  if (source.provider === 'mock' || /example\.(com|org|net)\/mock/.test(source.url || '')) {
    return 'CẢNH BÁO: Nguồn mô phỏng từ run cũ, không dùng làm bằng chứng';
  }
  return 'Nguồn chưa xác minh';
}

export function RunSources({ result }) {
  return (
    <>
      <ErrorMessage error={result.error} />
      {result.loading ? (
        <p role="status">Đang tải nguồn…</p>
      ) : !result.error && !result.data?.length ? (
        <div className="os-empty">
          <h3>Chưa có nguồn được thu thập</h3>
          <p>Nguồn sẽ xuất hiện khi giai đoạn Thu thập nguồn lưu kết quả.</p>
        </div>
      ) : (
        result.data?.map((source, i) => {
          const url = source.canonicalUrl || source.url;
          const href = safeExternalUrl(url);
          return (
            <article className="os-source" key={source.id}>
              <span className="os-overline">NGUỒN {i + 1}</span>
              <h3>{source.title || source.url || source.id}</h3>
              <small>{sourceStatusLabel(source)}</small>
              <p>{url}</p>
              <p>{(source.display_content_vi || source.original_content || '').slice(0, 600)}</p>
              <small>
                {source.provider} · {source.language || '—'} ·{' '}
                {translationLabel(source.translation_status) || 'Chưa dịch'} ·{' '}
                {formatDate(source.collected_at)}
              </small>
              {href && (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  Mở nguồn <ExternalLink size={14} />
                </a>
              )}
            </article>
          );
        })
      )}
    </>
  );
}

export function RunEvidence({ result, sources }) {
  return (
    <>
      <ErrorMessage error={result.error} />
      {result.loading ? (
        <p role="status">Đang tải bằng chứng…</p>
      ) : (
        result.data && (
          <>
            <p className="os-notice">
              Độ phủ: {coverageLabel(result.data.coverage_status) || 'Chưa đánh giá'}
            </p>
            {result.data.gaps?.length > 0 && (
              <section className="os-gaps">
                <h3>Khoảng trống bằng chứng</h3>
                <ul>
                  {result.data.gaps.map((gap, i) => (
                    <li key={i}>{describeResearchValue(gap)}</li>
                  ))}
                </ul>
              </section>
            )}
            {!result.data.evidence?.length ? (
              <p className="os-empty">Chưa có bằng chứng được lưu.</p>
            ) : (
              result.data.evidence.map((e, i) => {
                const source = sources?.find((source) => source.id === e.sourceVersionId);
                const href = safeExternalUrl(source?.url);
                return (
                  <article className="os-source" key={e.id || i}>
                    <h3>
                      {e.researchQuestion ||
                        e.claim ||
                        e.statement ||
                        e.questionId ||
                        `Bằng chứng ${i + 1}`}
                    </h3>
                    <p>{e.evidenceText || e.summary || e.text}</p>
                    {(e.originalQuote || e.quote) && (
                      <blockquote>{e.originalQuote || e.quote}</blockquote>
                    )}
                    <p>{e.reason}</p>
                    {e.conflicting && (
                      <p className="os-notice">Bằng chứng có mâu thuẫn; cần đối chiếu.</p>
                    )}
                    <small>
                      Phiên bản nguồn: {e.sourceVersionId || e.sourceId || 'Chưa có'} · Đoạn văn
                      bản: {e.chunkId || 'Chưa có'}
                    </small>
                    {href && (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        Đối chiếu nguồn
                      </a>
                    )}
                  </article>
                );
              })
            )}
          </>
        )
      )}
    </>
  );
}

export function RunReport({ result, evidence, sources, busy, onExport }) {
  const report = result.data?.[0];
  const citationsVerified =
    report?.citationValidation?.valid === true &&
    report.references?.length > 0 &&
    evidence?.evidence?.length > 0 &&
    !sources?.some((source) => source.provider === 'mock');
  return (
    <>
      <ErrorMessage error={result.error} />
      {result.loading ? (
        <p role="status">Đang tải báo cáo…</p>
      ) : report ? (
        <>
          <div className="os-between">
            <h2>Bản báo cáo mới nhất</h2>
            <div className="knowledge-actions">
              {['pdf', 'docx'].map((f) => (
                <Button
                  key={f}
                  variant="secondary"
                  disabled={busy}
                  onClick={() => onExport(f, report.id)}
                >
                  <Download size={15} />
                  {f.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          <p className="os-notice">
            Trạng thái báo cáo: {statusLabel(report.status) || 'Chưa xác minh'}.{' '}
            {citationsVerified
              ? 'Trích dẫn đã được máy chủ xác minh.'
              : 'Hãy kiểm tra kết quả xác minh trích dẫn trước khi sử dụng.'}
          </p>
          <p className="os-muted">
            Phiên bản {report.id} · {formatDate(report.created_at)}
          </p>
          {report.citationValidation?.reasonCodes?.length > 0 && (
            <p className="os-notice">
              Lý do kiểm định: {report.citationValidation.reasonCodes.join(', ')}
            </p>
          )}
          {report.citationValidation?.citations?.map((c) => (
            <p key={c.citationLabel}>
              {c.citationLabel} · {statusLabel(c.status)} · {c.evidenceIds?.length || 0} bằng chứng
              liên kết
            </p>
          ))}
          {evidence?.gaps?.length > 0 && (
            <section className="os-gaps">
              <h3>Khoảng trống bằng chứng</h3>
              {evidence.gaps.map((g, i) => (
                <p key={i}>{describeResearchValue(g)}</p>
              ))}
            </section>
          )}
          <ReportMarkdown>{report.content || ''}</ReportMarkdown>
          {report.references?.length > 0 && (
            <section className="os-gaps">
              <h3>Tài liệu tham khảo</h3>
              {report.references.map((r, i) => {
                const href = safeExternalUrl(r.url);
                return (
                  <p key={r.id || i}>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {r.title || r.url}
                      </a>
                    ) : (
                      r.title || r.sourceId
                    )}
                  </p>
                );
              })}
            </section>
          )}
        </>
      ) : (
        !result.error && (
          <div className="os-empty">
            <h3>Chưa có báo cáo</h3>
            <p>
              Báo cáo xuất hiện sau giai đoạn Biên soạn báo cáo. Xác minh hoàn tất được phản ánh ở
              trạng thái lượt nghiên cứu.
            </p>
          </div>
        )
      )}
    </>
  );
}
