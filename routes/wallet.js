const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Withdrawal = require("../models/Withdrawal");
const MiningPurchase = require('../models/MiningPurchase');

// GET wallet balance (USD) + mining power
router.get("/balance/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Sum active mining power from purchases
    const purchases = await MiningPurchase
      .find({ userId: user._id, isActive: true })
      .populate('packageId');

    const totalMiningPower = purchases.reduce(
      (sum, p) => sum + (p.packageId?.miningPower || 0),
      0
    );

    res.json({
     // withdrawable balance
     usdBalance: Number(user.balanceUSD || 0),
     balanceUSD: Number(user.balanceUSD || 0),

     // 👇 NEW: bonus balance included
     bonusBalanceUSD: Number(user.bonusBalanceUSD || 0),

     // mining power
     miningPower: totalMiningPower
   });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Pending withdrawals count (unchanged)
router.get("/pending/:userId", async (req, res) => {
  try {
    const pendingCount = await Withdrawal.countDocuments({
      userId: req.params.userId,
      status: "pending"
    });

    res.json({ pendingWithdrawals: pendingCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
