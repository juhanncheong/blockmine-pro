const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["deposit", "withdraw", "purchase", "referral-commission", "mining", "earnings"], required: true },
  amount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Transaction", TransactionSchema);
