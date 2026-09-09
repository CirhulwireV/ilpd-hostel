const express = require("express");
const router = express.Router();
const {
  createSurvey, getSurveys,
  getActiveSurveyQuestions, getAllSurveyQuestions, createSurveyQuestion, updateSurveyQuestion, deleteSurveyQuestion,
} = require("../controllers/surveyController");
const { protect, adminOnly } = require("../middleware/auth");

router.post("/", protect, createSurvey);
router.get("/", protect, adminOnly, getSurveys);
router.get("/questions/active", protect, getActiveSurveyQuestions);
router.get("/questions/all", protect, adminOnly, getAllSurveyQuestions);
router.post("/questions", protect, adminOnly, createSurveyQuestion);
router.put("/questions/:id", protect, adminOnly, updateSurveyQuestion);
router.delete("/questions/:id", protect, adminOnly, deleteSurveyQuestion);

module.exports = router;
