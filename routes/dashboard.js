const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Withdrawal = require("../models/Withdrawal");
const MiningPurchase = require("../models/MiningPurchase");
const Package = require("../models/Package");

router.get("/summary/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    // Load user, withdrawals, and active mining purchases
    const [user, pendingWithdrawals, purchases] = await Promise.all([
      User.findById(userId),
      Withdrawal.countDocuments({ userId, status: "pending" }),
      MiningPurchase.find({ userId, isActive: true }).populate("packageId")
    ]);

    // Calculate total mining power by summing miningPower from linked Package
    const miningPowerTotal = purchases.reduce((total, purchase) => {
      const packagePower = purchase.packageId?.miningPower || 0;
      return total + packagePower;
    }, 0);

    res.json({
      btcBalance: user.balance || 0,
      miningPower: miningPowerTotal,
      pendingWithdrawals: pendingWithdrawals || 0,
      activePackages: purchases.length || 0,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load dashboard summary" });
  }
});

module.exports = router;
