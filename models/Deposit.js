const mongoose = require("mongoose");

const depositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  coin: { type: String, required: true },
  amountUSD: { type: Number, required: true },
  sendCoinAmount: { type: Number, required: true },
  creditBTC: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  source: { type: String, enum: ['user', 'admin'], default: 'user' }, // ✅ NEW FIELD ADDED
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Deposit", depositSchema);
