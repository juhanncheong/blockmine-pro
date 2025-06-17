const express = require("express");
const router = express.Router();
const MiningPurchase = require("../models/MiningPurchase");
const Package = require("../models/Package");

router.get("/summary/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    // Fetch all active purchases + linked package info
    const purchases = await MiningPurchase.find({ userId }).populate("packageId");

    // Initialize calculations
    let activeMiners = 0;
    let totalHashrate = 0;
    let totalEarned = 0;
    const miners = [];

    const today = new Date();

    purchases.forEach(purchase => {
      const packageData = purchase.packageId;
      const purchaseDate = new Date(purchase.purchaseDate);
      const daysSincePurchase = Math.floor((today - purchaseDate) / (1000 * 60 * 60 * 24));
      const remainingDays = packageData.duration - daysSincePurchase;

      // Check if miner is still active
      if (remainingDays > 0) {
        activeMiners += 1;
        totalHashrate += packageData.miningPower;
      }

      totalEarned += purchase.earnings;

      miners.push({
        packageName: packageData.name,
        miningPower: packageData.miningPower,
        purchaseDate: purchaseDate.toISOString().split("T")[0],
        remainingDays: remainingDays > 0 ? remainingDays : 0,
        earned: purchase.earnings
      });
    });

    res.json({
      activeMiners,
      totalHashrate,
      totalEarned,
      miners
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load miners summary" });
  }
});

module.exports = router;
