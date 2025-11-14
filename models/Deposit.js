const mongoose = require("mongoose");

const depositSchema = new mongoose.Schema({
  userId:              { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  coin:                { type: String, required: true },
  network:             { type: String, default: "" },
  amountUSD:           { type: Number, required: true },
  expectedCoinAmount:  { type: Number, required: true },
  quoteRate:           { type: Number, default: 0 },
  quotedAt:            { type: Date, default: Date.now },
  address:             { type: String, default: "" },
  txHash:              { type: String, default: "" },
  confirmations:       { type: Number, default: 0 },

  status:              { type: String, enum: ["pending","approved","rejected","canceled"], default: "pending" },
  source:              { type: String, enum: ["user","admin"], default: "user" },

  // 🔹 NEW: admin-only comment field (can store txid + notes)
  adminNote:           { type: String, default: "" },

  createdAt:           { type: Date, default: Date.now }
});

module.exports = mongoose.model("Deposit", depositSchema);
