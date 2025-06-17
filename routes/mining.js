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

    // Get live BTC price with fallback
let btcPriceUSD = 65000; // fallback value if API fails
try {
  const priceRes = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
  btcPriceUSD = priceRes.data.bitcoin.usd;
} catch (err) {
  console.warn("⚠️ CoinGecko fetch failed. Using fallback price:", btcPriceUSD);
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
module.exports = router;
