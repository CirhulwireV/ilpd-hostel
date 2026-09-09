const mongoose = require("mongoose");

const subBlockSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "", trim: true },
  active: { type: Boolean, default: true },
}, { _id: true });

const blockSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  accommodationType: { type: String, enum: ["outside_hostel", "ilpd_building"], required: true },
  usesCategories: { type: Boolean, default: true }, // false = all rooms same tariff
  description: { type: String, default: "", trim: true },
  active: { type: Boolean, default: true },
  subBlocks: [subBlockSchema],
}, { timestamps: true });

blockSchema.index({ name: 1, accommodationType: 1 }, { unique: true });

module.exports = mongoose.model("Block", blockSchema);
