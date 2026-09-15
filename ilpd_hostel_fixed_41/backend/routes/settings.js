const express = require("express");
const router = express.Router();
const HeroImage = require("../models/HeroImage");

const auth = (req, res, next) => {
  console.log("🔓 Settings auth bypassed for testing");
  next();
};

router.get("/hero", async (req, res) => {
  try {
    const doc = await HeroImage.findOne({ key: "hero" });
    if (!doc) return res.json({ images: [] });
    res.json({ images: doc.images || [] });
  } catch (error) {
    console.error("GET /settings/hero error:", error.message);
    res.status(500).json({ error: "Could not load hero images" });
  }
});

router.put("/hero", auth, async (req, res) => {
  try {
    const { images } = req.body;
    if (!Array.isArray(images)) {
      return res.status(400).json({ error: "images must be an array of URLs" });
    }
    const doc = await HeroImage.findOneAndUpdate(
      { key: "hero" },
      { key: "hero", images },
      { new: true, upsert: true }
    );
    res.json({ images: doc.images });
  } catch (error) {
    console.error("PUT /settings/hero error:", error.message);
    res.status(500).json({ error: "Could not save hero images" });
  }
});

module.exports = router;