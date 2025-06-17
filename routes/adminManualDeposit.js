const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Deposit = require("../models/Deposit");

// Admin manual deposit route
router.post("/", async (req, res) => {
  try {
    const { userId, amountBTC } = req.body;

    if (!userId || !amountBTC || amountBTC <= 0) {
      return res.status(400).json({ message: "Invalid input" });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Add balance to user
    user.balance += amountBTC;
    await user.save();

    // Log deposit history
    const deposit = new Deposit({
      userId,
      amount: 0, // Because USD not used in manual deposits
      creditBTC: amountBTC,
      status: "approved",  // Directly approved
      createdAt: new Date()
    });
    await deposit.save();

    res.json({ message: "Deposit added successfully" });
  } catch (err) {
    console.error("Manual deposit failed", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
