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

router.get("/api/stake/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const now = new Date();

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Fetch all user stakes
    const stakes = await Stake.find({ userId }).sort({ startDate: -1 });

    for (const stake of stakes) {
      // Check if stake expired and not refunded
      if (stake.unlockDate <= now && stake.active && !stake.refunded) {
        // Refund BMT
        user.bmtBalance += stake.amount;
        stake.active = false;
        stake.refunded = true;
        await stake.save();
      }
    }

    await user.save();

    // Return updated list
    const updatedStakes = await Stake.find({ userId }).sort({ startDate: -1 });
    res.json(updatedStakes);

  } catch (err) {
    console.error("Fetch stake history error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
