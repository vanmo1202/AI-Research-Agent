const { invalid } = require("./run.validator");
// Closed schema used for the persisted evaluator contract and n8n loop decisions.
const schema = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["coverage", "action", "gaps", "additional_queries", "reason"],
  properties: {
    coverage: {
      enum: ["sufficient", "insufficient", "conflicting", "unavailable"],
    },
    action: { enum: ["compose_report", "search_more", "finish_with_gaps"] },
    gaps: { type: "array" },
    additional_queries: {
      type: "array",
      maxItems: 4,
      items: { type: "string" },
    },
    reason: { type: "string" },
  },
});
function validate(value) {
  if (
    !value ||
    Object.keys(value).length !== schema.required.length ||
    schema.required.some((k) => !(k in value)) ||
    !schema.properties.coverage.enum.includes(value.coverage) ||
    !schema.properties.action.enum.includes(value.action) ||
    !Array.isArray(value.gaps) ||
    value.gaps.some(
      (g) =>
        !g ||
        typeof g.question !== "string" ||
        typeof g.questionId !== "string",
    ) ||
    !Array.isArray(value.additional_queries) ||
    value.additional_queries.length > 4 ||
    value.additional_queries.some(
      (q) => typeof q !== "string" || !q.trim() || q.length > 6000,
    ) ||
    typeof value.reason !== "string" ||
    !value.reason.trim()
  )
    throw invalid("Invalid coverage evaluator output");
  if (
    (value.coverage === "sufficient") !== (value.action === "compose_report") ||
    (value.action === "search_more" && !value.additional_queries.length)
  )
    throw invalid("Inconsistent coverage action");
  return value;
}
module.exports = { schema, validate };
