module.exports = async (ctx) => {
  if (!ctx.report) throw ctx.provider.fail("REPORT_MISSING");
  const references = JSON.parse(ctx.report.references_json),
    evidence = JSON.parse(ctx.analysis.evidence_json);
  const labels = new Set(references.map((r) => r.citationLabel));
  const invalidReferences = references.filter(
    (r) =>
      r.runId !== ctx.run.id ||
      !ctx.sources.some((s) => s.id === r.sourceVersionId && s.url === r.url) ||
      !evidence.some((e) => e.sourceVersionId === r.sourceVersionId),
  );
  const missingCitations = [...ctx.report.content.matchAll(/\[\d+\]/g)]
    .map((m) => m[0])
    .filter((label) => !labels.has(label));
  const stale = ctx.report.analysis_version_id !== ctx.analysis.id;
  const body = ctx.report.content.split(
    /## (?:Tài liệu tham khảo|References)/,
  )[0];
  const unusedReferences = references
    .filter((r) => !body.includes(r.citationLabel))
    .map((r) => r.sourceVersionId);
  const noReferences = evidence.length > 0 && references.length === 0;
  const missingSections =
    !/^# /m.test(ctx.report.content) ||
    [
      /(?:Tóm tắt|Summary)/,
      /(?:Nội dung chính|Findings)/,
      /(?:Kết luận|Conclusion)/,
      /(?:Giới hạn nghiên cứu|Research limitations)/,
      /(?:Tài liệu tham khảo|References)/,
    ].some((pattern) => !pattern.test(ctx.report.content));
  const valid =
    !invalidReferences.length &&
    !missingCitations.length &&
    !stale &&
    !unusedReferences.length &&
    !noReferences &&
    !missingSections;
  return {
    valid,
    invalidReferences: invalidReferences.map((r) => r.sourceVersionId),
    missingCitations,
    stale,
    unusedReferences,
    noReferences,
    missingSections,
    status:
      valid &&
      evidence.length &&
      ctx.previousEvaluation?.coverage === "sufficient"
        ? "completed"
        : "partial",
  };
};
