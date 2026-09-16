const express = require("express");
const router = express.Router();
const Cart = require("../models/Cart");
const { protect } = require("../middleware/auth");

// GET /api/cart — fetch current user's cart
router.get("/", protect, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/cart/items — add an item
router.post("/items", protect, async (req, res) => {
  try {
    const {
      category, accommodationType = "outside_hostel", blockName = "",
      checkIn, checkOut, numberOfOccupants = 1, occupantNames = [],
      billingType = "per_month", priceAtAdd,
    } = req.body;

    if (!category || !checkIn || !checkOut || !priceAtAdd) {
      return res.status(400).json({ message: "category, checkIn, checkOut and priceAtAdd are required" });
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      return res.status(400).json({ message: "Check-out must be after check-in" });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    cart.items.push({
      category, accommodationType, blockName,
      checkIn, checkOut, numberOfOccupants, occupantNames,
      billingType, priceAtAdd,
    });

    await cart.save();
    res.status(201).json(cart);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/cart/items/:id — remove one item
router.delete("/items/:id", protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    cart.items = cart.items.filter((it) => String(it._id) !== String(req.params.id));
    await cart.save();
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/cart — clear the cart
router.delete("/", protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.json({ items: [] });
    cart.items = [];
    await cart.save();
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;