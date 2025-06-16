const express = require("express");
const router = express.Router();
const PendingDeposit = require("../models/PendingDeposit");
const User = require("../models/User");

// Submit deposit request
router.post("/", async (req, res) => {
  try {
    const { userId, coin, amountUSD, sendCoinAmount, creditBTC } = req.body;

    if (!userId || !coin || !amountUSD || !sendCoinAmount || !creditBTC) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const pendingDeposit = new PendingDeposit({
      userId,
      coin,
      amountUSD,
      sendCoinAmount,
      creditBTC
    });

    await pendingDeposit.save();

    res.json({ message: "Deposit request submitted" });

  } catch (err) {
    console.error("Error submitting deposit:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
