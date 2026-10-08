const router = require("express").Router();
const controller = require("../controllers/research.controller");
const validateResearch = require("../middlewares/validateResearch");
router.post("/", validateResearch, controller.create);
router.get("/:id", controller.getById);
module.exports = router;
