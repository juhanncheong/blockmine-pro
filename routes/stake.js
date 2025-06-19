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
if (stake.unlockDate <= now && stake.active) {
  // Refund capital if not refunded
  if (!stake.refunded) {
    user.bmtBalance += stake.amount;
    stake.refunded = true;
  }

  // Credit earnings if not yet credited
  if (!stake.credited) {
    const totalEarnings = stake.dailyReward * 14;
    user.bmtBalance += totalEarnings;
    stake.credited = true;
  }

  stake.active = false;
  await stake.save();
}
    }

    // Return updated list
    const updatedStakes = await Stake.find({ userId }).sort({ startDate: -1 });
    res.json(updatedStakes);

  } catch (err) {
    console.error("Fetch stake history error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// ✅ Auto process expired stakes (capital + reward)
router.get("/api/stake/process-expired", async (req, res) => {
  try {
    const now = new Date();

    const expiredStakes = await Stake.find({
      active: true,
      unlockDate: { $lte: now },
      credited: false
    });

    for (const stake of expiredStakes) {
      const user = await User.findById(stake.userId);
      if (!user) continue;

      const reward = stake.dailyReward * 14;
      const total = stake.amount + reward;

      user.bmtBalance += total;
      await user.save();

      stake.active = false;
      stake.credited = true;
      await stake.save();
    }

    res.json({ message: "Expired stakes processed", count: expiredStakes.length });
  } catch (err) {
    console.error("Auto stake processor error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
module.exports = router;
