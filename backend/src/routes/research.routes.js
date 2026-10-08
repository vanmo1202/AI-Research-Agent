const router = require("express").Router();
const controller = require("../controllers/research.controller");
const validateResearch = require("../middlewares/validateResearch");
router.post("/", validateResearch, controller.create);
router.get("/:id", controller.getById);
router.post("/:id/search", controller.search);
router.get("/:id/sources", controller.getSources);
module.exports = router;
