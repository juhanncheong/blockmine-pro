const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username:         { type: String, required: true, unique: true },
  email:            { type: String, required: true, unique: true },
  password:         { type: String, required: true },

  // referrals
  referralCode:     { type: String, required: true },   // code they used to register
  ownReferralCode:  { type: String, required: true },   // code generated for this user

  // USD-only balances
  balanceUSD:       { type: Number, default: 0 },       // spendable USD balance
  earningsUSD:      { type: Number, default: 0 },       // lifetime credited USD earnings

  bmtBalance:       { type: Number, default: 0 },
  totalWithdrawn:   { type: Number, default: 0 },

  // registration IP address
  registerIP:       { type: String },

  // last time user was online / logged in
  lastOnlineAt:     { type: Date },

  createdAt:        { type: Date, default: Date.now },
  isFrozen:         { type: Boolean, default: false }
});

module.exports = mongoose.model('User', userSchema);
