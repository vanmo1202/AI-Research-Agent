const { createHash } = require("node:crypto");
const tavily = require("./providers/tavily.provider");
async function searchWeb(query, options = {}) {
    if (typeof query !== "string" || !query.trim()) throw new Error("Search query must not be empty");
    const maxResults = options.maxResults ?? 5;
    if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 20) throw new Error("maxResults must be between 1 and 20");
    const mode = (process.env.MOCK_SEARCH || "true").trim().toLowerCase();
    if (mode === "true") {
        const key = createHash("sha256").update(query).digest("hex").slice(0, 16);
        // Hai nguồn/query để test đủ pipeline; luôn có content nên không fetch web.
        return Array.from({ length: Math.min(maxResults, 2) }, (_, index) => ({
            title: `Mock source ${index + 1}: ${query}`,
            url: `https://example.com/mock/${key}/${index + 1}`,
            snippet: `Mock search result for ${query}`,
            content: `MOCK DATA: This is a sample article for query: ${query}. Source ${index + 1}. This content is generated for testing and is not research evidence.`,
            provider: "mock"
        }));
    }
    if (mode !== "false") throw new Error("MOCK_SEARCH must be true or false");
    if ((process.env.SEARCH_PROVIDER || "tavily") !== "tavily") throw new Error("Unsupported SEARCH_PROVIDER");
    return tavily.search(query, { maxResults });
}
module.exports = { searchWeb };
