// Chỉ log thông tin vận hành; không log API key hoặc phản hồi thô của OpenAI.
module.exports = {
    info(component, message) { console.log(`[${component}] ${message}`); },
    warn(component, message) { console.warn(`[${component}] ${message}`); },
    error(component, message) { console.error(`[${component}] ${message}`); }
};
