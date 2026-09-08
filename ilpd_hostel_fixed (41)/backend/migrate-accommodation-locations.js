const mongoose = require("mongoose");
require("dotenv").config();
const Room = require("./models/Room");
const Booking = require("./models/Booking");

const OUTSIDE_MONTHLY_RATE = 100000;

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const rooms = await Room.find({ $or: [{ accommodationType: { $exists: false } }, { accommodationType: null }] });
    let roomsUpdated = 0;
    for (const room of rooms) {
      room.accommodationType = "outside_hostel";
      room.category = "Standard";
      room.price = OUTSIDE_MONTHLY_RATE;
      await room.save();
      roomsUpdated += 1;
    }
    const bookings = await Booking.updateMany(
      { $or: [{ accommodationType: { $exists: false } }, { accommodationType: null }] },
      { $set: { accommodationType: "outside_hostel", billingPeriod: "month" } }
    );
    console.log({ roomsUpdated, bookingsUpdated: bookings.modifiedCount });
  } finally {
    await mongoose.disconnect();
  }
})().catch((err) => { console.error(err); process.exit(1); });
