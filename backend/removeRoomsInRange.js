// Deletes room records whose roomNumber falls within a given numeric range.
//
// SAFE BY DEFAULT: with no --confirm flag, this only PRINTS what it found.
// Rooms that have real booking history attached are NEVER deleted by this
// script, even with --confirm — those need a deliberate human decision
// (use deleteBookingsForRoom.js for those, room by room, after reviewing).
//
// Usage:
//   node removeRoomsInRange.js 404 905              -> dry run
//   node removeRoomsInRange.js 404 905 --confirm     -> actually deletes
//   node removeRoomsInRange.js 404 905 --type=outside_hostel   -> restrict to one building

require("dotenv").config();
const mongoose = require("mongoose");
const Room = require("./models/Room");
const Booking = require("./models/Booking");

const args = process.argv.slice(2);
const nums = args.filter((a) => !a.startsWith("--")).map(Number);
const [from, to] = nums;
const confirm = args.includes("--confirm");
const typeArg = args.find((a) => a.startsWith("--type="));
const accommodationType = typeArg ? typeArg.split("=")[1] : null;

async function main() {
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    console.error("Usage: node removeRoomsInRange.js <fromNumber> <toNumber> [--confirm] [--type=outside_hostel|ilpd_building]");
    process.exit(1);
  }
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required (check your .env).");
  await mongoose.connect(process.env.MONGO_URI);

  const filter = {};
  if (accommodationType) filter.accommodationType = accommodationType;

  const allRooms = await Room.find(filter).select("_id roomNumber accommodationType hostelSection status category");
  const inRange = allRooms.filter((r) => {
    const n = parseInt(r.roomNumber, 10);
    return Number.isFinite(n) && n >= from && n <= to;
  });

  if (!inRange.length) {
    console.log(`No rooms found with roomNumber between ${from} and ${to}.`);
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${inRange.length} room(s) with roomNumber between ${from} and ${to}:`);

  const withHistory = [];
  const clearToDelete = [];
  for (const r of inRange) {
    const hasBookings = await Booking.exists({ $or: [{ room: r._id }, { "occupants.room": r._id }] });
    if (hasBookings) withHistory.push(r); else clearToDelete.push(r);
  }

  console.log(`\n${clearToDelete.length} have NO booking history (safe to delete):`);
  for (const r of clearToDelete) {
    console.log(`  - Room ${r.roomNumber} (${r.accommodationType}${r.hostelSection ? ", " + r.hostelSection : ""}, status=${r.status})`);
  }

  if (withHistory.length) {
    console.log(`\n${withHistory.length} DO have booking history and will NOT be touched by this script (need manual review):`);
    for (const r of withHistory) {
      console.log(`  - Room ${r.roomNumber} (${r.accommodationType}${r.hostelSection ? ", " + r.hostelSection : ""}, status=${r.status}) _id=${r._id}`);
    }
  }

  if (!confirm) {
    console.log(`\nDRY RUN ONLY — nothing was deleted. Re-run with --confirm to delete the ${clearToDelete.length} room(s) with no booking history.`);
    await mongoose.disconnect();
    return;
  }

  if (!clearToDelete.length) {
    console.log(`\nNothing to delete (all matching rooms have booking history).`);
    await mongoose.disconnect();
    return;
  }

  const ids = clearToDelete.map((r) => r._id);
  const result = await Room.deleteMany({ _id: { $in: ids } });
  console.log(`\nDeleted ${result.deletedCount} room(s).`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
