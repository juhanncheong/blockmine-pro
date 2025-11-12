const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  stakeEnabled: { type: Boolean, default: false },
  swapEnabled: { type: Boolean, default: false },

  // ✅ New section: deposit addresses
  depositAddresses: {
    BTC:  { type: String, default: "" },
    ETH:  { type: String, default: "" },
    USDC: { type: String, default: "" },
    USDT: { type: String, default: "" },
  },
}, { timestamps: true });

module.exports = mongoose.model('GlobalSettings', settingsSchema);
