const LocationSettings = require("../models/LocationSettings");
const Room = require("../models/Room");
const redis = require("../utils/redis");

const invalidateLocationCache = () => Promise.all([
  redis.del("location-settings"),
  redis.delPattern("location-blocks:*"),
]);

// GET /api/location-settings — public, returns all location labels
exports.getLocationSettings = async (req, res) => {
  try {
    const settings = await LocationSettings.find().lean();
    // Return as a map { key: label } for easy frontend consumption
    const map = {};
    for (const s of settings) map[s.key] = { label: s.label, description: s.description || "" };
    // Fill in any missing built-in defaults
    for (const [key, label] of Object.entries(BUILT_IN_DEFAULTS)) {
      if (!map[key]) map[key] = { label, description: "" };
    }
    res.json(map);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/location-settings/:key — admin only, rename a location or block
exports.updateLocationSetting = async (req, res) => {
  try {
    const { label, description } = req.body;
    if (!label?.trim()) return res.status(400).json({ message: "Label is required." });
    const setting = await LocationSettings.findOneAndUpdate(
      { key: req.params.key },
      { label: label.trim(), description: (description || "").trim() },
      { upsert: true, new: true }
    );
    invalidateLocationCache();
    res.json(setting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/location-settings/blocks — public, returns all known block names
exports.getBlocks = async (req, res) => {
  try {
    const accommodationType = req.query.accommodationType || "outside_hostel";
    const blocks = await Room.distinct("hostelSection", {
      accommodationType,
      hostelSection: { $nin: [null, ""] },
    });
    res.json(blocks.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/location-settings/blocks — admin only, register a new block name
// (Rooms are still created via /api/rooms; this just pre-registers a block label
//  so it appears in the datalist before any rooms are added to it.)
exports.createBlock = async (req, res) => {
  try {
    const { name, accommodationType = "outside_hostel" } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Block name is required." });
    const key = `block:${accommodationType}:${name.trim().toLowerCase().replace(/\s+/g, "_")}`;
    const setting = await LocationSettings.findOneAndUpdate(
      { key },
      { $setOnInsert: { key, label: name.trim(), description: accommodationType } },
      { upsert: true, new: true }
    );
    invalidateLocationCache();
    res.status(201).json({ name: setting.label, key: setting.key });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/location-settings/blocks/:key — admin only, remove a registered block
exports.deleteBlock = async (req, res) => {
  try {
    await LocationSettings.findOneAndDelete({ key: req.params.key });
    invalidateLocationCache();
    res.json({ message: "Block removed." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
