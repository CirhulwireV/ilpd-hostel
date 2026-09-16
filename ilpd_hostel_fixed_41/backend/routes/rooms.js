const express = require("express");
const router = express.Router();
const { getRooms, getRates, getBlocks, getAvailableRoomsForBooking, getInventorySummary, getRoomById, createRoom, bulkCreateRooms, updateRoom, deleteRoom, checkRoomHealth, uploadRoomImages } = require("../controllers/roomController");
const { protect, adminOnly } = require("../middleware/auth");
const { cache } = require("../middleware/cache");
const roomImageUpload = require("../middleware/roomImageUpload");

router.get("/", cache((req) => `rooms:${req.query.accommodationType || "all"}:${req.query.category || "all"}:${req.query.status || "all"}`, 60), getRooms);
router.get("/rates", cache((req) => `rates:${req.query.accommodationType || "all"}`, 120), getRates);
router.get("/blocks", cache((req) => `room-blocks:${req.query.accommodationType || "all"}`, 120), getBlocks);
router.get("/inventory-summary", cache((req) => `inventory:${req.query.accommodationType || "all"}`, 60), getInventorySummary);
router.get("/available-for-booking", getAvailableRoomsForBooking); // never cache — must be real-time
router.post("/health-check", protect, adminOnly, checkRoomHealth);
router.post("/images", protect, adminOnly, roomImageUpload.array("images", 5), uploadRoomImages);
router.post("/", protect, adminOnly, createRoom);
router.post("/bulk", protect, adminOnly, bulkCreateRooms);
router.get("/:id", getRoomById);
router.put("/:id", protect, adminOnly, updateRoom);
router.delete("/:id", protect, adminOnly, deleteRoom);

module.exports = router;
