const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: { type: String, required: true },           // Package Name
  priceUSD: { type: Number, required: true },       // Fixed price in USD
  miningPower: { type: Number, required: true },    // Mining power (TH/s)
  duration: { type: Number, required: true },       // Duration in days
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Package', packageSchema);
