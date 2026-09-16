const mongoose = require("mongoose");

const heroImageSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: "hero" },
  images: { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model("HeroImage", heroImageSchema);