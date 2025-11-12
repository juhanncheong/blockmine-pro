const mongoose = require('mongoose');

const WithdrawalSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // USD only
  amountUSD:  { type: Number, required: true },        // requested USD amount

  // Payout details (bank, usdt-offchain, paypal, etc.)
  method:     { type: String, default: 'manual' },     // e.g. 'bank', 'paypal', 'usdt-offchain'
  details:    { type: String, default: '' },           // account/wallet/notes

  status:     { type: String, enum: ['pending','approved','rejected','paid'], default: 'pending' },

  requestedAt:{ type: Date, default: Date.now },
  processedAt:{ type: Date }
});

module.exports = mongoose.model('Withdrawal', WithdrawalSchema);
