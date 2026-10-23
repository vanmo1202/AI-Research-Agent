function transientStatus(status) { return [429, 500, 502, 503, 504].includes(status); }
async function withRetry(operation, { label = 'HTTP', shouldRetry = () => false } = {}) {
    const retryCount = Number.isInteger(Number(process.env.HTTP_RETRY_COUNT)) && Number(process.env.HTTP_RETRY_COUNT) >= 0
        ? Number(process.env.HTTP_RETRY_COUNT) : 2;
    const baseDelay = Number.isInteger(Number(process.env.HTTP_RETRY_BASE_DELAY_MS)) && Number(process.env.HTTP_RETRY_BASE_DELAY_MS) > 0
        ? Number(process.env.HTTP_RETRY_BASE_DELAY_MS) : 500;
    let lastError;
    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
        try {
            return await operation(attempt);
        } catch (error) {
            lastError = error;
            if (attempt >= retryCount || !shouldRetry(error)) throw error;
            const delay = baseDelay * (2 ** attempt);
            console.warn(`[${label}] Retrying after transient error (attempt ${attempt + 1})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}
module.exports = { withRetry, transientStatus };
