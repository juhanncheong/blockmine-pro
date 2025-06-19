const mongoose = require("mongoose");

const stakeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  amount: { type: Number, required: true },
  dailyReward: { type: Number, required: true },
  startDate: { type: Date, default: Date.now },
  unlockDate: { type: Date, required: true },
  active: { type: Boolean, default: true },
  refunded: { type: Boolean, default: false }
});

module.exports = mongoose.model("Stake", stakeSchema);
