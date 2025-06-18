const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  stakeEnabled: { type: Boolean, default: false },
  swapEnabled: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('GlobalSettings', settingsSchema);
