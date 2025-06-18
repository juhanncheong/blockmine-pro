const mongoose = require('mongoose');

const bmTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  balance: {
    type: Number,
    default: 0,
  },
  staked: {
    type: Number,
    default: 0,
  },
  stakingStartDate: {
    type: Date,
  },
});

module.exports = mongoose.model('BMToken', bmTokenSchema);
