const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const BMTPriceHistory = require("../models/BMTPriceHistory");

router.post("/api/swap", async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid user or amount" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.bmtBalance < amount) {
      return res.status(400).json({ message: "Insufficient BMT balance" });
    }

    // Get latest BMT price
    const bmtPriceData = await BMTPriceHistory.find().sort({ date: 1 });
    const latestBMT = bmtPriceData[bmtPriceData.length - 1];
    const bmtUsd = parseFloat(latestBMT.price);

    // Get BTC price from Binance
    const btcRes = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT");
    const btcData = await btcRes.json();
    const btcUsd = parseFloat(btcData.price);

    // Calculate BTC to give
    const usdValue = amount * bmtUsd;
    const btcAmount = usdValue / btcUsd;

    // Update user balances
    user.bmtBalance -= amount;
    user.balance += btcAmount;
    await user.save();

    // Save transaction
    const tx = new Transaction({
      userId,
      type: "swap",
      bmtAmount: amount,
      btcAmount,
      usdValue,
    });
    await tx.save();

    res.json({
      message: "Swap successful",
      newBMT: user.bmtBalance,
      newBTC: user.balance,
      receivedBTC: btcAmount,
    });

  } catch (err) {
    console.error("Swap error", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;