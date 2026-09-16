const express = require("express");
const router = express.Router();
const {
  getBlocks, createBlock, updateBlock, deleteBlock,
  addSubBlock, updateSubBlock, deleteSubBlock,
  getCategories, createCategory, updateCategory, deleteCategory,
} = require("../controllers/hostelStructureController");
const { protect, adminOnly } = require("../middleware/auth");
const { cache } = require("../middleware/cache");

// Blocks
router.get("/blocks", cache((req) => `hs-blocks:${req.query.accommodationType || "all"}:${req.query.activeOnly || "true"}`, 120), getBlocks);
router.post("/blocks", protect, adminOnly, createBlock);
router.put("/blocks/:id", protect, adminOnly, updateBlock);
router.delete("/blocks/:id", protect, adminOnly, deleteBlock);

// Sub-blocks
router.post("/blocks/:id/sub-blocks", protect, adminOnly, addSubBlock);
router.put("/blocks/:id/sub-blocks/:subId", protect, adminOnly, updateSubBlock);
router.delete("/blocks/:id/sub-blocks/:subId", protect, adminOnly, deleteSubBlock);

// Categories
router.get("/categories", cache((req) => `hs-categories:${req.query.accommodationType || "all"}:${req.query.activeOnly || "true"}`, 120), getCategories);
router.post("/categories", protect, adminOnly, createCategory);
router.put("/categories/:id", protect, adminOnly, updateCategory);
router.delete("/categories/:id", protect, adminOnly, deleteCategory);

module.exports = router;
