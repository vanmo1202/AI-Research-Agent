module.exports = async (ctx) => {
  const result = await ctx.provider.extract(
    ctx,
    ctx.plan.researchQuestions,
    ctx.chunks,
  );
  return {
    ...result,
    sourceSnapshotHash: ctx.provider.hash(
      JSON.stringify(ctx.sources.map((s) => [s.id, s.content_hash]).sort()),
    ),
  };
};
