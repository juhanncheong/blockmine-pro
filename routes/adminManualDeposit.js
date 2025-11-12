const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Deposit = require("../models/Deposit");

router.post("/", async (req, res) => {
  try {
    const { userId, amountBTC } = req.body;
    console.log("📩 Incoming deposit request:", req.body);

    // Basic validation
    if (!userId || !amountBTC || amountBTC <= 0) {
      return res.status(400).json({ message: "Invalid input" });
    }

    // ✅ Create a deposit record (no external price)
    const deposit = new Deposit({
      userId,
      coin: "BTC",
      sendCoinAmount: amountBTC,
      creditBTC: amountBTC,
      amountUSD: 0, // optional: keep for consistency
      status: "approved",
      source: "admin",
      createdAt: new Date()
    });

    await deposit.save();

    // ✅ Update user’s BTC balance
    await User.findByIdAndUpdate(userId, { $inc: { balance: amountBTC } });

    console.log(`✅ Deposit added: +${amountBTC} BTC for user ${userId}`);
    res.json({ message: "Manual deposit added successfully" });
  } catch (err) {
    console.error("❌ Manual deposit failed:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
