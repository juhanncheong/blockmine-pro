// models/News.js
const mongoose = require("mongoose");

const NewsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  imageUrl: { type: String, required: true },
  linkUrl: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },   // for manual ordering later
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("News", NewsSchema);
