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
        const failure = new Error(error.safePlannerError ? error.message
            : "Unable to generate or save research plan. Check backend configuration and try again.");
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
const translation = require("./translation.service");
const activeSearches = new Set();
async function searchAndCollect(requestId) {
    if (activeSearches.has(requestId)) throw httpError("Research request is already searching", 409);
    activeSearches.add(requestId);
    let started = false;
    const totalStarted = Date.now();
    try {
        const request = await requestModel.findById(requestId);
        if (!request) throw httpError("Research request not found", 404);
        const plan = await planModel.findByRequestId(requestId);
        if (!plan.searchQueries.length) throw httpError("Research plan does not contain search queries", 400);
        if (request.status === "planning") throw httpError("Research plan is still being generated", 409);
        started = true;
        await requestModel.updateStatus(requestId, "searching");
        logger.info("Search", `Starting search for request ${requestId}`);
        const concurrency = positiveInteger("SEARCH_CONCURRENCY", 4, 10);
        const searchStarted = Date.now();
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
        logger.info('Workflow2', `search completed in ${Date.now() - searchStarted}ms`);
        if (batches.every(batch => batch === null)) throw new Error("All search queries failed");
        const normalized = batches.filter(Boolean).flat();
        logger.info("Collect", `Normalized ${normalized.length} results`);
        const sources = deduplicateSources(normalized);
        logger.info("Collect", `Deduplicated to ${sources.length} sources`);
        logger.info('Workflow2', `dedupe ${normalized.length} -> ${sources.length}`);
        if (!sources.length) throw new Error("No valid sources collected");
        const fetchStarted = Date.now();
        await mapWithConcurrency(sources, positiveInteger('CONTENT_FETCH_CONCURRENCY', 5, 10), async source => {
            source.content = source.content ? contentService.cleanContent(source.content)
                : await contentService.fetchPageContent(source.url);
        });
        logger.info('Workflow2', `content fetch completed in ${Date.now() - fetchStarted}ms`);
        const previous = await sourceModel.getSourcesByRequestId(requestId);
        const { detectSourceLanguage } = require('../utils/language');
        const stats = { viSources: 0, enSources: 0, unknownSources: 0, translationCalls: 0, cacheHits: 0, rateLimitRetries: 0 };
        for (const source of sources) {
            source.sourceLanguage = detectSourceLanguage(source);
            stats[source.sourceLanguage === 'vi' ? 'viSources' : source.sourceLanguage === 'en' ? 'enSources' : 'unknownSources']++;
            source.translationStatus = 'pending';
        }
        // Persist originals first, then publish each ready translation for polling clients.
        await sourceModel.createSources(requestId, sources, 'translating');
        const translationStarted = Date.now();
        await mapWithConcurrency(sources, positiveInteger('TRANSLATE_SOURCE_CONCURRENCY', Number(process.env.TRANSLATE_CONCURRENCY || 2), 10), async source => {
            try {
                const hash = translation.translationHash(source);
                const cached = previous.find(item => item.normalizedUrl === source.normalizedUrl && item.translationHash === hash &&
                    ['complete', 'not_required'].includes(item.translationStatus));
                if (cached) {
                    stats.cacheHits++;
                    Object.assign(source, { titleVi: cached.titleVi, snippetVi: cached.snippetVi, contentVi: cached.contentVi,
                        translationHash: hash, translationStatus: cached.translationStatus });
                } else {
                    const result = await translation.translateSourceToVietnamese(source);
                    Object.assign(source, result);
                    stats.translationCalls += result.translationCalls || 0;
                    stats.rateLimitRetries += result.rateLimitRetries || 0;
                }
            } catch {
                source.translationStatus = 'failed';
                logger.warn('Translate', 'Source translation failed; original retained, Vietnamese placeholder used');
            }
            await sourceModel.createSources(requestId, [source], 'translating');
        });
        logger.info('Workflow2', `vi sources: ${stats.viSources}; en sources: ${stats.enSources}; translation calls: ${stats.translationCalls}; cache hits: ${stats.cacheHits}`);
        logger.info('Workflow2', `translation completed in ${Date.now() - translationStarted}ms`);
        const saved = await sourceModel.createSources(requestId, sources);
        logger.info("Database", `Saved ${saved.length} sources`);
        logger.info("Research", "Status changed to collected");
        stats.totalMs = Date.now() - totalStarted;
        logger.info('Workflow2', `total completed in ${stats.totalMs}ms`);
        return { requestId, status: "collected", metrics: stats, queryCount: plan.searchQueries.length,
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
