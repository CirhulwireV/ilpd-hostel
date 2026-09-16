const mongoose = require("mongoose");

// Stores admin-configurable names for accommodation locations and blocks.
// The two built-in accommodation types (ilpd_building, outside_hostel) can
// be renamed by the admin at any time. New blocks are created by the admin
// when adding rooms; this collection just stores their display labels.
const locationSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g. "ilpd_building", "outside_hostel"
  label: { type: String, required: true, trim: true },  // admin-chosen display name
  description: { type: String, default: "", trim: true },
}, { timestamps: true });

module.exports = mongoose.model("LocationSettings", locationSettingsSchema);
