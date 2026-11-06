const logger = require("../../utils/logger");
const { withRetry, transientStatus } = require("../../utils/httpRetry");
async function search(query, { maxResults, retryCount, timeoutMs, signal }) {
  try {
    if (!process.env.TAVILY_API_KEY) throw new Error("TAVILY_API_KEY is required when MOCK_SEARCH=false");
    const response = await withRetry(async () => {
      const result = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs ?? Number(process.env.HTTP_TIMEOUT_MS || 30000))]) : AbortSignal.timeout(timeoutMs ?? Number(process.env.HTTP_TIMEOUT_MS || 30000)),
        body: JSON.stringify({ query, max_results: maxResults, search_depth: "basic",
            include_answer: false, include_raw_content: "text" })
      });
      if (!result.ok && transientStatus(result.status)) { const error = new Error(`HTTP ${result.status}`); error.status = result.status; throw error; }
      return result;
    }, { label: "Tavily", retryCount, shouldRetry: error => transientStatus(error.status) || error.name === "AbortError" || error.name === "TimeoutError" || error.name === "TypeError" });
    if (!response.ok) {
        logger.warn("Search", `Tavily HTTP ${response.status}`);
        throw Object.assign(new Error("Tavily search failed"), {status:response.status});
    }
    const data = await response.json();
    if (!Array.isArray(data.results)) throw Object.assign(new Error("Tavily returned invalid search results"), {code:"TAVILY_INVALID_RESPONSE"});
    return data.results.slice(0, maxResults).map(result => ({
        title: result?.title, url: result?.url, snippet: result?.content,
        content: result?.raw_content, provider: "tavily"
    }));
  } catch(error) { error.provider="tavily";
    if (!process.env.TAVILY_API_KEY) error.code="TAVILY_AUTH_FAILED";
    if(error instanceof SyntaxError) error.code="TAVILY_INVALID_RESPONSE";
    throw error;
  }
}
module.exports = { search };
