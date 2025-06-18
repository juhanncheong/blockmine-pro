const express = require('express');
const router = express.Router();
const BMToken = require('../models/BMToken');

// Get BMT balance for a user
router.get('/bmt/:userId', async (req, res) => {
  try {
    const tokenData = await BMToken.findOne({ userId: req.params.userId });
    res.json({ balance: tokenData?.balance || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
