const express = require("express");
const router = express.Router();
const {
  createBooking,
  confirmBooking,
  cancelBookingById,
  allocateAndConfirm,
  reallocateRoom,
  getMyBookings,
  getAllBookings,
  getWeeklyReport,
  getMonthlyReport,
  updateBookingStatus,
  updateOccupantStatus,
  handleStripeWebhook,
  deleteBookingHistory,
  getBookingPolicy,
  cancelMyBooking,
  updateRoomVisit,
  updatePendingBooking,
  confirmBookingUpdate,
  extendOrReduceStay,
} = require("../controllers/bookingController");
const { protect, adminOnly } = require("../middleware/auth");
const { bookingActionLimiter } = require("../middleware/rateLimiter");

router.post("/", protect, bookingActionLimiter, createBooking);
router.get("/policy", protect, getBookingPolicy);
router.post("/confirm", protect, bookingActionLimiter, confirmBooking);
router.post("/confirm-update", protect, bookingActionLimiter, confirmBookingUpdate);
router.post("/webhook", handleStripeWebhook);
router.get("/my", protect, getMyBookings);
router.get("/report", protect, adminOnly, getWeeklyReport);
router.get("/monthly-report", protect, adminOnly, getMonthlyReport);
router.get("/", protect, adminOnly, getAllBookings);
router.post("/cancel/:id", protect, adminOnly, cancelBookingById);
router.post("/:id/cancel", protect, cancelMyBooking);
router.put("/:id/room-visit", protect, adminOnly, updateRoomVisit);
router.put("/:id/edit", protect, bookingActionLimiter, updatePendingBooking);
router.put("/:id/extend", protect, bookingActionLimiter, extendOrReduceStay);
router.put("/:id/allocate", protect, adminOnly, allocateAndConfirm);
router.put("/:id/reallocate", protect, adminOnly, reallocateRoom);
router.put("/:id/status", protect, adminOnly, updateBookingStatus);
router.put("/:id/occupants/:occupantId/status", protect, adminOnly, updateOccupantStatus);
router.delete("/:id/history", protect, deleteBookingHistory);

module.exports = router;
