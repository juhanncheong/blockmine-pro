const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  referralCode: { type: String, required: true },   // Code they used to register
  ownReferralCode: { type: String, required: true }, // Code we generate for them

  earnings: { type: Number, default: 0 }, // Total mined
  balance: { type: Number, default: 0 },  // Available wallet balance
  bmtBalance: { type: Number, default: 0 },  
  totalWithdrawn: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  isFrozen: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', userSchema);
