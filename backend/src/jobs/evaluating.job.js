module.exports = async (ctx) => {
  const evidence = ctx.analysis ? JSON.parse(ctx.analysis.evidence_json) : [];
  const gaps = ctx.plan.researchQuestions
    .filter((q) => !evidence.some((e) => e.questionId === q.id))
    .map((q) => ({ questionId: q.id, question: q.question }));
  const citedSources = new Set(evidence.map((e) => e.sourceVersionId));
  if (evidence.length && citedSources.size < 2)
    gaps.push({
      questionId: "corroboration",
      question: "Cần nguồn bổ sung để đối chiếu độc lập các phát hiện.",
    });
  const conflicting = evidence.some((e) => e.conflicting);
  const coverage = !evidence.length
    ? "unavailable"
    : conflicting
      ? "conflicting"
      : gaps.length
        ? "insufficient"
        : "sufficient";
  const more =
    coverage !== "sufficient" &&
    ctx.input.searchMore &&
    ctx.run.current_round < 2 &&
    ctx.sources.length < ctx.input.numberOfSources &&
    ctx.run.search_calls < 16 &&
    ctx.run.llm_calls < 32;
  return require("../validators/evaluation.validator").validate({
    coverage,
    action:
      coverage === "sufficient"
        ? "compose_report"
        : more
          ? "search_more"
          : "finish_with_gaps",
    gaps,
    additional_queries: more
      ? (gaps.length ? gaps : ctx.plan.researchQuestions)
          .slice(0, 4)
          .map(
            (q) =>
              `${ctx.input.topic} ${q.question} evidence research round ${ctx.run.current_round + 1}`,
          )
      : [],
    reason:
      coverage === "sufficient"
        ? "Every research question has traceable evidence."
        : more
          ? "Additional evidence required."
          : "Evidence or budget insufficient; report must disclose gaps.",
  });
};
