module.exports = function validateResearch(req, res, next) {
    const body = req.body;
    const invalid = (error) => res.status(400).json({ success: false, error });
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return invalid("Request body must be a JSON object");
    }
    for (const field of ["topic", "goal"]) {
        if (typeof body[field] !== "string" || !body[field].trim()) {
            return invalid(`${field} is required and must be a non-empty string`);
        }
    }
    if (body.scope !== undefined && typeof body.scope !== "string") {
        return invalid("scope must be a string");
    }
    if (body.outputLength !== undefined && !["short", "medium", "long"].includes(body.outputLength)) {
        return invalid("outputLength must be short, medium, or long");
    }
    // Chỉ chuyển các field đã kiểm tra sang service.
    req.researchInput = {
        topic: body.topic.trim(), goal: body.goal.trim(),
        scope: body.scope === undefined ? "" : body.scope.trim(),
        outputLength: body.outputLength === undefined ? "medium" : body.outputLength
    };
    next();
};
