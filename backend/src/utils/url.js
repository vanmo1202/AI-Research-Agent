const tracking = new Set(["fbclid", "gclid"]);
function normalizeUrl(value) {
    try {
        if (typeof value !== "string") return null;
        const url = new URL(value.trim());
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
        url.hash = "";
        url.hostname = url.hostname.toLowerCase();
        url.pathname = url.pathname.replace(/\/+$/, "") || "/";
        for (const key of [...url.searchParams.keys()]) {
            if (key.toLowerCase().startsWith("utm_") || tracking.has(key.toLowerCase())) url.searchParams.delete(key);
        }
        url.searchParams.sort();
        return url.toString();
    } catch { return null; }
}
function deduplicateSources(sources) {
    const unique = new Map();
    for (const source of sources) {
        const key = normalizeUrl(source.normalizedUrl || source.url);
        if (!key) continue;
        const previous = unique.get(key);
        // Content dài hơn được ưu tiên; khi bằng nhau giữ source đầu tiên.
        if (!previous || (source.content || "").length > (previous.content || "").length) {
            unique.set(key, { ...source, normalizedUrl: key });
        }
    }
    return [...unique.values()];
}
module.exports = { normalizeUrl, deduplicateSources };
