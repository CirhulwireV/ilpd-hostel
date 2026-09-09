require("dotenv").config();
const mongoose = require("mongoose");
const Room = require("./models/Room");

const runMigration = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const deluxeResult = await Room.updateMany(
      { category: "Deluxe" },
      { $set: { category: "VIP" } }
    );
    console.log(`Updated ${deluxeResult.modifiedCount} Deluxe rooms to VIP`);

    const suiteResult = await Room.updateMany(
      { category: "Suite" },
      { $set: { category: "VVIP" } }
    );
    console.log(`Updated ${suiteResult.modifiedCount} Suite rooms to VVIP`);

    const unknown = await Room.countDocuments({ category: { $nin: ["Standard", "VIP", "VVIP"] } });
    if (unknown > 0) {
      console.log(`Warning: ${unknown} rooms still have unknown categories.`);
    }

    console.log("Migration complete.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

runMigration();
