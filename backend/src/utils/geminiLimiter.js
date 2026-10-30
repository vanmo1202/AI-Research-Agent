const { positiveInteger } = require('./settings');
function createGeminiLimiter({ maxConcurrent, minIntervalMs } = {}) {
    let active = 0; let lastStart = 0; let timer;
    const queue = [];
    function pump() {
        clearTimeout(timer);
        if (!queue.length) return;
        const max = maxConcurrent ?? positiveInteger('GEMINI_MAX_CONCURRENT_REQUESTS', 2, 20);
        const interval = minIntervalMs ?? Number(process.env.GEMINI_MIN_INTERVAL_MS ?? 400);
        if (!Number.isInteger(interval) || interval < 0 || interval > 60000) {
            while (queue.length) queue.shift().reject(new Error('Invalid Gemini minimum interval'));
            return;
        }
        if (active >= max) return;
        const delay = lastStart + interval - Date.now();
        if (delay > 0) { timer = setTimeout(pump, delay); return; }
        const item = queue.shift(); active++; lastStart = Date.now();
        Promise.resolve().then(item.work).then(item.resolve, item.reject).finally(() => { active--; pump(); });
        pump();
    }
    return work => new Promise((resolve, reject) => { queue.push({ work, resolve, reject }); pump(); });
}
const runGeminiRequest = createGeminiLimiter();
module.exports = { createGeminiLimiter, runGeminiRequest };
