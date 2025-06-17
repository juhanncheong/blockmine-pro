const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Withdrawal = require("../models/Withdrawal");
const MiningPurchase = require("../models/MiningPurchase");

router.get("/summary/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    // Load everything in parallel ✅
    const [user, pendingWithdrawals, purchases] = await Promise.all([
      User.findById(userId),
      Withdrawal.countDocuments({ userId, status: "pending" }),
      MiningPurchase.find({ userId, isActive: true }),
    ]);

    res.json({
      btcBalance: user.balance || 0,
      miningPower: user.earnings || 0,  // you can adjust this depending where miningPower is stored
      pendingWithdrawals: pendingWithdrawals || 0,
      activePackages: purchases.length || 0,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load dashboard summary" });
  }
});

module.exports = router;
