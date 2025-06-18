const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/User');
require('dotenv').config();
const MiningPurchase = require('../models/MiningPurchase');
const router = express.Router();
const Package = require('../models/Package');

router.post('/run-daily-earnings', async (req, res) => {
  try {
    const earningRate = parseFloat(process.env.EARNING_RATE_USD_PER_THS); // USD per TH/s

    // Get live BTC price
    let btcPriceUSD = 105000;
try {
  const priceRes = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
  btcPriceUSD = parseFloat(priceRes.data.price);
} catch (err) {
  console.warn("⚠️ Binance price fetch failed. Using fallback price:", btcPriceUSD);
}

    // Get all users
    const users = await User.find();

    for (let user of users) {
      // Find active packages only
      const activePurchases = await MiningPurchase.find({ userId: user._id, isActive: true }).populate('packageId');

      let totalPower = 0;
      let totalEarningsBTC = 0;

      for (let purchase of activePurchases) {
        const packagePower = purchase.packageId.miningPower;
        totalPower += packagePower;

        const earningsUSD = packagePower * earningRate;
        const earningsBTC = earningsUSD / btcPriceUSD;

        // Add earnings to this purchase
        purchase.earnings += earningsBTC;
        await purchase.save();

        totalEarningsBTC += earningsBTC;
      }

      // Add total earnings to user's wallet
      user.balance += totalEarningsBTC;
      user.earnings = (user.earnings || 0) + totalEarningsBTC;
      await user.save();

      console.log(`User ${user.username} earned ${totalEarningsBTC.toFixed(8)} BTC today.`)
    }

    res.json({ message: 'Daily mining earnings based on active packages completed.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Auto-expire packages
router.post('/cleanup-expired', async (req, res) => {
  try {
    const purchases = await MiningPurchase.find({ isActive: true }).populate('packageId');

    for (let purchase of purchases) {
      const purchaseDate = new Date(purchase.purchaseDate);
      const today = new Date();
      const daysPassed = Math.floor((today - purchaseDate) / (1000 * 60 * 60 * 24));
      const duration = purchase.packageId.duration;

      if (daysPassed >= duration) {
        purchase.isActive = false;
        await purchase.save();
        console.log(`Marked purchase ${purchase._id} as expired`);
      }
    }

    res.json({ message: 'Expiration check completed successfully.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while cleaning expired purchases' });
  }
});

// Get daily earnings history for a user
router.get("/earnings-history/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const earnings = await Transaction.find({
      userId,
      type: "earnings",
    }).sort({ createdAt: -1 });

    res.json(earnings);
  } catch (err) {
    console.error("❌ Failed to get earnings history", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
