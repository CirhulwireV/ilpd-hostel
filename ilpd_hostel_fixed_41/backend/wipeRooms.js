// Wipes ALL room records so the admin can build their room list completely
// from scratch, using Add Room / Bulk Add Room in the dashboard — with real
// prices and categories they choose themselves.
//
// This does NOT touch bookings, clients, concerns, or surveys — that
// business/history data is left alone. Existing bookings that reference a
// deleted room will simply show "room removed" instead of a room number;
// their history (dates, price paid, status) is preserved.
//
// SAFE BY DEFAULT: running with no flag only shows what would be deleted.
// BACK UP YOUR DATABASE BEFORE RUNNING WITH --confirm. This cannot be undone.
//
// Usage:
//   node wipeRooms.js              -> dry run, shows what would be deleted
//   node wipeRooms.js --confirm     -> actually deletes every room

require("dotenv").config();
const mongoose = require("mongoose");
const Room = require("./models/Room");
const Booking = require("./models/Booking");

const confirm = process.argv.includes("--confirm");

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required (check your .env).");
  await mongoose.connect(process.env.MONGO_URI);

  const totalRooms = await Room.countDocuments();
  if (!totalRooms) {
    console.log("There are no rooms in the database. Nothing to do — the admin can start adding rooms right away.");
    await mongoose.disconnect();
    return;
  }

  const roomsWithBookings = await Room.aggregate([
    { $lookup: { from: "bookings", localField: "_id", foreignField: "room", as: "directBookings" } },
    { $lookup: { from: "bookings", localField: "_id", foreignField: "occupants.room", as: "occupantBookings" } },
    { $match: { $expr: { $gt: [{ $add: [{ $size: "$directBookings" }, { $size: "$occupantBookings" }] }, 0] } } },
    { $project: { roomNumber: 1, accommodationType: 1 } },
  ]);

  console.log(`Total rooms in database: ${totalRooms}`);
  console.log(`Rooms with at least one booking on record: ${roomsWithBookings.length}`);
  if (roomsWithBookings.length) {
    console.log(`(Their booking HISTORY will be kept — only the room record itself is removed, so those old bookings will show "room removed" instead of a room number.)`);
  }

  if (!confirm) {
    console.log(`\nDRY RUN ONLY — nothing was deleted.`);
    console.log(`Re-run with --confirm to permanently delete all ${totalRooms} room records.`);
    console.log(`Make sure you've backed up your database first (mongodump or an Atlas snapshot).`);
    await mongoose.disconnect();
    return;
  }

  const result = await Room.deleteMany({});
  console.log(`\nDeleted ${result.deletedCount} room(s). The room list is now empty.`);
  console.log(`The admin can now use "Add Room" or "Bulk Add Rooms" in the dashboard to build the inventory from scratch, with their own room numbers, categories, and prices.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
