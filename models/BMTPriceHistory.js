const mongoose = require('mongoose');

const bmtPriceHistorySchema = new mongoose.Schema({
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
    unique: true,
  },
  price: {
    type: Number,
    required: true,
  }
});

module.exports = mongoose.model('BMTPriceHistory', bmtPriceHistorySchema);
