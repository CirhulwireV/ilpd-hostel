const express = require("express");
const router = express.Router();
const Cart = require("../models/Cart");
const Block = require("../models/Block");
const Room = require("../models/Room");
const Booking = require("../models/Booking");
const { protect } = require("../middleware/auth");
const { ACTIVE_BOOKING_STATUSES } = require("../utils/bookingRules");

const CART_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const CHECKIN_GRACE_MS = 24 * 60 * 60 * 1000;

const calculateBillingUnits = (checkIn, checkOut, billingType) => {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (billingType === "per_night") {
    return Math.max(1, Math.ceil((end - start) / 86400000));
  }
  let m = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  const ann = new Date(start);
  ann.setUTCDate(1);
  ann.setUTCMonth(ann.getUTCMonth() + m);
  const lastDay = new Date(Date.UTC(ann.getUTCFullYear(), ann.getUTCMonth() + 1, 0)).getUTCDate();
  ann.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  if (ann < end) m += 1;
  return Math.max(1, m);
};

const getBlockRate = async (blockName, category) => {
  const block = await Block.findOne({ name: blockName, active: true }).lean();
  if (!block) return { error: "block_inactive" };

  if (block.usesCategories === false) {
    const room = await Room.findOne({ hostelSection: blockName, active: true })
      .sort({ price: 1 })
      .select("price")
      .lean();
    if (!room) return { error: "unavailable" };
    return { rate: Number(room.price), billingType: block.billingType, block };
  }

  const room = await Room.findOne({ hostelSection: blockName, category, active: true })
    .sort({ price: 1 })
    .select("price")
    .lean();
  if (!room) return { error: "unavailable" };
  return { rate: Number(room.price), billingType: block.billingType, block };
};

const isBlockAvailableForDates = async (blockName, category, checkIn, checkOut, occupants) => {
  const roomFilter = { hostelSection: blockName, status: { $ne: "maintenance" }, active: true };
  if (category) roomFilter.category = category;
  const rooms = await Room.find(roomFilter).select("_id").lean();
  if (!rooms.length) return false;

  const roomIds = rooms.map((r) => r._id);
  const conflicts = await Booking.find({
    status: { $in: ACTIVE_BOOKING_STATUSES },
    checkIn: { $lt: new Date(checkOut) },
    checkOut: { $gt: new Date(checkIn) },
    $or: [{ room: { $in: roomIds } }, { "occupants.room": { $in: roomIds } }],
  }).select("room occupants").lean();

  const blocked = new Set();
  conflicts.forEach((b) => {
    if (!b.occupants?.length && b.room) blocked.add(b.room.toString());
    (b.occupants || []).forEach((o) => { if (o.room && o.status !== "checked-out") blocked.add(o.room.toString()); });
  });

  return rooms.filter((r) => !blocked.has(r._id.toString())).length >= occupants;
};

const decorateItem = async (item) => {
  const now = Date.now();
  const age = now - new Date(item.addedAt).getTime();
  const decorated = item.toObject ? item.toObject() : { ...item };
  decorated.status = "ok";
  decorated.warnings = [];

  if (age > CART_MAX_AGE_MS) {
    decorated.status = "expired";
    decorated.warnings.push("This item is more than 24 hours old — prices and availability may have changed.");
    return decorated;
  }

  if (!item.checkIn || !item.checkOut || new Date(item.checkOut) <= new Date(item.checkIn)) {
    decorated.status = "date_invalid";
    decorated.warnings.push("Check-out must be after check-in.");
    return decorated;
  }

  if (new Date(item.checkIn).getTime() < now - CHECKIN_GRACE_MS) {
    decorated.status = "date_invalid";
    decorated.warnings.push("Check-in date is in the past.");
    return decorated;
  }

  const rateInfo = await getBlockRate(item.blockName, item.category);
  if (rateInfo.error === "block_inactive") {
    decorated.status = "block_inactive";
    decorated.warnings.push(`Block "${item.blockName}" is no longer available.`);
    return decorated;
  }
  if (rateInfo.error === "unavailable") {
    decorated.status = "unavailable";
    decorated.warnings.push(`No rooms are configured for ${item.blockName}${item.category ? " / " + item.category : ""}.`);
    return decorated;
  }

  decorated.currentPrice = rateInfo.rate;
  decorated.currentBillingType = rateInfo.billingType;

  if (Number(rateInfo.rate) !== Number(item.priceAtAdd)) {
    decorated.status = "price_changed";
    decorated.warnings.push(`Price changed from ${Number(item.priceAtAdd).toLocaleString()} RWF to ${Number(rateInfo.rate).toLocaleString()} RWF.`);
  }

  const available = await isBlockAvailableForDates(
    item.blockName,
    item.category,
    item.checkIn,
    item.checkOut,
    item.numberOfOccupants || 1
  );
  if (!available) {
    decorated.status = "unavailable";
    decorated.warnings.push("No rooms are available for these dates anymore.");
  }

  return decorated;
};

const decorateCart = async (cart) => {
  const decoratedItems = await Promise.all(cart.items.map(decorateItem));
  const obj = cart.toObject ? cart.toObject() : { ...cart };
  obj.items = decoratedItems;
  obj.hasIssues = decoratedItems.some((i) => i.status !== "ok");
  obj.issueCount = decoratedItems.filter((i) => i.status !== "ok").length;
  return obj;
};

// GET /api/cart
router.get("/", protect, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });
    res.json(await decorateCart(cart));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/cart/items
router.post("/items", protect, async (req, res) => {
  try {
    const {
      category,
      blockName,
      checkIn,
      checkOut,
      numberOfOccupants = 1,
      occupantNames = [],
    } = req.body;

    if (!blockName || !checkIn || !checkOut) {
      return res.status(400).json({ message: "blockName, checkIn and checkOut are required" });
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      return res.status(400).json({ message: "Check-out must be after check-in" });
    }
    if (new Date(checkIn).getTime() < Date.now() - CHECKIN_GRACE_MS) {
      return res.status(400).json({ message: "Check-in date cannot be in the past." });
    }
    const occupants = Math.min(20, Math.max(1, Number(numberOfOccupants || 1)));

    const rateInfo = await getBlockRate(blockName, category);
    if (rateInfo.error) {
      return res.status(400).json({
        message: rateInfo.error === "block_inactive"
          ? `Block "${blockName}" is not available.`
          : `No rooms configured for ${blockName}${category ? " / " + category : ""}.`,
      });
    }

    const available = await isBlockAvailableForDates(blockName, category, checkIn, checkOut, occupants);
    if (!available) {
      return res.status(409).json({ message: "No rooms are available in this block for the selected dates." });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    cart.items.push({
      category: category || blockName,
      blockName,
      checkIn,
      checkOut,
      numberOfOccupants: occupants,
      occupantNames: Array.isArray(occupantNames) ? occupantNames.slice(0, occupants) : [],
      billingType: rateInfo.billingType || "per_month",
      priceAtAdd: rateInfo.rate,
      addedAt: new Date(),
    });

    await cart.save();
    res.status(201).json(await decorateCart(cart));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/cart/items/:id
router.delete("/items/:id", protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: "Cart not found" });
    cart.items = cart.items.filter((it) => String(it._id) !== String(req.params.id));
    await cart.save();
    res.json(await decorateCart(cart));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/cart
router.delete("/", protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.json({ items: [], hasIssues: false, issueCount: 0 });
    cart.items = [];
    await cart.save();
    res.json(await decorateCart(cart));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/cart/items/:id/refresh — re-price and re-check one item
router.post("/items/:id/refresh", protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: "Cart not found" });
    const item = cart.items.id(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const rateInfo = await getBlockRate(item.blockName, item.category);
    if (rateInfo.error) {
      cart.items.pull({ _id: item._id });
      await cart.save();
      return res.json(await decorateCart(cart));
    }
    const available = await isBlockAvailableForDates(item.blockName, item.category, item.checkIn, item.checkOut, item.numberOfOccupants || 1);
    if (!available) {
      cart.items.pull({ _id: item._id });
      await cart.save();
      return res.json(await decorateCart(cart));
    }
    item.priceAtAdd = rateInfo.rate;
    item.billingType = rateInfo.billingType || "per_month";
    item.addedAt = new Date();
    await cart.save();
    res.json(await decorateCart(cart));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;