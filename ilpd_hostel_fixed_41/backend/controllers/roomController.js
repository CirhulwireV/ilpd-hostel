const Room = require("../models/Room");
const Booking = require("../models/Booking");
const { ACTIVE_BOOKING_STATUSES, ACCOMMODATION_TYPES, DEFAULT_ACCOMMODATION_TYPE, getAvailableRates } = require("../utils/bookingRules");
const Category = require("../models/Category");
const redis = require("../utils/redis");
const { getMissingSettings, uploadRoomImage } = require("../utils/s3");

const invalidateRoomCache = () => redis.delPattern("rooms:*").then(() => Promise.all([
  redis.delPattern("rates:*"),
  redis.delPattern("room-blocks:*"),
  redis.delPattern("inventory:*"),
]));

const getAllowedCategories = async (accommodationType) => {
  // Categories are admin-managed. Include global categories and any
  // legacy categories belonging to the selected accommodation type.
  const globalCats = await Category.find({
    active: true,
    $or: [{ accommodationType }, { accommodationType: { $exists: false } }, { accommodationType: null }]
  }).select("name").lean();
  return [...new Set(globalCats.map((c) => c.name))];
};

function getHostelSection(roomNumber, requestedSection) {
  const trimmed = String(requestedSection || "").trim();
  return trimmed || null;
}
const MAX_ROOM_IMAGE_BYTES = 3 * 1024 * 1024;
const validateImageData = (imageData) => {
  if (!imageData) return null;
  // New uploads are S3/CloudFront URLs; Base64 is accepted only for old records.
  if (typeof imageData === "string" && /^https:\/\//.test(imageData)) return null;
  if (typeof imageData !== "string" || !/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageData)) {
    return "Room image must be a JPG, PNG, or WebP image.";
  }
  const base64 = imageData.split(",")[1] || "";
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > MAX_ROOM_IMAGE_BYTES) return "Room image must be 3 MB or smaller.";
  return null;
};

// Uploads happen before a room is created or updated. The client then submits
// these URL strings to the existing room endpoints, keeping image bytes out of MongoDB.
exports.uploadRoomImages = async (req, res) => {
  const missingSettings = getMissingSettings();
  if (missingSettings.length) {
    return res.status(503).json({ message: `S3 uploads are not configured. Missing: ${missingSettings.join(", ")}.` });
  }
  if (!req.files?.length) return res.status(400).json({ message: "Select at least one room image." });

  try {
    const images = await Promise.all(req.files.map(uploadRoomImage));
    res.status(201).json({ images });
  } catch (err) {
    console.error("S3 room image upload failed:", err);
    res.status(502).json({ message: "Could not upload images to S3. Check the bucket, region, and IAM permissions." });
  }
};

// Rooms can have more than one photo. Capped at 5 so a room with many photos
// never turns into a huge database document - each photo is already capped
// at 3MB above, so 5 photos is a sane ceiling (~15MB worst case per room).
const MAX_ROOM_IMAGES = 5;
const validateImages = (images) => {
  if (!images || !images.length) return null;
  if (!Array.isArray(images)) return "Room photos must be a list of images.";
  if (images.length > MAX_ROOM_IMAGES) return `You can upload up to ${MAX_ROOM_IMAGES} photos per room.`;
  for (const img of images) {
    const err = validateImageData(img);
    if (err) return err;
  }
  return null;
};


const DEFAULT_CATEGORY_DEFAULTS = {
  maxGuests: 2, size: "25 m²", view: "Garden View", bedType: "Bed",
  description: "Comfortable room with essential amenities.",
  amenities: ["Bed", "TV", "Free WiFi", "Private Bathroom"],
};
const CATEGORY_DEFAULTS = new Proxy({}, {
  get: (_, key) => ({
    Standard: {
      maxGuests: 2,
      size: "25 m²",
      view: "Garden View",
      bedType: "Bed",
      description: "Comfortable and cozy room with all essential amenities for a pleasant stay.",
      amenities: ["Bed", "TV", "Free WiFi", "Private Bathroom"]
    },

    VIP: {
      maxGuests: 3,
      size: "40 m²",
      view: "City View",
      bedType: "Bed",
      description: "Spacious room with premium furnishings and city views.",
      amenities: ["Bed", "TV", "Free WiFi", "Private Bathroom"]
    },

    VVIP: {
      maxGuests: 4,
      size: "80 m²",
      view: "Panoramic View",
      bedType: "Bed",
      description: "Ultra-luxury VVIP room with panoramic views.",
      amenities: ["Bed", "TV", "Free WiFi", "Private Bathroom"]
    }
  }[key] || DEFAULT_CATEGORY_DEFAULTS)
});

exports.getRooms = async (req, res) => {
  try {
    const { category, status, accommodationType } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (accommodationType && ACCOMMODATION_TYPES[accommodationType]) {
      filter.accommodationType = accommodationType;
    }
    const rooms = await Room.find(filter).sort({ accommodationType: 1, roomNumber: 1, hostelSection: 1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getInventorySummary = async (req, res) => {
  try {
    const accommodationType = req.query.accommodationType;
    const filter = accommodationType && ACCOMMODATION_TYPES[accommodationType]
      ? { accommodationType }
      : {};
    const rooms = await Room.find(filter).select("roomNumber category accommodationType status").lean();
    const summary = {};
    for (const room of rooms) {
      const location = room.accommodationType || "outside_hostel";
      const category = room.category;
      summary[location] ||= {};
      summary[location][category] ||= { total: 0, available: 0, maintenance: 0, booked: 0 };
      summary[location][category].total += 1;
      if (room.status === "available") summary[location][category].available += 1;
      if (room.status === "maintenance") summary[location][category].maintenance += 1;
      if (room.status === "booked") summary[location][category].booked += 1;
    }
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBlocks = async (req, res) => {
  try {
    const accommodationType = req.query.accommodationType || "outside_hostel";
    const blocks = await Room.distinct("hostelSection", { accommodationType, hostelSection: { $ne: null } });
    res.json(blocks.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getRates = async (req, res) => {
  try {
    const accommodationType = req.query.accommodationType;
    if (!ACCOMMODATION_TYPES[accommodationType]) return res.status(400).json({ message: "Invalid accommodation location." });
    const rates = await getAvailableRates(accommodationType);
    res.json(rates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAvailableRoomsForBooking = async (req, res) => {
  try {
    const { category, checkIn, checkOut, accommodationType = DEFAULT_ACCOMMODATION_TYPE } = req.query;
    if (!category || !checkIn || !checkOut || !ACCOMMODATION_TYPES[accommodationType]) {
      return res.status(400).json({ message: "Category, check-in and check-out are required." });
    }
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ message: "Invalid booking dates." });
    }

    const locationFilter = accommodationType === "outside_hostel"
      ? "outside_hostel"
      : accommodationType;
    const rooms = await Room.find({ category, accommodationType: locationFilter, status: "available" }).sort({ roomNumber: 1, hostelSection: 1 }).lean();
    const roomIds = rooms.map((room) => room._id);
    const conflicts = await Booking.find({
      status: { $in: ACTIVE_BOOKING_STATUSES },
      checkIn: { $lt: end },
      checkOut: { $gt: start },
      $or: [{ room: { $in: roomIds } }, { "occupants.room": { $in: roomIds } }],
    }).select("room occupants").lean();
    const blocked = new Set();
    conflicts.forEach((b) => {
      if (!b.occupants?.length && b.room) blocked.add(b.room.toString());
      (b.occupants || []).forEach((o) => { if (o.room && o.status !== "checked-out") blocked.add(o.room.toString()); });
    });
    res.json(rooms.filter((room) => !blocked.has(room._id.toString())));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const { roomNumber, category, accommodationType = DEFAULT_ACCOMMODATION_TYPE, hostelSection: requestedSection, subBlock = "", price, address = "", images = [], imageData = "", imageName = "" } = req.body;
    if (!roomNumber || !category) {
      return res.status(400).json({ message: "Room number and category are required" });
    }
    const allowedCategories = await getAllowedCategories(accommodationType);
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ message: `Category must be one of: ${allowedCategories.join(", ")}` });
    }
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ message: "A price greater than 0 is required." });
    }
    if (!address.trim()) {
      return res.status(400).json({ message: "Location (town, province, country) is required." });
    }
    const hostelSection = getHostelSection(roomNumber, requestedSection);
    const allImages = images.length ? images : (imageData ? [imageData] : []);
    const imagesError = validateImages(allImages);
    if (imagesError) return res.status(400).json({ message: imagesError });
    if (!ACCOMMODATION_TYPES[accommodationType]) return res.status(400).json({ message: "Invalid accommodation location." });

    // Room numbers only need to be unique within the selected accommodation location.
    // This allows, for example, Room 101 to exist in both buildings.
    const existingFilter = { roomNumber, accommodationType };
    if (hostelSection) existingFilter.hostelSection = hostelSection;
    const existing = await Room.findOne(existingFilter);
    if (existing) {
      return res.status(409).json({
        message: `Room ${roomNumber} already exists in block "${hostelSection || "selected block"}".`
      });
    }
    const defaults = CATEGORY_DEFAULTS[category];
    const room = await Room.create({
      roomNumber,
      category,
      accommodationType,
      ...(hostelSection ? { hostelSection, hostelSections: [hostelSection] } : { hostelSections: [] }),
      subBlock: subBlock.trim(),
      price: numericPrice,
      address: address.trim(),
      maxGuests: req.body.maxGuests || defaults.maxGuests,
      size: req.body.size || defaults.size,
      view: req.body.view || defaults.view,
      bedType: req.body.bedType || defaults.bedType,
      description: req.body.description || defaults.description,
      amenities: req.body.amenities?.length ? req.body.amenities : defaults.amenities,
      images: allImages,
      imageData: allImages[0] || "",
      imageName: imageName || "",
      status: "available",
    });

    res.status(201).json(room);
    invalidateRoomCache();
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: `Room ${req.body.roomNumber} already exists in the selected block.`
      });
    }
    res.status(500).json({ message: err.message });
  }
};


exports.bulkCreateRooms = async (req, res) => {
  try {
    const {
      accommodationType = DEFAULT_ACCOMMODATION_TYPE,
      category,
      roomNumbers,
      startNumber,
      count,
      price,
      address = "",
      images = [],
      imageData = "",
      imageName = "",
      hostelSection: requestedSection,
      subBlock = "",
    } = req.body;

    if (!ACCOMMODATION_TYPES[accommodationType]) {
      return res.status(400).json({ message: "Invalid accommodation location." });
    }
    const allowedCategories = await getAllowedCategories(accommodationType);
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ message: `Category must be one of: ${allowedCategories.join(", ")}` });
    }
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ message: "A price greater than 0 is required." });
    }
    if (!address.trim()) {
      return res.status(400).json({ message: "Location (town, province, country) is required." });
    }

    let numbers = [];
    if (Array.isArray(roomNumbers)) {
      numbers = roomNumbers.map((n) => String(n).trim()).filter(Boolean);
    } else if (typeof roomNumbers === "string") {
      numbers = roomNumbers.split(",").map((n) => n.trim()).filter(Boolean);
    } else if (startNumber !== undefined && count !== undefined) {
      const start = Number(startNumber);
      const total = Number(count);
      if (!Number.isInteger(start) || !Number.isInteger(total) || total < 1 || total > 200) {
        return res.status(400).json({ message: "Starting room number and number of rooms must be valid. Maximum 200 rooms per batch." });
      }
      numbers = Array.from({ length: total }, (_, i) => String(start + i));
    }

    numbers = [...new Set(numbers)];
    if (!numbers.length) return res.status(400).json({ message: "Enter room numbers or provide a starting number and quantity." });
    if (numbers.length > 200) return res.status(400).json({ message: "You can create a maximum of 200 rooms at once." });
    if (numbers.some((n) => n.length > 30)) return res.status(400).json({ message: "Room numbers are too long." });

    const allImages = images.length ? images : (imageData ? [imageData] : []);
    const imagesError = validateImages(allImages);
    if (imagesError) return res.status(400).json({ message: imagesError });

    const sectionFor = (n) => accommodationType === "outside_hostel" ? getHostelSection(n, requestedSection) : null;
    const existing = await Room.find({ accommodationType, roomNumber: { $in: numbers }, hostelSection: { $in: numbers.map(sectionFor) } }).select("roomNumber hostelSection").lean();
    const existingSet = new Set(existing.map((r) => `${String(r.roomNumber)}|${r.hostelSection || ""}`));
    const duplicates = numbers.filter((n) => existingSet.has(`${n}|${sectionFor(n) || ""}`));

    if (duplicates.length) {
      return res.status(409).json({
        message: `These rooms already exist in the selected building: ${duplicates.join(", ")}.`,
        duplicates,
      });
    }

    const defaults = CATEGORY_DEFAULTS[category];
    const docs = numbers.map((roomNumber) => ({
      roomNumber,
      category,
      accommodationType,
      ...(sectionFor(roomNumber) ? { hostelSection: sectionFor(roomNumber), hostelSections: [sectionFor(roomNumber)] } : { hostelSections: [] }),
      subBlock: subBlock.trim(),
      price: numericPrice,
      address: address.trim(),
      maxGuests: defaults.maxGuests,
      size: defaults.size,
      view: defaults.view,
      bedType: defaults.bedType,
      description: defaults.description,
      amenities: defaults.amenities,
      images: allImages,
      imageData: allImages[0] || "",
      imageName: imageName || "",
      status: "available",
    }));

    const rooms = await Room.insertMany(docs, { ordered: true });
    res.status(201).json({ message: `${rooms.length} rooms created successfully.`, rooms, count: rooms.length });
    invalidateRoomCache();
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "One or more room numbers already exist in this building. Please refresh and try again." });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const { status, description, imageData, imageName, price, address, images, roomNumber, category, hostelSection, subBlock, active } = req.body;
    const allowed = {};
    if (roomNumber !== undefined) allowed.roomNumber = String(roomNumber).trim();
    if (category !== undefined) {
      const room = await Room.findById(req.params.id).select("accommodationType").lean();
      const allowedCategories = await getAllowedCategories(room?.accommodationType || DEFAULT_ACCOMMODATION_TYPE);
      if (!allowedCategories.includes(category)) return res.status(400).json({ message: `Category must be one of: ${allowedCategories.join(", ")}` });
      allowed.category = category;
    }
    if (hostelSection !== undefined) { allowed.hostelSection = hostelSection.trim(); allowed.hostelSections = hostelSection.trim() ? [hostelSection.trim()] : []; }
    if (subBlock !== undefined) allowed.subBlock = subBlock.trim();
    if (active !== undefined) allowed.active = active;
    if (address !== undefined) allowed.address = address.trim();
    if (price !== undefined) {
      const numericPrice = Number(price);
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({ message: "Price must be a number greater than 0." });
      }
      allowed.price = numericPrice;
    }
    if (status && ["available", "booked", "maintenance"].includes(status)) {
      const activeBooking = await Booking.findOne({
        room: req.params.id,
        status: { $in: ACTIVE_BOOKING_STATUSES },
      });
      if (status === "booked" && !activeBooking) {
        return res.status(400).json({ message: "A room can only be marked booked when it is assigned to an active booking." });
      }
      if (["available", "maintenance"].includes(status) && activeBooking) {
        return res.status(400).json({ message: "This room is linked to an active booking and cannot be marked available or maintenance manually." });
      }
      allowed.status = status;
    }
    if (description) allowed.description = description;
    if (images !== undefined) {
      const imagesError = validateImages(images);
      if (imagesError) return res.status(400).json({ message: imagesError });
      allowed.images = images;
      allowed.imageData = images[0] || "";
    } else if (imageData !== undefined) {
      const imageError = validateImageData(imageData);
      if (imageError) return res.status(400).json({ message: imageError });
      allowed.imageData = imageData;
      allowed.imageName = imageName || "";
      allowed.images = imageData ? [imageData] : [];
    }
    const room = await Room.findByIdAndUpdate(req.params.id, allowed, { new: true });
    if (!room) return res.status(404).json({ message: "Room not found" });
    invalidateRoomCache();
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });
    const anyBooking = await Booking.exists({ room: room._id });
    if (anyBooking) return res.status(400).json({ message: "Cannot delete a room that appears in booking history. Keep it for historical records instead." });
    await Room.findByIdAndDelete(req.params.id);
    invalidateRoomCache();
    res.json({ message: "Room deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Self-service version of what used to require a developer running a terminal
// script. Finds rooms that are exact duplicates (same location + room number
// + block) and merges them, moving any bookings onto one surviving room —
// never deleting a room if that would risk two guests' bookings overlapping.
// Also fixes any room stuck showing the wrong available/booked status.
// Pass ?dryRun=true to preview without making changes.
exports.checkRoomHealth = async (req, res) => {
  const dryRun = req.query.dryRun === "true";
  try {
    const rooms = await Room.find({});
    const groups = new Map();
    const keyOf = (r) => `${r.accommodationType}|${r.roomNumber}|${r.hostelSection || ""}`;
    for (const r of rooms) {
      const k = keyOf(r);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const duplicateGroups = [...groups.entries()].filter(([, rows]) => rows.length > 1);

    const mergedSummary = [];
    const conflicts = [];
    for (const [key, rows] of duplicateGroups) {
      if (dryRun) {
        mergedSummary.push({ key, count: rows.length });
        continue;
      }
      try {
        const scored = [];
        for (const r of rows) {
          const [direct, occupant] = await Promise.all([
            Booking.find({ room: r._id }).select("_id status checkIn checkOut").lean(),
            Booking.find({ "occupants.room": r._id }).select("_id status checkIn checkOut occupants").lean(),
          ]);
          scored.push({ r, refCount: direct.length + occupant.length });
        }
        // Prefer keeping the room with the most booking history, then the one with a photo.
        scored.sort((a, b) => b.refCount - a.refCount || Number(Boolean(b.r.imageData)) - Number(Boolean(a.r.imageData)));
        const keeper = scored[0].r;
        for (const { r } of scored.slice(1)) {
          const overlap = await Booking.findOne({
            $or: [{ room: r._id }, { "occupants.room": r._id }],
            status: { $in: ACTIVE_BOOKING_STATUSES },
          });
          if (overlap) {
            // Don't guess — surface it for a human to look at instead of merging.
            conflicts.push({ key, roomId: r._id, roomNumber: r.roomNumber });
            continue;
          }
          await Booking.updateMany({ room: r._id }, { $set: { room: keeper._id } });
          await Booking.updateMany({ "occupants.room": r._id }, { $set: { "occupants.$[o].room": keeper._id } }, { arrayFilters: [{ "o.room": r._id }] });
          if (!keeper.imageData && r.imageData) { keeper.imageData = r.imageData; keeper.imageName = r.imageName || ""; }
          await Room.deleteOne({ _id: r._id });
        }
        await keeper.save();
        mergedSummary.push({ key, count: rows.length });
      } catch (err) {
        conflicts.push({ key, error: err.message });
      }
    }

    // Resync status for every remaining room, same logic used elsewhere -
    // done as a couple of batch queries instead of one query per room, which
    // was slow enough with many rooms to risk a request timeout.
    let statusFixed = 0;
    if (!dryRun) {
      const remaining = await Room.find({ status: { $ne: "maintenance" } }).select("_id status");
      const remainingIds = remaining.map((r) => r._id);
      const [directBookedIds, occupantBookings] = await Promise.all([
        Booking.distinct("room", { status: { $in: ACTIVE_BOOKING_STATUSES }, room: { $in: remainingIds }, occupants: { $size: 0 } }),
        Booking.find({ status: { $in: ACTIVE_BOOKING_STATUSES }, "occupants.room": { $in: remainingIds } }).select("occupants").lean(),
      ]);
      const bookedIdSet = new Set(directBookedIds.map((id) => String(id)));
      for (const b of occupantBookings) {
        for (const o of (b.occupants || [])) {
          if (o.room && o.status !== "checked-out") bookedIdSet.add(String(o.room));
        }
      }

      const toBook = [];
      const toFree = [];
      for (const room of remaining) {
        const shouldBeBooked = bookedIdSet.has(String(room._id));
        const correctStatus = shouldBeBooked ? "booked" : "available";
        if (room.status !== correctStatus) {
          (shouldBeBooked ? toBook : toFree).push(room._id);
          statusFixed++;
        }
      }
      if (toBook.length) await Room.updateMany({ _id: { $in: toBook } }, { $set: { status: "booked" } });
      if (toFree.length) await Room.updateMany({ _id: { $in: toFree } }, { $set: { status: "available" } });
    }

    res.json({
      dryRun,
      duplicateGroupsFound: duplicateGroups.length,
      merged: mergedSummary,
      conflicts,
      statusesFixed: statusFixed,
      message: dryRun
        ? (duplicateGroups.length ? `Found ${duplicateGroups.length} duplicate room number(s). Run again without preview to fix them.` : "No duplicate rooms found.")
        : `Fixed ${mergedSummary.length} duplicate group(s) and corrected ${statusFixed} room status(es).${conflicts.length ? ` ${conflicts.length} could not be auto-merged — see details.` : ""}`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
