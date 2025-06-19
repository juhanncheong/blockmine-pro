const express = require("express");
const router = express.Router();
const Stake = require("../models/Stake");
const User = require("../models/User");

router.post("/api/stake", async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.body.userId;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.bmtBalance < amount) {
      return res.status(400).json({ message: "Insufficient BMT balance" });
    }

    const dailyReward = amount * 0.01;
    const startDate = new Date();
    const unlockDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days later

    // Deduct BMT
    user.bmtBalance -= amount;
    await user.save();

    const newStake = new Stake({
      userId,
      amount,
      dailyReward,
      startDate,
      unlockDate
    });

    await newStake.save();

    res.json({
      message: "Stake successful",
      newBmtBalance: user.bmtBalance,
      stake: newStake
    });
  } catch (err) {
    console.error("Stake error", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
