const mongoose = require("mongoose");

const PendingDepositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  coin: { type: String, required: true },
  amountUSD: { type: Number, required: true },
  sendCoinAmount: { type: Number, required: true },
  creditBTC: { type: Number, required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("PendingDeposit", PendingDepositSchema);
