const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  category: { type: String, required: true },
  blockName: { type: String, required: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  numberOfOccupants: { type: Number, default: 1, min: 1, max: 20 },
  occupantNames: { type: [String], default: [] },
  billingType: { type: String, enum: ["per_month", "per_night"], default: "per_month" },
  priceAtAdd: { type: Number, required: true },
  addedAt: { type: Date, default: Date.now },
}, { _id: true });

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  items: { type: [cartItemSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model("Cart", cartSchema);