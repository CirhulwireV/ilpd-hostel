require("dotenv").config();
const mongoose = require("mongoose");
const Booking = require("./models/Booking");
const Room = require("./models/Room");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const bookings = await Booking.find({ $or: [{ category: { $exists: false } }, { category: null }, { category: "" }] }).select("_id room category");
    let updated = 0;
    for (const booking of bookings) {
      if (!booking.room) continue;
      const room = await Room.findById(booking.room).select("category");
      if (!room?.category) continue;
      booking.category = room.category;
      await booking.save();
      updated += 1;
    }
    console.log(`Booking category migration complete. Updated ${updated} booking(s).`);
  } catch (err) {
    console.error("Booking category migration failed:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
