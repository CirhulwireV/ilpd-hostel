const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  accommodationType: { type: String, enum: ["outside_hostel", "ilpd_building"], required: true },
  price: { type: Number, required: true, min: 1 },
  description: { type: String, default: "", trim: true },
  capacity: { type: Number, default: 2, min: 1 },
  images: { type: [String], default: [] },
  active: { type: Boolean, default: true },
}, { timestamps: true });

categorySchema.index({ name: 1, accommodationType: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
