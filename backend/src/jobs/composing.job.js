module.exports = async (ctx) => {
  const evidence = ctx.analysis ? JSON.parse(ctx.analysis.evidence_json) : [];
  const evaluation = ctx.previousEvaluation || {
    coverage: "unavailable",
    gaps: [],
  };
  const en = ctx.input.language === "en";
  const text = en
    ? {
        summary: "Summary",
        main: "Findings",
        conclusion: "Conclusion",
        limits: "Research limitations",
        refs: "References",
        missing: "No suitable evidence available.",
        incomplete: "Evidence is insufficient for a complete conclusion.",
        covered: "All questions have traceable evidence.",
        caution: "More evidence is needed before drawing firm conclusions.",
        end: "The findings above link directly to original sources and quotes. They summarize evidence without establishing causality.",
        limit:
          "Web sources may change; independent peer review has not been performed.",
      }
    : {
        summary: "Tóm tắt",
        main: "Nội dung chính",
        conclusion: "Kết luận",
        limits: "Giới hạn nghiên cứu",
        refs: "Tài liệu tham khảo",
        missing: "Chưa có bằng chứng phù hợp.",
        incomplete: "Chưa đủ bằng chứng để kết luận đầy đủ.",
        covered: "Các câu hỏi đều có bằng chứng truy xuất được.",
        caution: "Cần bổ sung bằng chứng trước khi đưa ra kết luận chắc chắn.",
        end: "Các phát hiện ở trên được liên kết trực tiếp với nguồn và đoạn trích; đây là tổng hợp bằng chứng, chưa khẳng định quan hệ nhân quả.",
        limit: "Nguồn web có thể thay đổi; chưa có đánh giá phản biện độc lập.",
      };
  const cap = { short: 1, medium: 2, long: 4 }[ctx.input.outputLength] || 2;
  const selected = ctx.plan.researchQuestions.flatMap((q) =>
    evidence.filter((e) => e.questionId === q.id).slice(0, cap),
  );
  const references = ctx.sources
    .filter((s) => selected.some((e) => e.sourceVersionId === s.id))
    .map((s, i) => ({
      sourceVersionId: s.id,
      runId: ctx.run.id,
      citationLabel: `[${i + 1}]`,
      title: s.title,
      url: s.url,
    }));
  const sections = ctx.plan.researchQuestions.map((q) => {
    const items = selected.filter((e) => e.questionId === q.id);
    return (
      `### ${q.question}\n\n` +
      (items.length
        ? items
            .map(
              (e) =>
                `${e.evidenceText} ${references.find((r) => r.sourceVersionId === e.sourceVersionId).citationLabel}`,
            )
            .join("\n\n")
        : text.missing)
    );
  });
  const partial = evaluation.coverage !== "sufficient";
  const summary = en
    ? `${selected.length} evidence items from ${references.length} sources.`
    : `Phân tích ${selected.length} bằng chứng từ ${references.length} nguồn.`;
  const content = `# ${ctx.input.topic}\n\n## ${text.summary}\n\n${summary} ${partial ? text.incomplete : text.covered}\n\n## ${text.main}\n\n${sections.join("\n\n")}\n\n## ${text.conclusion}\n\n${partial ? text.caution : text.end}\n\n## ${text.limits}\n\nCoverage: ${evaluation.coverage}. ${text.limit} ${evaluation.gaps.map((g) => g.question).join("; ")}\n\n## ${text.refs}\n\n${references.map((r) => `${r.citationLabel} ${r.title} — ${r.url}`).join("\n\n")}`;
  return { analysisVersionId: ctx.analysis.id, content, references, partial };
};
