const mongoose = require("mongoose");

const maintenanceReportSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  description: { type: String, required: true },
  reporterName: { type: String, default: "" },
  status: { type: String, enum: ["open", "resolved"], default: "open" },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

maintenanceReportSchema.index({ room: 1, status: 1 });
maintenanceReportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("MaintenanceReport", maintenanceReportSchema);
