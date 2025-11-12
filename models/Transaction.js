const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // Transaction purpose
  type: {
    type: String,
    enum: [
      "deposit",
      "withdraw",
      "purchase",
      "referral-commission",
      "earnings",
      "principal-refund"
    ],
    required: true,
  },

  // Amount in USD (positive = credit, negative = debit)
  amountUSD: { type: Number, required: true },

  // Optional note, e.g. "Package A purchase", "Referral from John"
  note: { type: String, default: "" },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Transaction", TransactionSchema);
