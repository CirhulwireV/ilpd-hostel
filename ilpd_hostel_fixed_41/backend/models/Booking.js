const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
  numberOfOccupants: { type: Number, default: 1, min: 1, max: 20 },
  occupants: [{
    name: { type: String, default: "" },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
    plannedCheckIn: { type: Date },
    plannedCheckOut: { type: Date },
    actualCheckIn: { type: Date, default: null },
    actualCheckOut: { type: Date, default: null },
    status: { type: String, enum: ["pending", "confirmed", "checked-in", "checked-out"], default: "pending" },
    refundAmount: { type: Number, default: 0 },
    registration: {
      names: { type: String, default: "" },
      nationalIdOrPassport: { type: String, default: "" },
      nationality: { type: String, default: "" },
      position: { type: String, default: "" },
      addressOrInstitution: { type: String, default: "" },
      purposeOfVisit: { type: String, default: "" },
      phoneNumber: { type: String, default: "" },
      completedAt: { type: Date, default: null },
      checkoutCompletedAt: { type: Date, default: null },
    },
  }],
  // Used for legacy/single-occupant bookings that do not use the occupant array.
  registration: {
    names: { type: String, default: "" },
    nationalIdOrPassport: { type: String, default: "" },
    nationality: { type: String, default: "" },
    position: { type: String, default: "" },
    addressOrInstitution: { type: String, default: "" },
    purposeOfVisit: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    completedAt: { type: Date, default: null },
    checkoutCompletedAt: { type: Date, default: null },
  },
  category: { type: String, required: true, trim: true }, // dynamic — matches Category collection
  accommodationType: { type: String, enum: ["outside_hostel", "ilpd_building"], default: "outside_hostel" },
  billingPeriod: { type: String, enum: ["month", "night"], default: "month" },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  monthlyRate: { type: Number, default: 0 },
  billingMonths: { type: Number, default: 1, min: 0 },
  billingNights: { type: Number, default: 0, min: 0 },
  totalPrice: { type: Number, required: true },
  status: { type: String, enum: ["pending", "confirmed", "check-in-requested", "checked-in", "check-out-requested", "checked-out", "cancelled", "rejected"], default: "pending" },
  paymentStatus: { type: String, enum: ["unpaid", "paid", "partially_refunded", "refunded", "refund_pending"], default: "unpaid" },
  stripePaymentId: { type: String, unique: true, sparse: true },
  stripeSessionId: { type: String, unique: true, sparse: true },
  paymentTransactions: [{
    paymentIntentId: { type: String },
    amount: { type: Number, default: 0 },
    refundedAmount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  }],
  refundAmountOwed: { type: Number, default: 0 },
  financialAdjustments: [{
    type: { type: String, enum: ["date-reduction", "date-extension", "early-checkout", "cancellation", "refund", "additional-payment"], required: true },
    amount: { type: Number, default: 0 },
    reason: { type: String, default: "" },
    processedAutomatically: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  }],
  reviewed: { type: Boolean, default: false },
  roomVisit: {
    status: { type: String, enum: ["not-scheduled", "scheduled", "completed", "declined"], default: "not-scheduled" },
    scheduledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    notes: { type: String, default: "" },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
}, { timestamps: true });

// Legacy records created before category was mandatory may still have a missing category.
// When such a booking is saved (for example during check-in/check-out), derive the category
// from its allocated room so the workflow does not fail with "Path category is required".
bookingSchema.pre("validate", async function (next) {
  try {
    if (!this.category && this.room) {
      const Room = require("./Room");
      const room = await Room.findById(this.room).select("category").lean();
      if (room?.category) this.category = room.category;
    }
    next();
  } catch (err) {
    next(err);
  }
});

bookingSchema.index({ client: 1, createdAt: -1 });
bookingSchema.index({ status: 1, checkIn: 1 });
bookingSchema.index({ stripeSessionId: 1 }, { sparse: true });
bookingSchema.index({ room: 1, status: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
