const express = require("express");
const router = express.Router();

const User = require("../models/User");
const BMTPriceHistory = require("../models/BMTPriceHistory");
const Transaction = require("../models/Transaction");

// POST /api/swap  → Sell BMTK for USD
router.post("/swap", async (req, res) => {
  try {
    const { userId, amount } = req.body;

    const sellAmount = Number(amount);

    if (!userId || isNaN(sellAmount) || sellAmount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check BMTK balance
    if (user.bmtBalance < sellAmount) {
      return res.status(400).json({ message: "Insufficient BMTK balance" });
    }

    // Latest BMTK price in USD
    const latestPriceDoc = await BMTPriceHistory.findOne().sort({ _id: -1 });
    if (!latestPriceDoc || typeof latestPriceDoc.price !== "number") {
      return res.status(500).json({ message: "Failed to fetch price" });
    }

    const bmtPriceUSD = Number(latestPriceDoc.price);
    const receivedUSD = sellAmount * bmtPriceUSD;

    // Update balances
    user.bmtBalance -= sellAmount;
    user.balanceUSD = (user.balanceUSD || 0) + receivedUSD;

    await user.save();

    // Log transaction
    await Transaction.create({
      userId: user._id,
      type: "bmt-earnings",
      amountUSD: receivedUSD,  
      note: `Sold ${sellAmount} BMTK`,
    });

    return res.json({
      message: "Sell successful",
      receivedUSD,
      newBMT: user.bmtBalance,
      newUSD: user.balanceUSD,
    });

  } catch (err) {
    console.error("Sell error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
