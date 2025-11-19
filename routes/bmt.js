const express = require('express');
const router = express.Router();
const BMTPriceHistory = require('../models/BMTPriceHistory');

// GET all BMT price history
router.get('/bmt-price-history', async (req, res) => {
  try {
    const history = await BMTPriceHistory.find().sort({ date: 1 });
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Set or update today's BMT price
router.post('/bmt-price-history', async (req, res) => {
  try {
    const { price } = req.body;
    if (!price) return res.status(400).json({ message: 'Price is required' });

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const existing = await BMTPriceHistory.findOne({ date: today });
    if (existing) {
      existing.price = price;
      await existing.save();
      return res.json({ message: 'Price updated', data: existing });
    }

    const newEntry = new BMTPriceHistory({ date: today, price });
    await newEntry.save();
    res.json({ message: 'Price added', data: newEntry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- BMT Price History (delete) ----------
router.delete('/bmt-price-history/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await BMTPriceHistory.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Price history entry not found' });
    }

    return res.json({ message: 'BMT price history entry deleted successfully' });
  } catch (err) {
    console.error('Delete BMT price history error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
