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

// ✅ FIRST define fixed routes
router.get("/api/stake/process-expired", async (req, res) => {
  try {
    const expiredStakes = await Stake.find({
      active: true,
      endDate: { $lte: new Date() },
      credited: false,
    });

    for (const stake of expiredStakes) {
      const user = await User.findById(stake.userId);
      const totalReward = stake.dailyReward * 14;

      user.bmtBalance += stake.amount + totalReward;
      await user.save();

      stake.active = false;
      stake.credited = true;
      stake.refunded = true;
      await stake.save();
    }

    res.json({ message: "Processed all expired stakes." });
  } catch (err) {
    console.error("Stake processing error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/stake/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const now = new Date();
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const stakes = await Stake.find({ userId }).sort({ startDate: -1 });

    for (const stake of stakes) {
      if (stake.active && stake.unlockDate <= now) {
        if (!stake.refunded) {
          user.bmtBalance += stake.amount;
          stake.refunded = true;
        }

        if (!stake.credited) {
          user.bmtBalance += stake.dailyReward * 14;
          stake.credited = true;
        }

        stake.active = false;
        await stake.save();
        await user.save();
      }
    }

    const updatedStakes = await Stake.find({ userId }).sort({ startDate: -1 });
    res.json(updatedStakes);

  } catch (err) {
    console.error("Fetch stake history error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
