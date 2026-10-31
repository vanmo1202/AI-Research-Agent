module.exports = async (ctx) => ({ plan: await ctx.provider.plan(ctx) });
