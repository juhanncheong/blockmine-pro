const mongoose = require('mongoose');

const MiningPurchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },
  purchaseDate: { type: Date, default: Date.now },
  earnings: { type: Number, default: 0 },  // Total earnings from this package
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('MiningPurchase', MiningPurchaseSchema);
