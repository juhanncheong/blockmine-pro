const express = require("express");
const axios = require("axios");
const router = express.Router();
const User = require("../models/User");
const Deposit = require("../models/Deposit");

// ✅ Reuse your BTC price fetch logic
async function fetchBTCPrice() {
  const priceRes = await axios.get(
    'https://api.allorigins.win/get?url=' +
    encodeURIComponent('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
  );
  const parsed = JSON.parse(priceRes.data.contents);
  return parsed.bitcoin.usd;
}

router.post("/", async (req, res) => {
  try {
    const { userId, amountBTC } = req.body;

    if (!userId || !amountBTC || amountBTC <= 0) {
      return res.status(400).json({ message: "Invalid input" });
    }

    // ✅ Get BTC price using your stable method
    const btcPrice = await fetchBTCPrice();

    const deposit = new Deposit({
      userId,
      coin: "BTC",
      amountUSD: parseFloat((amountBTC * btcPrice).toFixed(2)),
      sendCoinAmount: amountBTC,
      creditBTC: amountBTC,
      status: "approved",
      createdAt: new Date()
    });

    await deposit.save();

    await User.findByIdAndUpdate(userId, { $inc: { balance: amountBTC } });

    res.json({ message: "Manual deposit added successfully" });
  } catch (err) {
    console.error("Manual deposit failed", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
