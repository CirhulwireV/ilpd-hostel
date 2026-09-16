const mongoose = require("mongoose");

const accommodationMonitoringSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  monitoringDate: { type: Date, required: true },
  cleanliness: { type: String, enum: ["good", "needs-attention", "poor"], required: true },
  maintenance: { type: String, enum: ["good", "issue-reported", "maintenance-required"], required: true },
  serviceStatus: { type: String, enum: ["satisfactory", "needs-attention", "not-satisfactory"], required: true },
  notes: { type: String, default: "" },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

accommodationMonitoringSchema.index({ booking: 1, monitoringDate: 1 }, { unique: true });

module.exports = mongoose.model("AccommodationMonitoring", accommodationMonitoringSchema);
