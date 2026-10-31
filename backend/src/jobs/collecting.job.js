module.exports=async ctx=>{
 const queries=ctx.previousEvaluation?.action==='search_more'?ctx.previousEvaluation.additional_queries:ctx.plan.searchQueries.map(q=>q.query);
 return ctx.provider.collect(ctx,queries,ctx.sources);
};
