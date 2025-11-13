// routes/adminNews.js
const express = require("express");
const router = express.Router();
const News = require("../models/News");

// TODO: plug in your existing admin auth middleware here if needed
// const requireAdmin = require("../middleware/requireAdmin");
// router.use(requireAdmin);

// GET /api/admin/news
router.get("/", async (req, res) => {
  try {
    const items = await News.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("Admin news list error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/admin/news  → create one item
router.post("/", async (req, res) => {
  try {
    const { title, imageUrl, linkUrl, order } = req.body;

    if (!title || !imageUrl || !linkUrl) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const item = await News.create({
      title,
      imageUrl,
      linkUrl,
      order: Number(order || 0),
    });

    res.status(201).json(item);
  } catch (err) {
    console.error("Admin news create error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/admin/news/:id  → edit / toggle active / order
router.put("/:id", async (req, res) => {
  try {
    const { title, imageUrl, linkUrl, isActive, order } = req.body;

    const updated = await News.findByIdAndUpdate(
      req.params.id,
      {
        ...(title !== undefined && { title }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(linkUrl !== undefined && { linkUrl }),
        ...(isActive !== undefined && { isActive }),
        ...(order !== undefined && { order }),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "News item not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error("Admin news update error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/admin/news/:id
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await News.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "News item not found" });
    }
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Admin news delete error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
