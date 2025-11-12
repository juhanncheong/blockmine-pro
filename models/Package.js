const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name:         { type: String, required: true },   // Package name (e.g. Starter, Pro, etc.)
  priceUSD:     { type: Number, required: true },   // Fixed purchase price in USD
  miningPower:  { type: Number, required: true },   // Mining power in TH/s
  duration:     { type: Number, required: true },   // Duration in days

  // Optional: per-package override. If null/undefined, use process.env.EARNING_RATE_USD_PER_THS
  earningRateUSDPerTHSPerDay: { type: Number }, 

  description:  { type: String, default: '' },
  bmtReward:    { type: Number, default: 0 },       // Optional token reward
  createdAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('Package', packageSchema);
