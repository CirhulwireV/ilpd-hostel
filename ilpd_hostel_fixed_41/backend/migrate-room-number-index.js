require("dotenv").config();
const mongoose = require("mongoose");
// Prevent Mongoose from recreating the unique room index before legacy duplicates are repaired.
mongoose.set("autoIndex", false);
const Room = require("./models/Room");
const Booking = require("./models/Booking");
const AccommodationMonitoring = require("./models/AccommodationMonitoring");
const { INVENTORY } = require("./inventory");

const identityKey = (r) => `${r.accommodationType}|${r.roomNumber}|${r.hostelSection || ""}`;

async function dropRoomIdentityIndexes() {
  const indexes = await Room.collection.indexes();
  for (const index of indexes) {
    const fields = Object.keys(index.key || {});
    const isOldRoomIndex = index.name === "roomNumber_1" || index.name === "accommodationType_1_roomNumber_1";
    const isNewIdentityIndex = index.name === "accommodationType_1_roomNumber_1_hostelSection_1";
    if (isOldRoomIndex || isNewIdentityIndex) {
      try { await Room.collection.dropIndex(index.name); } catch (err) {
        if (err.codeName !== "IndexNotFound") throw err;
      }
    }
  }
}

async function bookingRefs(roomId) {
  const [direct, occupants] = await Promise.all([
    Booking.find({ room: roomId }).select("_id status checkIn checkOut").lean(),
    Booking.find({ "occupants.room": roomId }).select("_id status checkIn checkOut occupants").lean(),
  ]);
  return { direct, occupants };
}

function activeIntervalsForRoom(bookings, roomId) {
  const activeStatuses = new Set(["pending", "confirmed", "check-in-requested", "checked-in", "check-out-requested"]);
  const intervals = [];
  for (const b of bookings) {
    if (!activeStatuses.has(b.status)) continue;
    if (b.room?.toString() === roomId.toString()) {
      intervals.push({ start: new Date(b.checkIn), end: new Date(b.checkOut), bookingId: b._id.toString() });
    }
    for (const o of (b.occupants || [])) {
      if (o.room?.toString() === roomId.toString() && o.status !== "checked-out") {
        intervals.push({ start: new Date(o.plannedCheckIn || b.checkIn), end: new Date(o.plannedCheckOut || b.checkOut), bookingId: b._id.toString() });
      }
    }
  }
  return intervals;
}

function hasOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

async function findDuplicateGroups() {
  const rooms = await Room.find({}).lean();
  const groups = new Map();
  for (const room of rooms) {
    const key = identityKey(room);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(room);
  }
  return [...groups.entries()].filter(([, rows]) => rows.length > 1);
}

async function scoreRoom(room) {
  const refs = await bookingRefs(room._id);
  const monitoringCount = await AccommodationMonitoring.countDocuments({ room: room._id });
  const bookingCount = refs.direct.length + refs.occupants.length;
  const activeCount = activeIntervalsForRoom([...refs.direct, ...refs.occupants], room._id).length;
  const hasImage = Boolean(room.imageData);
  return { room, refs, monitoringCount, bookingCount, activeCount, hasImage };
}

async function mergeDuplicateGroup(key, rows) {
  const scored = [];
  for (const row of rows) scored.push(await scoreRoom(row));

  // Never silently merge two duplicate records if doing so would make two
  // overlapping active bookings point to the same physical room.
  for (let i = 0; i < scored.length; i++) {
    const a = activeIntervalsForRoom([...scored[i].refs.direct, ...scored[i].refs.occupants], scored[i].room._id);
    for (let j = i + 1; j < scored.length; j++) {
      const b = activeIntervalsForRoom([...scored[j].refs.direct, ...scored[j].refs.occupants], scored[j].room._id);
      for (const ia of a) for (const ib of b) {
        if (hasOverlap(ia, ib)) {
          throw new Error(`Cannot safely merge duplicate room identity ${key}: active bookings ${ia.bookingId} and ${ib.bookingId} overlap. Resolve those bookings first.`);
        }
      }
    }
  }

  // Prefer the record with the most history; then the one with a photo; then oldest.
  scored.sort((a, b) =>
    (b.bookingCount - a.bookingCount) ||
    (b.monitoringCount - a.monitoringCount) ||
    (Number(b.hasImage) - Number(a.hasImage)) ||
    (new Date(a.room.createdAt || 0) - new Date(b.room.createdAt || 0))
  );
  const keeper = scored[0].room;

  for (const duplicate of scored.slice(1)) {
    const duplicateId = duplicate.room._id;
    await Booking.updateMany({ room: duplicateId }, { $set: { room: keeper._id } });
    await Booking.updateMany({ "occupants.room": duplicateId }, { $set: { "occupants.$[o].room": keeper._id } }, { arrayFilters: [{ "o.room": duplicateId }] });
    await AccommodationMonitoring.updateMany({ room: duplicateId }, { $set: { room: keeper._id } });

    // Preserve useful photo metadata if the keeper lacks it.
    if (!keeper.imageData && duplicate.room.imageData) {
      keeper.imageData = duplicate.room.imageData;
      keeper.imageName = duplicate.room.imageName || "";
      await Room.updateOne({ _id: keeper._id }, { $set: { imageData: keeper.imageData, imageName: keeper.imageName } });
    }
    await Room.deleteOne({ _id: duplicateId });
  }
  return { key, kept: keeper._id.toString(), removed: scored.length - 1 };
}

async function normalizeOutsideSections() {
  const outside = await Room.find({ accommodationType: "outside_hostel" }).sort({ createdAt: 1, _id: 1 });
  const byNumber = new Map();
  for (const room of outside) {
    const n = Number(room.roomNumber);
    if (!Number.isFinite(n)) continue;
    if (!byNumber.has(n)) byNumber.set(n, []);
    byNumber.get(n).push(room);
  }

  // Room 114 is special: it is intentionally present once in AKAGERA and once
  // in KARISIMBI. Legacy databases sometimes have two unlabelled 114 records.
  // Assign those two records deterministically before deduplication so they do
  // not accidentally collapse into a single AKAGERA 114.
  const room114 = byNumber.get(114) || [];
  const labelled114 = room114.filter(r => ["AKAGERA", "KARISIMBI"].includes(r.hostelSection));
  const unlabelled114 = room114.filter(r => !["AKAGERA", "KARISIMBI"].includes(r.hostelSection));
  const usedSections = new Set(labelled114.map(r => r.hostelSection));
  for (const room of unlabelled114) {
    const section = !usedSections.has("AKAGERA") ? "AKAGERA" : !usedSections.has("KARISIMBI") ? "KARISIMBI" : null;
    if (section) {
      room.hostelSection = section;
      room.hostelSections = [section];
      await room.save();
      usedSections.add(section);
    }
  }

  for (const room of await Room.find({ accommodationType: "outside_hostel" })) {
    const n = Number(room.roomNumber);
    if (!Number.isFinite(n)) continue;
    let section = room.hostelSection;
    if (!section) {
      if (n >= 101 && n <= 114) section = "AKAGERA";
      else if (n >= 114 && n <= 139) section = "KARISIMBI";
    }
    if (section && ["AKAGERA", "KARISIMBI"].includes(section)) {
      room.hostelSection = section;
      room.hostelSections = [section];
      await room.save();
    }
  }
}

async function normalizeMainHouseSections() {
  await Room.updateMany(
    { accommodationType: "ilpd_building" },
    { $unset: { hostelSection: "", hostelSections: "" } }
  );
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI);

  // The unique index must be absent while legacy records are normalized/deduplicated.
  await dropRoomIdentityIndexes();
  await normalizeOutsideSections();
  await normalizeMainHouseSections();

  const duplicateGroups = await findDuplicateGroups();
  let removed = 0;
  for (const [key, rows] of duplicateGroups) {
    const result = await mergeDuplicateGroup(key, rows);
    removed += result.removed;
    console.log(`Deduplicated ${key}: kept ${result.kept}, removed ${result.removed}.`);
  }

  await Room.collection.createIndex(
    { accommodationType: 1, roomNumber: 1, hostelSection: 1 },
    { unique: true, name: "accommodationType_1_roomNumber_1_hostelSection_1" }
  );

  const inventoryCount = INVENTORY.length;
  const rooms = await Room.find({}).select("accommodationType roomNumber hostelSection").lean();
  const inventoryKeys = new Set(INVENTORY.map(identityKey));
  const inventoryMatches = rooms.filter(r => inventoryKeys.has(identityKey(r))).length;
  console.log(`Room identity migration complete. Duplicate records removed: ${removed}.`);
  console.log(`Authoritative inventory target: ${inventoryCount}; matching inventory records currently present: ${inventoryMatches}.`);
  console.log("Unique identity: accommodationType + roomNumber + hostelSection.");
  console.log("AKAGERA 114 and KARISIMBI 114 remain distinct physical rooms.");
} 

main().catch(async err => {
  console.error("Room-number migration failed:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
}).finally(async () => {
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
});
