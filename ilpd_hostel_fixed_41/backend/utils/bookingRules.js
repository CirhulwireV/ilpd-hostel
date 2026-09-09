const ACCOMMODATION_TYPES = {
  outside_hostel: { label: "Hostel Block (Outside ILPD Building)", billingPeriod: "month" },
  ilpd_building: { label: "ILPD Institution Building", billingPeriod: "night" },
};
const DEFAULT_ACCOMMODATION_TYPE = "outside_hostel";

const getAccommodationConfig = (type = DEFAULT_ACCOMMODATION_TYPE) => {
  return ACCOMMODATION_TYPES[type] || ACCOMMODATION_TYPES[DEFAULT_ACCOMMODATION_TYPE];
};

// The admin sets a room's price directly when creating/editing it (Rooms tab).
// This looks up the CURRENT going rate for a category/location by reading the
// most recently updated room of that kind — there is no hardcoded price table
// anymore. Because each booking snapshots its own monthlyRate/totalPrice at
// creation time and never re-reads this later, changing prices here only
// affects bookings made from this point forward; past and in-progress
// bookings are unaffected.
const getBaseRate = async (category, accommodationType = DEFAULT_ACCOMMODATION_TYPE) => {
  const Room = require("../models/Room");
  const room = await Room.findOne({ accommodationType, category }).sort({ updatedAt: -1 }).select("price").lean();
  return Number(room?.price || 0);
};

// Every distinct category currently configured (has at least one room) for a
// location, with its current price. Also merges in any Category documents so
// admin-created categories appear even before rooms are added to them.
const getAvailableRates = async (accommodationType = DEFAULT_ACCOMMODATION_TYPE) => {
  const Room = require("../models/Room");
  const Category = require("../models/Category");
  const config = getAccommodationConfig(accommodationType);

  // Pull prices from Category collection first (admin-managed)
  const categories = await Category.find({
    active: true,
    $or: [{ accommodationType }, { accommodationType: { $exists: false } }, { accommodationType: null }]
  }).select("name price").lean();
  const byCategory = new Map(categories.map((c) => [c.name, Number(c.price || 0)]));

  // Fall back to room prices for any category not yet in Category collection
  const rooms = await Room.find({ accommodationType }).select("category price updatedAt").sort({ updatedAt: -1 }).lean();
  for (const r of rooms) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, Number(r.price || 0));
  }

  return [...byCategory.entries()].map(([category, price]) => ({ category, price, billingPeriod: config.billingPeriod }));
};
// The proposed process requires a cancellation deadline policy. Keep it configurable
// so ILPD can change the policy without changing application code.
const CANCELLATION_DEADLINE_DAYS = Math.max(0, Number(process.env.CANCELLATION_DEADLINE_DAYS || 7));

const ACTIVE_BOOKING_STATUSES = ["confirmed", "checked-in"];

const addMonthsClamped = (date, months) => {
  const result = new Date(date);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
};

const calculateBillingMonths = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  let months = (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12
    + (endDate.getUTCMonth() - startDate.getUTCMonth());
  if (months < 0) return 0;
  const anniversary = addMonthsClamped(startDate, months);
  if (anniversary < endDate) months += 1;
  return Math.max(1, months);
};

const validateDateRange = (checkIn, checkOut) => {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
    return { error: "Invalid check-in or check-out date" };
  }
  if (checkOutDate <= checkInDate) return { error: "Check-out must be after check-in" };
  return { checkInDate, checkOutDate };
};

const validateBookingDates = (checkIn, checkOut) => {
  const result = validateDateRange(checkIn, checkOut);
  if (result.error) return result;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (result.checkInDate < today) return { error: "Check-in date cannot be in the past" };
  return result;
};

const hasDateOverlap = (checkIn, checkOut, existingIn, existingOut) => {
  return new Date(checkIn) < new Date(existingOut) && new Date(checkOut) > new Date(existingIn);
};

const getCancellationDeadline = (checkIn) => {
  const deadline = new Date(checkIn);
  deadline.setHours(0, 0, 0, 0);
  deadline.setDate(deadline.getDate() - CANCELLATION_DEADLINE_DAYS);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
};


const REFUND_DAILY_DIVISOR = Math.max(1, Number(process.env.REFUND_DAILY_DIVISOR || 30));
const EDIT_DEADLINE_HOURS = Math.max(0, Number(process.env.BOOKING_EDIT_DEADLINE_HOURS || 0));

const calculateStayDays = (start, end) => {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
};

// Pricing used for post-payment date changes. A full 30-day block costs one
// monthly rate; remaining days are charged/refunded pro-rata. This makes a
// shorter stay eligible for a fair unused-day refund and an extension payable
// without changing the original monthly tariff.
const calculateProratedStayPrice = (start, end, rate, billingPeriod = "month") => {
  const days = calculateStayDays(start, end);
  if (billingPeriod === "night") return Math.round(days * Number(rate || 0));
  const fullBlocks = Math.floor(days / REFUND_DAILY_DIVISOR);
  const remainingDays = days % REFUND_DAILY_DIVISOR;
  return Math.round(fullBlocks * Number(rate || 0) + (remainingDays ? (remainingDays / REFUND_DAILY_DIVISOR) * Number(rate || 0) : 0));
};

const calculateUnusedStayRefund = (booking, now = new Date()) => {
  const start = new Date(booking.checkIn);
  const end = new Date(booking.checkOut);
  const totalPaid = Number(booking.totalPrice || 0);
  const billingPeriod = booking.billingPeriod || getAccommodationConfig(booking.accommodationType).billingPeriod;
  const baseRate = Number(booking.monthlyRate || 0);
  if (!totalPaid || !baseRate) return 0;
  if (now <= start) return totalPaid;
  if (now >= end) return 0;
  const elapsedDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  const earned = billingPeriod === "night"
    ? Math.min(totalPaid, elapsedDays * baseRate)
    : Math.min(totalPaid, (elapsedDays / REFUND_DAILY_DIVISOR) * baseRate);
  return Math.max(0, Math.round(totalPaid - earned));
};

const canClientEditPendingBooking = (booking, now = new Date()) => {
  if (!booking) return { allowed: false, error: "Booking not found." };
  if (booking.status !== "pending" || booking.room) {
    return { allowed: false, error: "A booking can only be edited while it is pending and before a room is allocated." };
  }
  if (EDIT_DEADLINE_HOURS > 0) {
    const hoursUntilCheckIn = (new Date(booking.checkIn).getTime() - now.getTime()) / (60 * 60 * 1000);
    if (hoursUntilCheckIn < EDIT_DEADLINE_HOURS) {
      return { allowed: false, error: `Booking changes must be made at least ${EDIT_DEADLINE_HOURS} hour${EDIT_DEADLINE_HOURS === 1 ? "" : "s"} before check-in.` };
    }
  }
  return { allowed: true };
};

const canClientCancelBooking = (booking, now = new Date()) => {
  if (!booking) return { allowed: false, error: "Booking not found." };
  if (!["pending", "confirmed"].includes(booking.status)) {
    return { allowed: false, error: "Only pending or confirmed bookings can be cancelled by the client." };
  }
  const deadline = getCancellationDeadline(booking.checkIn);
  if (now > deadline) {
    return {
      allowed: false,
      error: `The cancellation deadline has passed. Client cancellations must be requested at least ${CANCELLATION_DEADLINE_DAYS} day${CANCELLATION_DEADLINE_DAYS === 1 ? "" : "s"} before check-in.`,
      deadline,
    };
  }
  return { allowed: true, deadline };
};

module.exports = {
  ACCOMMODATION_TYPES,
  DEFAULT_ACCOMMODATION_TYPE,
  getAccommodationConfig,
  getBaseRate,
  getAvailableRates,
  ACTIVE_BOOKING_STATUSES,
  addMonthsClamped,
  calculateBillingMonths,
  validateBookingDates,
  validateDateRange,
  hasDateOverlap,
  CANCELLATION_DEADLINE_DAYS,
  getCancellationDeadline,
  canClientCancelBooking,
  REFUND_DAILY_DIVISOR,
  EDIT_DEADLINE_HOURS,
  calculateStayDays,
  calculateProratedStayPrice,
  calculateUnusedStayRefund,
  canClientEditPendingBooking,
};
