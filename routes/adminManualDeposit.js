const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Deposit = require("../models/Deposit");
const Transaction = require("../models/Transaction");

// ✅ POST /admin/manual-deposit
router.post("/", async (req, res) => {
  try {
    const { userId, amountUSD, note } = req.body;

    if (!userId || !amountUSD || amountUSD <= 0) {
      return res.status(400).json({ message: "Invalid input" });
    }

    // ✅ Create USD deposit record
    const deposit = new Deposit({
      userId,
      coin: "USD",
      amountUSD,
      expectedCoinAmount: 0,
      quoteRate: 1,
      status: "approved",
      source: "admin",
      createdAt: new Date()
    });

    await deposit.save();

    // ✅ Update user's USD balance
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.balanceUSD = (user.balanceUSD || 0) + Number(amountUSD);
    await user.save();

    // ✅ Record transaction
    await Transaction.create({
      userId,
      type: "deposit",
      amountUSD: +Number(amountUSD),
      note: note || "Admin manual deposit"
    });

    console.log(`✅ Manual deposit: +$${amountUSD} USD for user ${user.email}`);
    res.json({ message: "Manual USD deposit added successfully" });
  } catch (err) {
    console.error("❌ Manual deposit failed:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
