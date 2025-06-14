const express = require('express');
const Package = require('../models/Package');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');

// Create new package (Admin Only)
router.post('/create', async (req, res) => {
  const { name, priceUSD, miningPower, duration } = req.body;

  try {
    const newPackage = new Package({
      name,
      priceUSD,
      miningPower,
      duration
    });

    await newPackage.save();
    res.status(201).json({ message: 'Package created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all packages (for frontend display)
router.get('/all', async (req, res) => {
  try {
    const packages = await Package.find();
    res.json(packages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Edit package (Admin Only)
router.put('/edit/:id', async (req, res) => {
  const { name, priceUSD, miningPower, duration } = req.body;

  try {
    const updatedPackage = await Package.findByIdAndUpdate(
      req.params.id,
      { name, priceUSD, miningPower, duration },
      { new: true }
    );

    if (!updatedPackage) {
      return res.status(404).json({ message: 'Package not found' });
    }

    res.json({ message: 'Package updated successfully', updatedPackage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
// Purchase Package Route
router.post('/purchase', async (req, res) => {
  const { userId, packageId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const packageData = await Package.findById(packageId);
    if (!packageData) return res.status(404).json({ message: 'Package not found' });

    // Get live BTC price (from CoinGecko)
    const priceRes = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const btcPriceUSD = priceRes.data.bitcoin.usd;

    // Calculate BTC amount required
    const requiredBTC = packageData.priceUSD / btcPriceUSD;

    // Check user's BTC balance
    if (user.balance < requiredBTC) {
      return res.status(400).json({ message: 'Insufficient BTC balance' });
    }

    // Deduct BTC balance & add mining power
    user.balance -= requiredBTC;
    user.miningPower += packageData.miningPower;

    await user.save();

    res.json({ 
      message: 'Package purchased successfully',
      miningPower: user.miningPower,
      balance: user.balance
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
module.exports = router;
