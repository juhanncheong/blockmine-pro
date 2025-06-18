const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");

// GET /api/transactions/:userId?page=1&limit=5
// Fetch paginated transactions for a user
router.get("/:userId", async (req, res) => {
  const { page = 1, limit = 5 } = req.query;

  try {
    const transactions = await Transaction.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments({ userId: req.params.userId });

    res.json({ transactions, total });
  } catch (err) {
    console.error("Failed to fetch transactions:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
