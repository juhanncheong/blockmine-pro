const mongoose = require('mongoose');

const MiningPurchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true },

  purchaseDate: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },

  // Total earnings credited in USD for this package
  earningsUSD: { type: Number, default: 0 },

  // Principal paid in USD (refunded at expiry)
  principalUSD: { type: Number, default: 0 },

  // Marks that the principal has already been refunded once
  principalRefunded: { type: Boolean, default: false }
});

module.exports = mongoose.model('MiningPurchase', MiningPurchaseSchema);
