const {isIP}=require('node:net');
const relevance=require('./source-relevance.service');
const {normalizeUrl}=require('../utils/url');
function isResearchUrl(value){
 const normalized=normalizeUrl(value);if(!normalized)return false;
 const u=new URL(normalized),h=u.hostname.replace(/^\[|\]$/g,'');
 return !isIP(h) && !/(^|\.)(example\.(com|org|net)|localhost|local|internal|invalid|test)$/.test(h) && !/(?:^|\/)mock(?:\/|$)/i.test(u.pathname);
}
function acceptContent(input,source){
 const body=source.original_content ?? source.content ?? '';
 if(body.length<120)return {accepted:false,reason:'INSUFFICIENT_SOURCE_TEXT'};
 if(/^(?:.{0,80})(?:access denied|just a moment|checking your browser|page not found|404 not found|enable javascript|captcha)/i.test(body))return {accepted:false,reason:'PLACEHOLDER_CONTENT'};
 // Metadata cannot turn an unrelated/empty body into evidence.
 const result=relevance.evaluateSource(input,{content:body});
 return result.accepted && result.status==='relevant'?{...result,accepted:true}:{...result,accepted:false};
}
function similar(a,b){
 const terms=v=>new Set(relevance.fold(v).split(' ').filter(w=>w.length>3));
 const x=terms(a),y=terms(b);if(!x.size||!y.size)return false;
 let common=0;for(const t of x)if(y.has(t))common++;
 return common/(x.size+y.size-common)>.86;
}
function traceable(e,ctx){
 const source=ctx.sources.find(s=>s.id===e.sourceVersionId),chunk=ctx.chunks.find(c=>c.id===e.chunkId && c.source_version_id===e.sourceVersionId);
 return !!(source && source.provider==='tavily' && isResearchUrl(source.url) && acceptContent(ctx.input,source).accepted && chunk && e.runId===ctx.run.id && typeof e.originalQuote==='string' && e.originalQuote.trim() && e.originalQuote.length<=400 && chunk.content.includes(e.originalQuote) && source.original_content.includes(e.originalQuote));
}
module.exports={isResearchUrl,acceptContent,similar,traceable};
