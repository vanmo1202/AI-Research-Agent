const router = require("express").Router();
const controller = require("../controllers/research.controller");
const validateResearch = require("../middlewares/validateResearch");
router.post("/", validateResearch, async (req, res, next) => {
    if (req.body.executionMode !== 'async') return controller.create(req,res,next);
    const {randomUUID}=require('node:crypto');
    const id=randomUUID();
    await require('../models/request.model').create({id,...req.researchInput,status:'created',createdAt:new Date().toISOString()});
    res.status(201).json({success:true,data:{requestId:id,status:'created'}});
});
router.get("/:id", controller.getById);
router.post("/:id/search", controller.search);
router.get("/:id/sources", controller.getSources);
router.post("/:id/analyze", controller.analyze);
router.get("/:id/evidence", controller.getEvidence);
router.post("/:id/report", controller.report);
router.get("/:id/report", controller.getReport);
for (const format of ['docx', 'pdf']) {
    router.get(`/:id/report/export/${format}`, async (req, res, next) => {
        try {
            const file = await require('../services/report-export.service').exportReport(req.params.id, format);
            res.set('Content-Type', file.mime);
            res.set('Content-Disposition', `attachment; filename="${file.filename}"`);
            res.send(file.buffer);
        } catch (error) { next(error); }
    });
}
module.exports = router;
