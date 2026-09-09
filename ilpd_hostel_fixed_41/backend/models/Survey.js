const mongoose = require("mongoose");

const surveySchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", unique: true, sparse: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comments: { type: String, default: "" },
  // Answers to whatever open-ended questions the admin had configured at the
  // time this survey was submitted. Storing the question text alongside the
  // answer (not just a question ID) means old responses stay readable even
  // if the admin edits or removes that question later.
  answers: [{
    question: { type: String, required: true },
    answer: { type: String, default: "" },
  }],
}, { timestamps: true });

module.exports = mongoose.model("Survey", surveySchema);
