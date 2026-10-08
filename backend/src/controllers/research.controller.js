const researchService = require("../services/research.service");
const logger = require("../utils/logger");
async function create(req, res, next) {
    try {
        logger.info("Research", "Request received");
        const data = await researchService.createResearchRequest(req.researchInput);
        res.status(201).json({ success: true, data });
    } catch (error) { next(error); }
}
async function getById(req, res, next) {
    try {
        const data = await researchService.getResearchRequest(req.params.id);
        if (!data) return res.status(404).json({ success: false, error: "Research request not found" });
        res.json({ success: true, data });
    } catch (error) { next(error); }
}
async function search(req, res, next) {
    try {
        const data = await researchService.searchAndCollect(req.params.id);
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
}
async function getSources(req, res, next) {
    try {
        const data = await researchService.getResearchSources(req.params.id);
        res.json({ success: true, data });
    } catch (error) { next(error); }
}
module.exports = { create, getById, search, getSources };
