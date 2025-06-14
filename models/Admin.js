const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true } // for now plain text, can hash later
});

module.exports = mongoose.model('Admin', adminSchema);
