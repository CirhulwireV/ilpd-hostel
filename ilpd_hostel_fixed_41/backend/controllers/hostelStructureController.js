const Block = require("../models/Block");
const Category = require("../models/Category");
const Room = require("../models/Room");
const redis = require("../utils/redis");

const invalidateBlockCache = () => redis.delPattern("hs-blocks:*");
const invalidateCategoryCache = () => Promise.all([
  redis.delPattern("hs-categories:*"),
  redis.delPattern("rates:*"), // rates endpoint also reads categories
]);

// ─── BLOCKS ──────────────────────────────────────────────────────────────────

exports.getBlocks = async (req, res) => {
  try {
    const filter = {};
    if (req.query.accommodationType) filter.accommodationType = req.query.accommodationType;
    if (req.query.activeOnly !== "false") filter.active = true;
    const blocks = await Block.find(filter).sort({ name: 1 });
    res.json(blocks);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createBlock = async (req, res) => {
  try {
    const { name, accommodationType, usesCategories = true, description = "" } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Block name is required." });
    if (!["outside_hostel", "ilpd_building"].includes(accommodationType))
      return res.status(400).json({ message: "Invalid accommodation type." });
    const block = await Block.create({ name: name.trim(), accommodationType, usesCategories, description: description.trim() });
    invalidateBlockCache();
    res.status(201).json(block);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "A block with this name already exists for that location." });
    res.status(500).json({ message: err.message });
  }
};

exports.updateBlock = async (req, res) => {
  try {
    const { name, usesCategories, description, active } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (usesCategories !== undefined) update.usesCategories = usesCategories;
    if (description !== undefined) update.description = description.trim();
    if (active !== undefined) update.active = active;
    const block = await Block.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!block) return res.status(404).json({ message: "Block not found." });
    invalidateBlockCache();
    res.json(block);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "A block with this name already exists for that location." });
    res.status(500).json({ message: err.message });
  }
};

exports.deleteBlock = async (req, res) => {
  try {
    const block = await Block.findById(req.params.id);
    if (!block) return res.status(404).json({ message: "Block not found." });
    const roomCount = await Room.countDocuments({ hostelSection: block.name, accommodationType: block.accommodationType });
    if (roomCount > 0)
      return res.status(400).json({ message: `Cannot delete block "${block.name}" — it has ${roomCount} room(s). Deactivate it instead, or move the rooms first.` });
    await Block.findByIdAndDelete(req.params.id);
    invalidateBlockCache();
    res.json({ message: "Block deleted." });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ─── SUB-BLOCKS ──────────────────────────────────────────────────────────────

exports.addSubBlock = async (req, res) => {
  try {
    const { name, description = "" } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Sub-block name is required." });
    const block = await Block.findById(req.params.id);
    if (!block) return res.status(404).json({ message: "Block not found." });
    if (block.subBlocks.some((s) => s.name.toLowerCase() === name.trim().toLowerCase()))
      return res.status(409).json({ message: "A sub-block with this name already exists in this block." });
    block.subBlocks.push({ name: name.trim(), description: description.trim() });
    await block.save();
    invalidateBlockCache();
    res.status(201).json(block);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateSubBlock = async (req, res) => {
  try {
    const block = await Block.findById(req.params.id);
    if (!block) return res.status(404).json({ message: "Block not found." });
    const sub = block.subBlocks.id(req.params.subId);
    if (!sub) return res.status(404).json({ message: "Sub-block not found." });
    const { name, description, active } = req.body;
    if (name !== undefined) sub.name = name.trim();
    if (description !== undefined) sub.description = description.trim();
    if (active !== undefined) sub.active = active;
    await block.save();
    invalidateBlockCache();
    res.json(block);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deleteSubBlock = async (req, res) => {
  try {
    const block = await Block.findById(req.params.id);
    if (!block) return res.status(404).json({ message: "Block not found." });
    const sub = block.subBlocks.id(req.params.subId);
    if (!sub) return res.status(404).json({ message: "Sub-block not found." });
    const roomCount = await Room.countDocuments({ subBlock: sub.name, hostelSection: block.name });
    if (roomCount > 0)
      return res.status(400).json({ message: `Cannot delete sub-block "${sub.name}" — it has ${roomCount} room(s). Deactivate it instead.` });
    sub.deleteOne();
    await block.save();
    invalidateBlockCache();
    res.json(block);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

exports.getCategories = async (req, res) => {
  try {
    const filter = {};
    if (req.query.accommodationType) filter.accommodationType = req.query.accommodationType;
    if (req.query.activeOnly !== "false") filter.active = true;
    const categories = await Category.find(filter).sort({ name: 1 });
    res.json(categories);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, accommodationType, price, description = "", capacity = 2, images = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Category name is required." });
    if (!["outside_hostel", "ilpd_building"].includes(accommodationType))
      return res.status(400).json({ message: "Invalid accommodation type." });
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0)
      return res.status(400).json({ message: "A price greater than 0 is required." });
    const category = await Category.create({
      name: name.trim(), accommodationType, price: numericPrice,
      description: description.trim(), capacity: Number(capacity) || 2, images,
    });
    invalidateCategoryCache();
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "A category with this name already exists for that location." });
    res.status(500).json({ message: err.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { name, price, description, capacity, images, active } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (price !== undefined) {
      const n = Number(price);
      if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ message: "Price must be greater than 0." });
      update.price = n;
    }
    if (description !== undefined) update.description = description.trim();
    if (capacity !== undefined) update.capacity = Number(capacity) || 2;
    if (images !== undefined) update.images = images;
    if (active !== undefined) update.active = active;
    const category = await Category.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!category) return res.status(404).json({ message: "Category not found." });
    invalidateCategoryCache();
    res.json(category);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "A category with this name already exists for that location." });
    res.status(500).json({ message: err.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found." });
    const roomCount = await Room.countDocuments({ category: category.name, accommodationType: category.accommodationType });
    if (roomCount > 0)
      return res.status(400).json({ message: `Cannot delete category "${category.name}" — it has ${roomCount} room(s). Deactivate it instead.` });
    await Category.findByIdAndDelete(req.params.id);
    invalidateCategoryCache();
    res.json({ message: "Category deleted." });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
