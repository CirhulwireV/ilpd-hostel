const mongoose = require("mongoose");

const surveyQuestionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("SurveyQuestion", surveyQuestionSchema);
