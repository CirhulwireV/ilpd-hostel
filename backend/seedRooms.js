require("dotenv").config();
const mongoose = require("mongoose");
const Room = require("./models/Room");
const Booking = require("./models/Booking");
const { getBaseRate } = require("./utils/bookingRules");
const { MAIN_HOUSE_ROOMS, OUTSIDE_HOSTEL_ROOMS, INVENTORY } = require("./inventory");

const key = (r) => `${r.accommodationType}|${r.roomNumber}|${r.hostelSection || ""}`;

async function upsertRoom(spec) {
  const filter = { accommodationType: spec.accommodationType, roomNumber: spec.roomNumber };
  if (spec.hostelSection) filter.hostelSection = spec.hostelSection;
  const existing = await Room.findOne(filter);
  if (existing) {
    existing.category = spec.category;
    existing.price = getBaseRate(spec.category, spec.accommodationType);
    if (spec.hostelSection) {
      existing.hostelSection = spec.hostelSection;
      existing.hostelSections = [spec.hostelSection];
    } else {
      existing.set("hostelSection", undefined);
      existing.hostelSections = [];
    }
    if (!existing.status) existing.status = "available";
    await existing.save();
    return "updated";
  }
  // Legacy outside 114 may exist as one record carrying both labels. Reuse it
  // for the first 114 and create the second record with the same photo.
  if (spec.accommodationType === "outside_hostel" && spec.roomNumber === "114") {
    const legacy = await Room.findOne({ accommodationType: "outside_hostel", roomNumber: "114", hostelSection: { $in: [null, ""] } });
    if (legacy) {
      legacy.hostelSection = spec.hostelSection;
      legacy.hostelSections = [spec.hostelSection];
      legacy.category = "Standard";
      legacy.price = getBaseRate("Standard", "outside_hostel");
      await legacy.save();
      return "migrated";
    }
  }
  await Room.create({
    roomNumber: spec.roomNumber,
    category: spec.category,
    accommodationType: spec.accommodationType,
    ...(spec.hostelSection ? { hostelSection: spec.hostelSection, hostelSections: [spec.hostelSection] } : { hostelSections: [] }),
    price: getBaseRate(spec.category, spec.accommodationType),
    status: "available",
    imageData: "", imageName: "",
  });
  return "created";
}

async function removeInvalidRooms() {
  const allowed = new Set(INVENTORY.map(key));
  const rooms = await Room.find({}).select("_id accommodationType roomNumber hostelSection");
  let removed = 0, skipped = 0;
  for (const room of rooms) {
    const k = `${room.accommodationType || "outside_hostel"}|${room.roomNumber}|${room.hostelSection || ""}`;
    if (allowed.has(k)) continue;
    const used = await Booking.exists({ $or: [{ room: room._id }, { "occupants.room": room._id }] });
    if (used) {
      skipped += 1;
      console.warn(`Preserved non-inventory room ${room.roomNumber} (${room.accommodationType}) because it appears in booking history.`);
    } else {
      await Room.deleteOne({ _id: room._id });
      removed += 1;
    }
  }
  return { removed, skipped };
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI);
  // Repair old rooms first. The old 114 record is converted into one section;
  // the other section is then created as a separate inventory record.
  const legacyRooms = await Room.find({ $or: [{ accommodationType: { $exists: false } }, { accommodationType: null }, { accommodationType: "" }] });
  for (const room of legacyRooms) {
    const main = MAIN_HOUSE_ROOMS.find(r => r.roomNumber === room.roomNumber);
    const outside = OUTSIDE_HOSTEL_ROOMS.find(r => r.roomNumber === room.roomNumber);
    const target = main || outside;
    if (!target) continue;
    room.accommodationType = target.accommodationType;
    room.category = target.category;
    room.price = getBaseRate(target.category, target.accommodationType);
    if (target.hostelSection) {
      room.hostelSection = target.hostelSection;
      room.hostelSections = [target.hostelSection];
    } else {
      room.set("hostelSection", undefined);
      room.hostelSections = [];
    }
    await room.save();
  }
  let created=0, updated=0, migrated=0;
  for (const spec of INVENTORY) {
    const result = await upsertRoom(spec);
    if (result === "created") created++;
    else if (result === "migrated") migrated++;
    else updated++;
  }
  const cleanup = await removeInvalidRooms();
  const finalCount = await Room.countDocuments({});
  console.log(`Inventory target: ${INVENTORY.length} rooms.`);
  console.log(`Main House: ${MAIN_HOUSE_ROOMS.length}; Outside Block: ${OUTSIDE_HOSTEL_ROOMS.length}; Total: ${MAIN_HOUSE_ROOMS.length + OUTSIDE_HOSTEL_ROOMS.length}.`);
  console.log(`Created: ${created}; updated: ${updated}; migrated: ${migrated}; removed invalid unused: ${cleanup.removed}; preserved historical: ${cleanup.skipped}.`);
  console.log(`Database room count after seed: ${finalCount}.`);
  console.log("Outside Block: AKAGERA 101-114 (14 records); KARISIMBI 114-139 (26 records). AKAGERA 114 and KARISIMBI 114 are distinct records.");
  await mongoose.disconnect();
}

main().catch(async err => { console.error("Room seed failed:", err); try { await mongoose.disconnect(); } catch (_) {} process.exit(1); });
