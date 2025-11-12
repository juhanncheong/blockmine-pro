// models/GlobalSettings.js
const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  stakeEnabled: { type: Boolean, default: false },
  swapEnabled: { type: Boolean, default: false },

  // ✅ Deposit addresses
  depositAddresses: {
    BTC:  { type: String, default: "" },
    ETH:  { type: String, default: "" },
    USDC: { type: String, default: "" },
    USDT: { type: String, default: "" },
  },

  // ✅ Mining earnings tracking (New York time)
  lastMiningEarningsAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('GlobalSettings', settingsSchema);
