const express = require('express');
const router = express.Router();
const GlobalSettings = require('../models/GlobalSettings');
const { verifyAdminToken } = require('../middleware/auth'); // if you already use it

// Helper: ensure one settings doc exists
async function getSettingsDoc() {
  let settings = await GlobalSettings.findOne();
  if (!settings) settings = await GlobalSettings.create({});
  return settings;
}

// ✅ GET all settings
router.get('/', async (req, res) => {
  try {
    const settings = await getSettingsDoc();
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ PUT toggle (existing feature)
router.put('/toggle', async (req, res) => {
  try {
    const { key, value } = req.body;
    const settings = await getSettingsDoc();
    settings[key] = value;
    await settings.save();
    res.json({ message: `${key} updated`, settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Toggle failed' });
  }
});

// ✅ NEW: GET deposit addresses
router.get('/deposit-addresses', async (req, res) => {
  try {
    const settings = await getSettingsDoc();
    res.json(settings.depositAddresses || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ NEW: PUT deposit addresses (admin only)
router.put('/deposit-addresses', verifyAdminToken, async (req, res) => {
  try {
    const { BTC, ETH, USDC, USDT } = req.body || {};
    const settings = await getSettingsDoc();
    settings.depositAddresses = {
      BTC:  BTC  ?? settings.depositAddresses.BTC,
      ETH:  ETH  ?? settings.depositAddresses.ETH,
      USDC: USDC ?? settings.depositAddresses.USDC,
      USDT: USDT ?? settings.depositAddresses.USDT,
    };
    await settings.save();
    res.json({ message: 'Deposit addresses updated', depositAddresses: settings.depositAddresses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
