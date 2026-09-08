const jwt = require("jsonwebtoken");
const User = require("../models/User");

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

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
    const clients = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Lets an existing admin promote another registered account to admin, or
// demote an admin back to client — so adding staff never requires direct
// database access.
exports.setUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!["admin", "client"].includes(role)) return res.status(400).json({ message: "Role must be 'admin' or 'client'." });
    if (req.params.id === req.user._id.toString()) return res.status(400).json({ message: "You can't change your own role." });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Account not found." });
    user.role = role;
    await user.save();
    res.json({ message: `${user.name} is now ${role === "admin" ? "an admin" : "a client"}.`, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
