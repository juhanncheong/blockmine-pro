const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: [
      "deposit",
      "withdraw",
      "purchase",
      "referral-commission",
      "mining",
      "earnings",
      "swap" // ✅ new type
    ],
    required: true,
  },
  amount: { type: Number }, // use this for BTC, or leave null for swaps
  bmtAmount: { type: Number }, // ✅ for swap type
  btcAmount: { type: Number }, // ✅ for swap type
  usdValue: { type: Number },  // ✅ value of swap in USD
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Transaction", TransactionSchema);
