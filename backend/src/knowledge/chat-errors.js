// Only fixed codes/labels leave this module. Never log provider bodies, prompts or identifiers.
const messages = {
  TAVILY_AUTH_FAILED:
    "Tavily không xác thực được. Quản trị viên cần kiểm tra cấu hình tìm kiếm.",
  TAVILY_QUOTA_EXCEEDED:
    "Tavily đã đạt hạn mức hoặc giới hạn tốc độ. Vui lòng thử lại sau.",
  TAVILY_NETWORK_ERROR:
    "Không kết nối được Tavily. Vui lòng kiểm tra trạng thái trước khi thử lại.",
  TAVILY_PROVIDER_ERROR:
    "Tavily tạm thời không khả dụng. Vui lòng thử lại sau.",
  TAVILY_INVALID_RESPONSE:
    "Tavily trả dữ liệu không hợp lệ. Chưa thể sử dụng kết quả tìm kiếm.",
  GEMINI_AUTH_FAILED:
    "Gemini không xác thực được. Quản trị viên cần kiểm tra cấu hình AI.",
  GEMINI_QUOTA_EXHAUSTED:
    "Hạn mức Gemini không đủ để tổng hợp câu trả lời. Vui lòng thử lại sau.",
  GEMINI_RATE_LIMITED: "Gemini đang giới hạn tốc độ. Vui lòng thử lại sau.",
  GEMINI_MODEL_NOT_FOUND:
    "Mô hình Gemini hiện cấu hình không khả dụng. Quản trị viên cần kiểm tra model.",
  GEMINI_NETWORK_ERROR:
    "Không kết nối được Gemini. Vui lòng kiểm tra trạng thái trước khi thử lại.",
  GEMINI_PROVIDER_ERROR:
    "Gemini tạm thời không thể tổng hợp câu trả lời. Vui lòng thử lại sau.",
  GEMINI_INVALID_JSON:
    "Gemini trả dữ liệu không đúng JSON; câu trả lời chưa được lưu.",
  GEMINI_OUTPUT_TRUNCATED:
    "Gemini chưa hoàn tất câu trả lời trong giới hạn đầu ra. Hãy thu hẹp câu hỏi trước khi gửi lại.",
  GEMINI_OUTPUT_BLOCKED:
    "Gemini không cung cấp câu trả lời hoàn chỉnh cho lượt này.",
  CHAT_INVALID_SCHEMA:
    "Câu trả lời AI không đúng cấu trúc bằng chứng; chưa được lưu.",
  CHAT_CITATION_REJECTED:
    "Không xác minh được trích dẫn; câu trả lời chưa được lưu.",
  CHAT_SOURCE_CHANGED:
    "Nguồn hoặc quyền truy cập đã thay đổi. Hãy kiểm tra trước khi thử lại.",
  AUTO_CHAT_BUDGET_EXCEEDED:
    "Đã đạt ngân sách Auto Chat. Vui lòng thử lại sau hoặc tắt Internet.",
  CHAT_TIMEOUT:
    "Lượt xử lý đã hết thời gian. Hãy kiểm tra lịch sử trước khi thử lại.",
  CHAT_FAILED:
    "Chưa thể hoàn tất lượt trả lời. Hãy kiểm tra trạng thái trước khi thử lại.",
};
function describe(error, { provider, stage = "answering" } = {}) {
  provider = error.provider || provider;
  if (
    [
      "planning",
      "searching",
      "reading",
      "answering",
      "validating",
      "retrieving",
    ].includes(error.stage)
  )
    stage = error.stage;
  let code = Object.hasOwn(messages, error.code) ? error.code : null;
  const status = Number(error.status);
  if (!code && ["AbortError", "TimeoutError"].includes(error.name))
    code = "CHAT_TIMEOUT";
  if (!code && error.message === "Chat deadline exceeded; retry manually")
    code = "CHAT_TIMEOUT";
  if (
    !code &&
    /Citation integrity check failed|Trích đoạn web không phù hợp/.test(
      error.message || "",
    )
  )
    code = "CHAT_CITATION_REJECTED";
  if (
    !code &&
    /Invalid grounded response|Invalid response text|Response has no evidence|Invalid citation/.test(
      error.message || "",
    )
  )
    code = "CHAT_INVALID_SCHEMA";
  if (
    !code &&
    /Source changed during chat|Memory no longer valid|Document detached|Chat lease expired/.test(
      error.message || "",
    )
  )
    code = "CHAT_SOURCE_CHANGED";
  if (!code && provider === "gemini") {
    code =
      [401, 403].includes(status) ||
      error.message === "GEMINI_API_KEY is not configured"
        ? "GEMINI_AUTH_FAILED"
        : status === 404
          ? "GEMINI_MODEL_NOT_FOUND"
          : status === 429
            ? "GEMINI_RATE_LIMITED"
            : error.message === "Gemini returned invalid JSON"
              ? "GEMINI_INVALID_JSON"
              : error.name === "TypeError"
                ? "GEMINI_NETWORK_ERROR"
                : "GEMINI_PROVIDER_ERROR";
  }
  if (!code && provider === "tavily") {
    code = [401, 403].includes(status)
      ? "TAVILY_AUTH_FAILED"
      : [429, 432, 433].includes(status)
        ? "TAVILY_QUOTA_EXCEEDED"
        : error.name === "TypeError"
          ? "TAVILY_NETWORK_ERROR"
          : "TAVILY_PROVIDER_ERROR";
  }
  code ||= "CHAT_FAILED";
  return {
    code,
    message: messages[code],
    stage,
    ...(provider === "gemini" || provider === "tavily" ? { provider } : {}),
    ...((provider === "gemini" || provider === "tavily") &&
    Number.isInteger(status) &&
    status >= 400 &&
    status <= 599
      ? { providerStatus: status }
      : {}),
  };
}
function log(detail) {
  const { code, stage, provider, providerStatus } = detail;
  console.warn(
    "[AutoChat]",
    JSON.stringify({ code, stage, provider, providerStatus }),
  );
}
module.exports = { describe, log };
