const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  referralCode: { type: String, required: true },   // Code they used to register
  ownReferralCode: { type: String, required: true }, // Code we generate for them

  miningPower: { type: Number, default: 0 }, // TH/s
  earnings: { type: Number, default: 0 }, // Total mined
  balance: { type: Number, default: 0 },  // Available wallet balance
  totalWithdrawn: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
