const User = require('../models/User');
const MiningPurchase = require('../models/MiningPurchase');
const Package = require('../models/Package');
const Transaction = require('../models/Transaction');
const axios = require('axios');
require('dotenv').config();

async function runDailyEarnings() {
  try {
    const earningRate = parseFloat(process.env.EARNING_RATE_USD_PER_THS); // $2 per TH/s
    const users = await User.find();

    // Get live BTC price (fallback to 105000)
    let btcPriceUSD = 105000;
    try {
      const priceRes = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
      btcPriceUSD = parseFloat(priceRes.data.price);
    } catch {
      console.warn("⚠️ Binance price failed. Using fallback BTC price.");
    }

    for (let user of users) {
      const activePurchases = await MiningPurchase.find({ userId: user._id, isActive: true }).populate('packageId');

      let totalEarningsBTC = 0;

      for (let purchase of activePurchases) {
        const power = purchase.packageId.miningPower;
        const earningsUSD = power * earningRate;
        const earningsBTC = earningsUSD / btcPriceUSD;

        purchase.earnings += earningsBTC;
        await purchase.save();

        totalEarningsBTC += earningsBTC;
      }

      if (totalEarningsBTC > 0) {
        user.balance += totalEarningsBTC;
        user.earnings = (user.earnings || 0) + totalEarningsBTC;
        await user.save();

        await Transaction.create({
          userId: user._id,
          type: 'earnings',
          amount: totalEarningsBTC,
          status: 'completed',
          createdAt: new Date()
        });

        console.log(`✅ Credited ${totalEarningsBTC.toFixed(8)} BTC to ${user.username}`);
      }
    }
  } catch (err) {
    console.error("❌ runDailyEarnings failed:", err);
  }
}

module.exports = { runDailyEarnings };
