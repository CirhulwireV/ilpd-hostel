require("dotenv").config();
const mongoose = require("mongoose");
const Block = require("./models/Block");
const Room = require("./models/Room");

const LEGACY_NAMES = [
  /^umutakara(?:\s*\(main house\))?$/i,
  /^hostel block(?:\s*\(outside(?: ilpd)?(?: building)?\))?$/i,
  /^outside block$/i,
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const blocks = await Block.find({});
    const targets = blocks.filter((b) => LEGACY_NAMES.some((re) => re.test((b.name || "").trim())));

    if (!targets.length) {
      console.log("No legacy hardcoded blocks found. Nothing changed.");
      return;
    }

    for (const block of targets) {
      const roomCount = await Room.countDocuments({ hostelSection: block.name });
      if (roomCount > 0) {
        console.log(`SKIPPED "${block.name}" — ${roomCount} room(s) still reference this block. Move/delete those rooms first.`);
        continue;
      }
      await Block.deleteOne({ _id: block._id });
      console.log(`DELETED "${block.name}"`);
    }

    console.log("Legacy block cleanup complete.");
  } catch (err) {
    console.error("Legacy block cleanup failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
