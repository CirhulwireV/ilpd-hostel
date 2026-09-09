const express = require("express");
const router = express.Router();
const { createConcern, getConcerns, getMyConcerns, respondToConcern } = require("../controllers/concernController");
const { protect, adminOnly } = require("../middleware/auth");

router.post("/", protect, createConcern);
router.get("/my", protect, getMyConcerns);
router.get("/", protect, adminOnly, getConcerns);
router.put("/:id/respond", protect, adminOnly, respondToConcern);

module.exports = router;
