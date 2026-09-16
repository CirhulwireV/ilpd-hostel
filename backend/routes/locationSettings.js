const express = require("express");
const router = express.Router();
const {
  getLocationSettings,
  updateLocationSetting,
  getBlocks,
  createBlock,
  deleteBlock,
} = require("../controllers/locationSettingsController");
const { protect, adminOnly } = require("../middleware/auth");
const { cache } = require("../middleware/cache");

router.get("/", cache("location-settings", 120), getLocationSettings);
router.put("/:key", protect, adminOnly, updateLocationSetting);
router.get("/blocks", cache((req) => `location-blocks:${req.query.accommodationType || "all"}`, 120), getBlocks);
router.post("/blocks", protect, adminOnly, createBlock);
router.delete("/blocks/:key", protect, adminOnly, deleteBlock);

module.exports = router;
