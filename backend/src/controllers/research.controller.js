const researchService = require("../services/research.service");
const logger = require("../utils/logger");
const evidenceService = require("../services/evidence.service");
const reportService = require("../services/report.service");
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
async function analyze(req, res, next) { try { res.json({ success: true, data: await evidenceService.analyze(req.params.id) }); } catch (error) { next(error); } }
async function getEvidence(req, res, next) { try { if (!await researchService.getResearchRequest(req.params.id)) return res.status(404).json({ success: false, error: 'Research request not found' }); res.json({ success: true, data: { requestId: req.params.id, ...await evidenceService.getAnalysis(req.params.id), evidence: await evidenceService.getEvidence(req.params.id) } }); } catch (error) { next(error); } }
async function report(req, res, next) { try { res.json({ success: true, data: await reportService.generate(req.params.id, req.body) }); } catch (error) { next(error); } }
async function getReport(req, res, next) { try { if (!await researchService.getResearchRequest(req.params.id)) return res.status(404).json({ success: false, error: 'Research request not found' }); const data = await reportService.getReport(req.params.id); if (!data) return res.status(404).json({ success: false, error: 'Report not found' }); res.json({ success: true, data }); } catch (error) { next(error); } }
module.exports = { create, getById, search, getSources, analyze, getEvidence, report, getReport };
