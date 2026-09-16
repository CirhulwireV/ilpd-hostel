const AccommodationMonitoring = require("../models/AccommodationMonitoring");
const Booking = require("../models/Booking");

const startOfDay = (value = new Date()) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

exports.createMonitoringRecord = async (req, res) => {
  try {
    const { bookingId, monitoringDate, cleanliness, maintenance, serviceStatus, notes = "" } = req.body;
    if (!bookingId || !cleanliness || !maintenance || !serviceStatus) {
      return res.status(400).json({ message: "Booking, cleanliness, maintenance and service status are required." });
    }

    const booking = await Booking.findById(bookingId).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (booking.status !== "checked-in") return res.status(400).json({ message: "Daily accommodation monitoring is only available for checked-in occupants." });
    if (!booking.room) return res.status(400).json({ message: "This booking has no allocated room." });

    const date = startOfDay(monitoringDate || new Date());
    if (!date) return res.status(400).json({ message: "Invalid monitoring date." });
    const checkIn = startOfDay(booking.checkIn);
    const checkOut = startOfDay(booking.checkOut);
    const today = startOfDay(new Date());
    if (date > today) return res.status(400).json({ message: "Daily accommodation monitoring cannot be recorded for a future date." });
    if (date < checkIn || date >= checkOut) {
      return res.status(400).json({ message: "Monitoring date must fall within the occupant's accommodation period." });
    }

    const allowedCleanliness = ["good", "needs-attention", "poor"];
    const allowedMaintenance = ["good", "issue-reported", "maintenance-required"];
    const allowedService = ["satisfactory", "needs-attention", "not-satisfactory"];
    if (!allowedCleanliness.includes(cleanliness) || !allowedMaintenance.includes(maintenance) || !allowedService.includes(serviceStatus)) {
      return res.status(400).json({ message: "Invalid monitoring status value." });
    }

    const record = await AccommodationMonitoring.findOneAndUpdate(
      { booking: booking._id, monitoringDate: date },
      { booking: booking._id, room: booking.room._id, monitoringDate: date, cleanliness, maintenance, serviceStatus, notes: String(notes).trim(), recordedBy: req.user._id },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate("booking", "category checkIn checkOut status").populate("room", "roomNumber category").populate("recordedBy", "name email");

    res.status(200).json(record);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "A monitoring record already exists for this booking and date." });
    res.status(500).json({ message: err.message });
  }
};

exports.getMonitoringRecords = async (req, res) => {
  try {
    const date = startOfDay(req.query.date || new Date());
    if (!date) return res.status(400).json({ message: "Invalid monitoring date." });
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const records = await AccommodationMonitoring.find({ monitoringDate: { $gte: date, $lt: next } })
      .populate({ path: "booking", select: "category checkIn checkOut status client room", populate: { path: "client", select: "name email" } })
      .populate("room", "roomNumber category")
      .populate("recordedBy", "name email")
      .sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMonitoringForBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (req.user.role !== "admin" && booking.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You are not authorized to view these monitoring records." });
    }
    const records = await AccommodationMonitoring.find({ booking: booking._id }).populate("room", "roomNumber category").populate("recordedBy", "name email").sort({ monitoringDate: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
