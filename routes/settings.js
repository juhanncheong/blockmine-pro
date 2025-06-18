const express = require('express');
const router = express.Router();
const GlobalSettings = require('../models/GlobalSettings');

// GET current status
router.get('/', async (req, res) => {
  try {
    let settings = await GlobalSettings.findOne();
    if (!settings) settings = await GlobalSettings.create({});
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// TOGGLE a feature (stakeEnabled or swapEnabled)
router.put('/toggle', async (req, res) => {
  try {
    const { key, value } = req.body; // key: 'stakeEnabled', value: true/false
    const settings = await GlobalSettings.findOne() || await GlobalSettings.create({});
    settings[key] = value;
    await settings.save();
    res.json({ message: `${key} updated`, settings });
  } catch (err) {
    res.status(500).json({ message: 'Toggle failed' });
  }
});

module.exports = router;
