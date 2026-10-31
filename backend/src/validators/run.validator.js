const STAGES = [
  "planning",
  "collecting",
  "analyzing",
  "evaluating",
  "composing",
  "verifying",
];
function invalid(message) {
  return Object.assign(new Error(message), {
    status: 400,
    code: "INVALID_INPUT",
  });
}
function key(value) {
  if (typeof value !== "string" || !/^[\w.:/-]{1,160}$/.test(value))
    throw invalid("Idempotency-Key is required (1–160 safe characters)");
  return value;
}
function options(body = {}) {
  if (!body || Array.isArray(body) || typeof body !== "object")
    throw invalid("Expected JSON object");
  const result = {
    language: body.language ?? "vi",
    numberOfSources: body.numberOfSources ?? 12,
    searchMore: body.searchMore ?? true,
    orchestration: body.orchestration ?? "backend",
  };
  if (
    !["vi", "en"].includes(result.language) ||
    !Number.isInteger(result.numberOfSources) ||
    result.numberOfSources < 1 ||
    result.numberOfSources > 30 ||
    typeof result.searchMore !== "boolean" ||
    !["backend", "n8n"].includes(result.orchestration)
  )
    throw invalid("Invalid run options");
  return result;
}
module.exports = { STAGES, invalid, key, options };
