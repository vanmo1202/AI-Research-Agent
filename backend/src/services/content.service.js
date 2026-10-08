const cheerio = require("cheerio");
const { lookup } = require("node:dns/promises");
const { BlockList } = require("node:net");
const logger = require("../utils/logger");
const { positiveInteger } = require("../utils/settings");
const { normalizeUrl } = require("../utils/url");

const blocked = new BlockList();
for (const [address, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16], ["224.0.0.0", 4]]) {
    blocked.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]]) {
    blocked.addSubnet(address, prefix, "ipv6");
}
async function checkPublicUrl(url) {
    if (!normalizeUrl(url)) throw new Error("Invalid page URL");
    const hostname = new URL(url).hostname.replace(/^\[|\]$/g, "");
    const addresses = await lookup(hostname, { all: true });
    if (!addresses.length || addresses.some(entry => blocked.check(entry.address, entry.family === 6 ? "ipv6" : "ipv4"))) {
        throw new Error("Page URL must point to a public address");
    }
}
function cleanContent(value) {
    if (typeof value !== "string") return "";
    const $ = cheerio.load(value);
    $("script, style, noscript, template").remove();
    // Chèn khoảng trắng trước khi bỏ tag để không nối các đoạn văn.
    $("p, div, li, br, h1, h2, h3, section, article, td").append(" ");
    return $.root().text().replace(/\s+/g, " ").trim()
        .slice(0, positiveInteger("MAX_SOURCE_CONTENT_CHARS", 20000, 1000000));
}
async function fetchPageContent(url) {
    logger.info("Content", "Fetching page content");
    const signal = AbortSignal.timeout(15000);
    try {
        let current = url;
        // Kiểm tra cả đích redirect; không tự theo redirect tới mạng nội bộ.
        for (let redirect = 0; redirect <= 3; redirect++) {
            await checkPublicUrl(current);
            const response = await fetch(current, {
                redirect: "manual", signal,
                headers: { "User-Agent": "AIResearchAgent/1.0 (research content collector)",
                    Accept: "text/html, text/plain;q=0.9" }
            });
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                const location = response.headers.get("location");
                await response.body?.cancel();
                if (!location) throw new Error("Redirect missing location");
                current = new URL(location, current).toString();
                continue;
            }
            if (!response.ok) { await response.body?.cancel(); throw new Error("Page request failed"); }
            const type = response.headers.get("content-type") || "";
            if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(type)) {
                await response.body?.cancel();
                throw new Error("Unsupported content type");
            }
            // Giới hạn cả HTML tải xuống, không chỉ text lưu vào database.
            const chunks = [];
            let bytes = 0;
            for await (const chunk of response.body) {
                bytes += chunk.length;
                if (bytes > 2 * 1024 * 1024) throw new Error("Page exceeds 2 MB limit");
                chunks.push(Buffer.from(chunk));
            }
            return cleanContent(Buffer.concat(chunks).toString("utf8"));
        }
        throw new Error("Too many redirects");
    } catch {
        logger.warn("Content", "Fetch failed; keeping source with empty content");
        return "";
    }
}
module.exports = { fetchPageContent, cleanContent, checkPublicUrl };
