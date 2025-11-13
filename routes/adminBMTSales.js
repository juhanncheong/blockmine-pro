const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const User = require("../models/User");

// GET /api/admin/bmt-sales?page=1&limit=10&email=...
router.get("/bmt-sales", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const emailFilter = (req.query.email || "").trim().toLowerCase();

    // Pull all token-sale-like transactions (small scale, simple)
    const baseQuery = {
      type: "earnings",
      note: { $regex: /^Sold / }, // matches "Sold X BMTK"
    };

    let txs = await Transaction.find(baseQuery)
      .sort({ createdAt: -1 })
      .populate("userId", "email");

    // In-memory email filter
    if (emailFilter) {
      txs = txs.filter((tx) =>
        tx.userId?.email?.toLowerCase().includes(emailFilter)
      );
    }

    // Compute BMTK amount per row + global stats
    let totalBMTK = 0;
    let totalUSD = 0;

    const rows = txs.map((tx) => {
      // parse "Sold 123.45 BMTK"
      let bmtAmount = 0;
      const match = typeof tx.note === "string"
        ? tx.note.match(/Sold\s+([\d.]+)\s+BMTK/i)
        : null;
      if (match && match[1]) {
        bmtAmount = Number(match[1]) || 0;
      }

      totalBMTK += bmtAmount;
      totalUSD += tx.amountUSD || 0;

      return {
        _id: tx._id,
        createdAt: tx.createdAt,
        email: tx.userId?.email || "Unknown",
        bmtAmount,
        amountUSD: tx.amountUSD || 0,
        type: tx.type,
        note: tx.note || "",
      };
    });

    const total = rows.length;
    const start = (page - 1) * limit;
    const pagedRows = rows.slice(start, start + limit);

    return res.json({
      sales: pagedRows,
      total,
      stats: {
        totalBMTK,
        totalUSD,
        totalSales: total,
      },
    });
  } catch (err) {
    console.error("Failed to fetch BMTK sales:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
