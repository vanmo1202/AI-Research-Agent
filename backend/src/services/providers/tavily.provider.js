const logger = require("../../utils/logger");
async function search(query, { maxResults }) {
    if (!process.env.TAVILY_API_KEY) throw new Error("TAVILY_API_KEY is required when MOCK_SEARCH=false");
    const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ query, max_results: maxResults, search_depth: "basic",
            include_answer: false, include_raw_content: "text" })
    });
    if (!response.ok) {
        logger.warn("Search", `Tavily HTTP ${response.status}`);
        throw new Error(`Tavily search failed (HTTP ${response.status})`);
    }
    const data = await response.json();
    if (!Array.isArray(data.results)) throw new Error("Tavily returned invalid search results");
    return data.results.slice(0, maxResults).map(result => ({
        title: result?.title, url: result?.url, snippet: result?.content,
        content: result?.raw_content, provider: "tavily"
    }));
}
module.exports = { search };
