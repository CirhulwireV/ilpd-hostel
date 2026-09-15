const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const Booking = require("../models/Booking");

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const ACTIVE_STATUSES = ["pending", "confirmed", "checked-in"];

exports.register = async (req, res) => {
  const { name, email, password, phone, nationalIdOrPassport, nationality, position, addressOrInstitution, purposeOfVisit } = req.body;
  try {
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: "Name, email and password are required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    if (await User.findOne({ email: email.trim().toLowerCase() })) return res.status(400).json({ message: "Email already exists" });
    const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), password, phone: phone?.trim(), nationalIdOrPassport: nationalIdOrPassport?.trim(), nationality: nationality?.trim(), position: position?.trim(), addressOrInstitution: addressOrInstitution?.trim(), purposeOfVisit: purposeOfVisit?.trim() });
    res.status(201).json({ token: generateToken(user._id), user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email?.trim() || !password) return res.status(400).json({ message: "Email and password are required" });
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await user.matchPassword(password))) return res.status(401).json({ message: "Invalid credentials" });
    if (user.deletedAt) return res.status(403).json({ message: "This account has been deleted. Please register a new one." });
    res.json({ token: generateToken(user._id), user: { id: user._id, name: user.name, email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProfile = async (req, res) => {
  res.json(req.user);
};

exports.getAllClients = async (req, res) => {
  try {
    const clients = await User.find({ deletedAt: null }).select("-password").sort({ createdAt: -1 });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.setUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!["admin", "client"].includes(role)) return res.status(400).json({ message: "Role must be 'admin' or 'client'." });
    if (req.params.id === req.user._id.toString()) return res.status(400).json({ message: "You can't change your own role." });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Account not found." });
    if (user.deletedAt) return res.status(400).json({ message: "This account has been deleted." });
    user.role = role;
    await user.save();
    res.json({ message: `${user.name} is now ${role === "admin" ? "an admin" : "a client"}.`, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "Current and new passwords are required" });
    if (newPassword.length < 6) return res.status(400).json({ message: "New password must be at least 6 characters" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.deletedAt) return res.status(403).json({ message: "This account has been deleted" });

    const matches = await user.matchPassword(currentPassword);
    if (!matches) return res.status(401).json({ message: "Current password is incorrect" });

    user.password = newPassword;
    await user.save();
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: "Password is required to confirm deletion" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.deletedAt) return res.status(403).json({ message: "This account is already deleted" });

    const matches = await user.matchPassword(password);
    if (!matches) return res.status(401).json({ message: "Password is incorrect" });

    if (user.role === "admin") {
      const otherAdmins = await User.countDocuments({ role: "admin", deletedAt: null, _id: { $ne: user._id } });
      if (otherAdmins === 0) {
        return res.status(400).json({
          message: "You're the only admin. Promote another user to admin first, then delete your account."
        });
      }
    }

    const activeCount = await Booking.countDocuments({
      client: user._id,
      status: { $in: ACTIVE_STATUSES },
    });
    if (activeCount > 0) {
      return res.status(400).json({
        message: `You have ${activeCount} active booking${activeCount > 1 ? "s" : ""}. Please wait until they are completed or cancelled, then try again.`
      });
    }

    user.deletedAt = new Date();
    user.name = "Deleted User";
    user.email = `deleted-${user._id}@deleted.local`;
    user.phone = "";
    user.nationalIdOrPassport = "";
    user.nationality = "";
    user.position = "";
    user.addressOrInstitution = "";
    user.purposeOfVisit = "";
    user.password = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 10);
    await user.save();

    res.json({ message: "Your account has been deleted. Goodbye." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};