const mongoose = require("mongoose");

const depositSchema = new mongoose.Schema({
  userId:              { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // What the user intends to pay with (frontend shows live quote)
  coin:                { type: String, required: true },         // e.g. 'BTC','ETH','USDT-TRC20'
  network:             { type: String, default: "" },            // optional: 'BTC','ERC20','TRC20'...

  // USD is the source of truth (what you will credit on approval)
  amountUSD:           { type: Number, required: true },         // e.g. 100.00

  // Quoted details at request time
  expectedCoinAmount:  { type: Number, required: true },         // coin amount the UI told them to send
  quoteRate:           { type: Number, default: 0 },             // USD per coin at quote time (from your FE)
  quotedAt:            { type: Date, default: Date.now },

  // Proof (user/admin fills these later)
  txHash:              { type: String, default: "" },            // on-chain hash / transfer id
  confirmations:       { type: Number, default: 0 },             // for chains where you track it

  // Workflow
  status:              { type: String, enum: ["pending","approved","rejected"], default: "pending" },
  source:              { type: String, enum: ["user","admin"], default: "user" },
  createdAt:           { type: Date, default: Date.now }
});

module.exports = mongoose.model("Deposit", depositSchema);
