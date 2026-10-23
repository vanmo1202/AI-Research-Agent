function positiveInteger(name, fallback, maximum) {
    const value = process.env[name];
    if (value === undefined || value === "") return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > maximum) {
        throw new Error(`${name} must be an integer between 1 and ${maximum}`);
    }
    return number;
}

function getSettings(env = process.env) {
    const bool = (name, fallback) => {
        const value = (env[name] ?? String(fallback)).trim().toLowerCase();
        if (!['true', 'false'].includes(value)) throw new Error(`${name} must be true or false`);
        return value === 'true';
    };
    const settings = {
        port: Number(env.PORT || 3000),
        mockLlm: bool('MOCK_LLM', true),
        mockSearch: bool('MOCK_SEARCH', true),
        llmProvider: (env.LLM_PROVIDER || 'gemini').trim().toLowerCase(),
        searchProvider: (env.SEARCH_PROVIDER || 'tavily').trim().toLowerCase(),
        httpTimeoutMs: positiveInteger('HTTP_TIMEOUT_MS', 30000, 300000),
        retryCount: (() => {
            const value = env.HTTP_RETRY_COUNT ?? '2';
            const number = Number(value);
            if (!Number.isInteger(number) || number < 0 || number > 10) throw new Error('HTTP_RETRY_COUNT must be an integer between 0 and 10');
            return number;
        })(),
        retryBaseDelayMs: positiveInteger('HTTP_RETRY_BASE_DELAY_MS', 500, 60000)
    };
    if (!Number.isInteger(settings.port) || settings.port < 0 || settings.port > 65535) throw new Error('PORT must be a valid port');
    if (!settings.mockLlm && (!env.GEMINI_API_KEY || !env.GEMINI_API_KEY.trim())) throw new Error('Missing GEMINI_API_KEY while MOCK_LLM=false');
    if (!settings.mockSearch && settings.searchProvider === 'tavily' && (!env.TAVILY_API_KEY || !env.TAVILY_API_KEY.trim())) throw new Error('Missing TAVILY_API_KEY while MOCK_SEARCH=false');
    return settings;
}

module.exports = { positiveInteger, getSettings };
