const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Withdrawal = require("../models/Withdrawal");

// GET wallet balance
router.get("/balance/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ 
  btcBalance: user.balance || 0,
  miningPower: user.miningPower || 0
});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ NEW pending withdrawals route:
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
