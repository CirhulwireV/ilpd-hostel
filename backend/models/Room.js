const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true },
  category: { type: String, required: true, trim: true }, // dynamic — validated against Category collection
  accommodationType: { type: String, enum: ["outside_hostel", "ilpd_building"], default: "outside_hostel", index: true },
  hostelSection: { type: String, required: false, trim: true },
  hostelSections: { type: [String], default: [] },
  subBlock: { type: String, default: "", trim: true },
  active: { type: Boolean, default: true },
  price: { type: Number, required: true },
  status: { type: String, enum: ["available", "booked", "maintenance"], default: "available" },
  amenities: [String],
  address: { type: String, default: "" },
  description: { type: String },
  bedType: { type: String },
  maxGuests: { type: Number, default: 2 },
  size: { type: String },
  view: { type: String },
  // Up to 5 photos per room. Kept as an array of data URLs (no external
  // storage service needed), with a per-image and per-room total size cap
  // enforced in the controller so a handful of photos per room never bloats
  // a single database document.
  images: { type: [String], default: [] },
  imageData: { type: String, default: "" }, // legacy single-image field, kept for old records
  imageName: { type: String, default: "" },
}, { timestamps: true });

roomSchema.index({ accommodationType: 1, roomNumber: 1, hostelSection: 1 }, { unique: true });

module.exports = mongoose.model("Room", roomSchema);
