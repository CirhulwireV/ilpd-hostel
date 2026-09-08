const express = require("express");
const router = express.Router();
const { register, login, getProfile, getAllClients, setUserRole } = require("../controllers/authController");
const { protect, adminOnly } = require("../middleware/auth");
const { loginLimiter, registerLimiter } = require("../middleware/rateLimiter");

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.get("/profile", protect, getProfile);
router.get("/clients", protect, adminOnly, getAllClients);
router.put("/clients/:id/role", protect, adminOnly, setUserRole);

module.exports = router;
