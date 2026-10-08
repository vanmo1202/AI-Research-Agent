const { normalizeUrl } = require("./url");
const logger = require("./logger");
const trim = value => typeof value === "string" ? value.trim() : "";
function normalizeSource(result, query) {
    const normalizedUrl = normalizeUrl(result?.url);
    if (!normalizedUrl) {
        logger.warn("Collect", "Discarded result with invalid URL");
        return null;
    }
    return {
        query: trim(query), title: trim(result.title), url: result.url.trim(),
        normalizedUrl, snippet: trim(result.snippet), content: trim(result.content),
        provider: trim(result.provider), collectedAt: new Date().toISOString()
    };
}
module.exports = { normalizeSource };
