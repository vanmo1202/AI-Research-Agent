const { randomUUID } = require("node:crypto");
const requestModel = require("../models/request.model");
const planModel = require("../models/plan.model");
const llmService = require("./llm.service");
const logger = require("../utils/logger");
const sourceModel = require("../models/source.model");
const searchService = require("./search.service");
const contentService = require("./content.service");
const { normalizeSource } = require("../utils/sourceNormalizer");
const { deduplicateSources } = require("../utils/url");
const { mapWithConcurrency } = require("../utils/concurrency");
const { positiveInteger } = require("../utils/settings");

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
function httpError(message, status, requestId) {
    const error = new Error(message);
    error.status = status;
    if (requestId) error.requestId = requestId;
    return error;
}
async function getResearchSources(requestId) {
    if (!await requestModel.findById(requestId)) throw httpError("Research request not found", 404);
    const sources = await sourceModel.getSourcesByRequestId(requestId);
    return { requestId, sourceCount: sources.length, sources };
}
const activeSearches = new Set();
async function searchAndCollect(requestId) {
    if (activeSearches.has(requestId)) throw httpError("Research request is already searching", 409);
    activeSearches.add(requestId);
    let started = false;
    try {
        const request = await requestModel.findById(requestId);
        if (!request) throw httpError("Research request not found", 404);
        const plan = await planModel.findByRequestId(requestId);
        if (!plan.searchQueries.length) throw httpError("Research plan does not contain search queries", 400);
        if (request.status === "planning") throw httpError("Research plan is still being generated", 409);
        started = true;
        await requestModel.updateStatus(requestId, "searching");
        logger.info("Search", `Starting search for request ${requestId}`);
        const concurrency = positiveInteger("SEARCH_CONCURRENCY", 2, 10);
        const batches = await mapWithConcurrency(plan.searchQueries, concurrency, async (item, index) => {
            logger.info("Search", `Query ${index + 1}/${plan.searchQueries.length}`);
            try {
                const results = await searchService.searchWeb(item.query, { maxResults: 5 });
                logger.info("Search", `Found ${results.length} results`);
                return results.map(result => normalizeSource(result, item.query)).filter(Boolean);
            } catch {
                logger.warn("Search", `Query ${index + 1} failed; continuing other queries`);
                return null;
            }
        });
        if (batches.every(batch => batch === null)) throw new Error("All search queries failed");
        const normalized = batches.filter(Boolean).flat();
        logger.info("Collect", `Normalized ${normalized.length} results`);
        const sources = deduplicateSources(normalized);
        logger.info("Collect", `Deduplicated to ${sources.length} sources`);
        if (!sources.length) throw new Error("No valid sources collected");
        await mapWithConcurrency(sources, concurrency, async source => {
            source.content = source.content ? contentService.cleanContent(source.content)
                : await contentService.fetchPageContent(source.url);
        });
        const saved = await sourceModel.createSources(requestId, sources);
        logger.info("Database", `Saved ${saved.length} sources`);
        logger.info("Research", "Status changed to collected");
        return { requestId, status: "collected", queryCount: plan.searchQueries.length,
            sourceCount: saved.length, sources: saved };
    } catch (error) {
        if (!started) throw error;
        try { await requestModel.updateStatus(requestId, "failed"); }
        catch { logger.error("Database", "Could not update failed status"); }
        logger.error("Research", "Status changed to failed");
        const publicMessage = ["All search queries failed", "No valid sources collected"].includes(error.message)
            ? error.message : "Search and collect failed. Check backend configuration or database.";
        throw httpError(publicMessage, 502, requestId);
    } finally { activeSearches.delete(requestId); }
}
module.exports = { createResearchRequest, getResearchRequest, searchAndCollect, getResearchSources };
