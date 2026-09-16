const Concern = require("../models/Concern");
const Booking = require("../models/Booking");

exports.createConcern = async (req, res) => {
  const { bookingId, subject, message } = req.body;
  try {
    
    if (!subject || !message) return res.status(400).json({ message: "Subject and message are required." });
    let booking;
    if (bookingId) {
      booking = await Booking.findById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found." });
      if (booking.client.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "You can only submit a concern for your own booking." });
      }
    }
    const concern = await Concern.create({
      booking: booking?._id,
      client: req.user._id,
      subject,
      message,
    });
    res.status(201).json(concern);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getConcerns = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Number(req.query.limit) || 100);
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const [concerns, total] = await Promise.all([
      Concern.find(filter)
        .populate("client", "name email phone")
        .populate({ path: "booking", populate: { path: "room", select: "roomNumber accommodationType" } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Concern.countDocuments(filter),
    ]);
    res.json({ concerns, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyConcerns = async (req, res) => {
  try {
    const concerns = await Concern.find({ client: req.user._id })
      .populate("client", "name email phone")
      .sort({ createdAt: -1 });
    res.json(concerns);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.respondToConcern = async (req, res) => {
  const { response } = req.body;
  try {
    if (!response) return res.status(400).json({ message: "Response is required." });
    const concern = await Concern.findByIdAndUpdate(req.params.id, { response, status: "responded" }, { new: true })
      .populate("client", "name email phone");
    if (!concern) return res.status(404).json({ message: "Concern not found." });
    res.json(concern);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

