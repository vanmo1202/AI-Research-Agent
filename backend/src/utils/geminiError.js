function retryAfterMilliseconds(value, now = Date.now()) {
    if (!value) return undefined;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(value);
    return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}
async function geminiResponseError(response) {
    const error = new Error(`Gemini API request failed (HTTP ${response.status})`);
    error.status = response.status;
    error.retryAfterMs = retryAfterMilliseconds(response.headers?.get('retry-after'));
    if (response.status === 429) {
        let payload;
        try { payload = await response.json(); } catch { /* No raw provider data leaves this function. */ }
        // RESOURCE_EXHAUSTED alone also means transient throttling; it is not proof of exhausted quota.
        const detail = JSON.stringify(payload?.error || {}).slice(0, 20000);
        const exhausted = /per.?day|daily|billing|quota[_ ]exhausted|quota[_ ]exceeded|quotaValue["\s:]+0\b|limit["\s:]+0\b/i.test(detail);
        error.code = exhausted ? 'GEMINI_QUOTA_EXHAUSTED' : 'GEMINI_RATE_LIMITED';
        error.message = exhausted ? 'Hạn mức Gemini hiện không đủ để tiếp tục phân tích bằng chứng.' : 'Gemini đang giới hạn tốc độ. Vui lòng thử lại sau.';
        error.retryable = !exhausted;
    }
    if (response.status !== 429) { try { await response.body?.cancel(); } catch { /* Response is already closed. */ } }
    return error;
}
function retryableGeminiError(error) {
    return error.retryable !== false && ([408, 429, 500, 502, 503, 504].includes(error.status) ||
        ['AbortError', 'TimeoutError', 'TypeError'].includes(error.name));
}
module.exports = { retryAfterMilliseconds, geminiResponseError, retryableGeminiError };
