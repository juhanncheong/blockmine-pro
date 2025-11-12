const express = require("express");
const router = express.Router();
const MiningPurchase = require("../models/MiningPurchase");

router.get("/summary/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    // Fetch all purchases (active + expired) with package data
    const purchases = await MiningPurchase
      .find({ userId })
      .populate("packageId");

    let activeMiners = 0;
    let totalHashrate = 0;
    let totalEarnedUSD = 0;
    const miners = [];

    const today = new Date();

    for (const purchase of purchases) {
      const pkg = purchase.packageId;
      if (!pkg) continue; // guard against deleted/missing packages

      const purchaseDate = new Date(purchase.purchaseDate);
      const daysSincePurchase = Math.floor((today - purchaseDate) / (1000 * 60 * 60 * 24));
      const remainingDays = Math.max(0, Number(pkg.duration || 0) - daysSincePurchase);

      // Active if flagged active AND not past duration
      const isActive = Boolean(purchase.isActive) && remainingDays > 0;
      if (isActive) {
        activeMiners += 1;
        totalHashrate += Number(pkg.miningPower || 0);
      }

      const earnedUSD = Number(purchase.earningsUSD || 0);
      totalEarnedUSD += earnedUSD;

      miners.push({
        packageName: pkg.name || "Package",
        miningPower: Number(pkg.miningPower || 0),
        purchaseDate: purchaseDate.toISOString().split("T")[0],
        remainingDays,
        earnedUSD: Number(earnedUSD.toFixed(2)),
        isActive
      });
    }

    res.json({
      activeMiners,
      totalHashrate,
      totalEarnedUSD: Number(totalEarnedUSD.toFixed(2)),
      miners
    });

  } catch (err) {
    console.error("❌ miners summary error:", err);
    res.status(500).json({ error: "Failed to load miners summary" });
  }
});

module.exports = router;
