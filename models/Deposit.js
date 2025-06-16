const mongoose = require("mongoose");

const depositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  coin: { type: String, required: true },           // BTC, ETH, USDT, USDC
  amountUSD: { type: Number, required: true },      // USD entered by user
  sendCoinAmount: { type: Number, required: true }, // How much they send (in selected coin)
  creditBTC: { type: Number, required: true },      // Final BTC credit to account
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Deposit", depositSchema);
