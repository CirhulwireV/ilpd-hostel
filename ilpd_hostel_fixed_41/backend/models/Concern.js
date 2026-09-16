const mongoose = require("mongoose");

const concernSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
  client: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  response: { type: String, default: "" },
  status: { type: String, enum: ["open", "responded", "closed"], default: "open" },
}, { timestamps: true });

concernSchema.index({ client: 1, createdAt: -1 });
concernSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Concern", concernSchema);
