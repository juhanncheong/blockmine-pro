// routes/news.js
const express = require("express");
const router = express.Router();
const News = require("../models/News");

// GET /api/news  → list active news for dashboard
router.get("/", async (_req, res) => {
  try {
    const items = await News.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })  // custom order first, latest first
      .limit(20);

    res.json(items);
  } catch (err) {
    console.error("News fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
