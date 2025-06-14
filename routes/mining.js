const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/User');
require('dotenv').config();

const router = express.Router();

router.post('/run-daily-earnings', async (req, res) => {
  try {
    const earningRate = parseFloat(process.env.EARNING_RATE_USD_PER_THS); // USD per TH/s

    // Get live BTC price
    const priceRes = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const btcPriceUSD = priceRes.data.bitcoin.usd;

    // Get all users
    const users = await User.find();

    for (let user of users) {
      if (user.miningPower > 0) {
        // Calculate USD earnings
        const earningsUSD = user.miningPower * earningRate;

        // Convert to BTC
        const earningsBTC = earningsUSD / btcPriceUSD;

        // Credit earnings into user's wallet balance
        user.balance += earningsBTC;

        await user.save();

        console.log(`User ${user.username} earned ${earningsBTC.toFixed(8)} BTC today.`);
      }
    }

    res.json({ message: 'Daily mining earnings completed successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
