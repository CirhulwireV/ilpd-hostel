const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  category: { type: String, required: true },
  accommodationType: { type: String, default: "outside_hostel" },
  blockName: { type: String, default: "" },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  numberOfOccupants: { type: Number, default: 1 },
  occupantNames: { type: [String], default: [] },
  billingType: { type: String, default: "per_month" },
  priceAtAdd: { type: Number, required: true },
  addedAt: { type: Date, default: Date.now },
}, { _id: true });

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  items: { type: [cartItemSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model("Cart", cartSchema);