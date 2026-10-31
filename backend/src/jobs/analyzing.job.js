module.exports = async (ctx) => {
  const result = await ctx.provider.extract(
    ctx,
    ctx.plan.researchQuestions,
    ctx.chunks,
  );
  // A later provider outage must not discard validated evidence from this run.
  // A re-planned question is a different input and cannot inherit an old answer.
  const previous = ctx.analysis ? JSON.parse(ctx.analysis.evidence_json) : [];
  const retained = previous.filter(
    (e) =>
      ctx.plan.researchQuestions.some(
        (q) => q.id === e.questionId && q.question === e.researchQuestion,
      ) &&
      ctx.chunks.some(
        (c) =>
          c.id === e.chunkId &&
          c.source_version_id === e.sourceVersionId &&
          c.content.includes(e.originalQuote),
      ),
  );
  const merged = new Map(
    [...retained, ...result.evidence].map((e) => [
      JSON.stringify([e.questionId, e.chunkId, e.originalQuote]),
      e,
    ]),
  );
  return {
    ...result,
    evidence: [...merged.values()],
    sourceSnapshotHash: ctx.provider.hash(
      JSON.stringify(ctx.sources.map((s) => [s.id, s.content_hash]).sort()),
    ),
  };
};
