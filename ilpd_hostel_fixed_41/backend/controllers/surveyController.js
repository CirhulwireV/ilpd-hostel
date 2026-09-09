const Survey = require("../models/Survey");
const Booking = require("../models/Booking");
const SurveyQuestion = require("../models/SurveyQuestion");

exports.createSurvey = async (req, res) => {
  const { bookingId, rating, comments, answers } = req.body;
  try {
    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: "Please submit a rating between 1 and 5." });
    }

    let booking;
    if (bookingId) {
      booking = await Booking.findById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found." });
      if (booking.client.toString() !== req.user._id.toString()) return res.status(403).json({ message: "You can only review your own booking." });
      if (!booking.reviewed) booking.reviewed = true;
      else return res.status(400).json({ message: "This booking has already been reviewed." });
      if (booking.status !== "checked-out") {
        return res.status(400).json({ message: "A survey can only be submitted after you have checked out." });
      }
    }

    const cleanAnswers = Array.isArray(answers)
      ? answers.filter((a) => a?.question).map((a) => ({ question: String(a.question).trim(), answer: String(a.answer || "").trim() }))
      : [];

    const survey = await Survey.create({
      booking: booking?._id,
      client: req.user._id,
      rating: numericRating,
      comments: String(comments || "").trim(),
      answers: cleanAnswers,
    });

    if (booking) await booking.save();
    res.status(201).json(survey);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "This booking has already been reviewed." });
    res.status(500).json({ message: err.message });
  }
};

exports.getSurveys = async (req, res) => {
  try {
    const surveys = await Survey.find()
      .populate("client", "name email")
      .sort({ createdAt: -1 });
    res.json(surveys);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// The open-ended questions asked alongside the rating are entirely
// admin-defined - nothing here is hardcoded by the system. Public (not
// admin-only) so a client filling out the survey form can see the current
// question list.
exports.getActiveSurveyQuestions = async (req, res) => {
  try {
    const questions = await SurveyQuestion.find({ active: true }).sort({ createdAt: 1 });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllSurveyQuestions = async (req, res) => {
  try {
    const questions = await SurveyQuestion.find().sort({ createdAt: 1 });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createSurveyQuestion = async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();
    if (!text) return res.status(400).json({ message: "Question text is required." });
    const question = await SurveyQuestion.create({ text });
    res.status(201).json(question);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateSurveyQuestion = async (req, res) => {
  try {
    const { text, active } = req.body;
    const update = {};
    if (text !== undefined) update.text = String(text).trim();
    if (active !== undefined) update.active = !!active;
    const question = await SurveyQuestion.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!question) return res.status(404).json({ message: "Question not found." });
    res.json(question);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteSurveyQuestion = async (req, res) => {
  try {
    const question = await SurveyQuestion.findByIdAndDelete(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found." });
    res.json({ message: "Question removed." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
