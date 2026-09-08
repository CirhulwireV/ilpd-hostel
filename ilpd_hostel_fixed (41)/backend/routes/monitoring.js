const express = require("express");
const router = express.Router();
const { createMonitoringRecord, getMonitoringRecords, getMonitoringForBooking } = require("../controllers/monitoringController");
const { protect, adminOnly } = require("../middleware/auth");

router.get("/", protect, adminOnly, getMonitoringRecords);
router.get("/booking/:bookingId", protect, getMonitoringForBooking);
router.post("/", protect, adminOnly, createMonitoringRecord);

module.exports = router;
