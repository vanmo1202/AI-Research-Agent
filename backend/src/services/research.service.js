const { randomUUID } = require("node:crypto");
const requestModel = require("../models/request.model");
const planModel = require("../models/plan.model");
const llmService = require("./llm.service");
const logger = require("../utils/logger");

async function createResearchRequest(input) {
    const requestId = randomUUID();
    logger.info("Research", `Request ID: ${requestId}`);
    await requestModel.create({ ...input, id: requestId, status: "planning", createdAt: new Date().toISOString() });
    try {
        const plan = await llmService.generateResearchPlan(input);
        await planModel.save(requestId, plan);
        logger.info("Database", "Research plan saved");
        await requestModel.updateStatus(requestId, "planned");
        logger.info("Research", "Status: planned");
        return { requestId, topic: input.topic, status: "planned", ...plan };
    } catch (error) {
        try {
            await requestModel.updateStatus(requestId, "failed");
        } catch (databaseError) {
            logger.error("Database", "Could not update failed status");
        }
        logger.error("Research", `Status: failed; Request ID: ${requestId}`);
        const failure = new Error("Unable to generate or save research plan. Check backend configuration and try again.");
        failure.status = 502;
        failure.requestId = requestId;
        throw failure;
    }
}
async function getResearchRequest(id) {
    const request = await requestModel.findById(id);
    if (!request) return null;
    const plan = await planModel.findByRequestId(id);
    return { request, ...plan };
}
module.exports = { createResearchRequest, getResearchRequest };
