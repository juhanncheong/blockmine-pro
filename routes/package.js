const express = require('express');
const Package = require('../models/Package');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const MiningPurchase = require('../models/MiningPurchase');

// Create new package (Admin Only)
router.post('/create', async (req, res) => {
  const { name, priceUSD, miningPower, duration, description } = req.body;

  try {
    const newPackage = new Package({
      name,
      priceUSD,
      miningPower,
      duration,
      description  // ✅ Add description here
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
  const { name, priceUSD, miningPower, duration, description } = req.body;

  try {
    const updatedPackage = await Package.findByIdAndUpdate(
      req.params.id,
      { name, priceUSD, miningPower, duration, description },
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
// ✅ PURCHASE Package (Clean Logic)
router.post('/purchase', async (req, res) => {
  const { userId, packageId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const packageData = await Package.findById(packageId);
    if (!packageData) return res.status(404).json({ message: 'Package not found' });

    // ✅ Fetch live BTC price via AllOrigins proxy
    const priceRes = await axios.get(
      'https://api.allorigins.win/get?url=' +
      encodeURIComponent('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
    );
    const parsed = JSON.parse(priceRes.data.contents);
    const btcPriceUSD = parsed.bitcoin.usd;

    const requiredBTC = parseFloat((packageData.priceUSD / btcPriceUSD).toFixed(8));

    if (user.balance < requiredBTC) {
      return res.status(400).json({ message: 'Insufficient BTC balance' });
    }

    user.balance = parseFloat((user.balance - requiredBTC).toFixed(8));
    
    // ✅ Handle referral commissions (now fully safe against self-referral)
  if (user.referralCode && user.referralCode !== user.ownReferralCode) {
  const inviter = await User.findOne({ ownReferralCode: user.referralCode });

  if (inviter) {
    const commissionBTC = parseFloat((requiredBTC * 0.15).toFixed(8));

    inviter.balance = parseFloat((inviter.balance + commissionBTC).toFixed(8));
    await inviter.save();

    await Transaction.create({
      userId: inviter._id,
      type: 'referral-commission',
      amount: commissionBTC
    });
  }
}

    await Transaction.create({
      userId: user._id,
      type: 'purchase',
      amount: requiredBTC
    });
    await MiningPurchase.create({
     userId: user._id,
     packageId: packageData._id,
     purchaseDate: new Date(), // default
     earnings: 0,
     isActive: true
    }); 
    // ✅ Dynamically calculate miningPower after purchase
const purchases = await MiningPurchase.find({ userId: user._id, isActive: true }).populate('packageId');
const totalMiningPower = purchases.reduce((sum, purchase) => sum + (purchase.packageId?.miningPower || 0), 0);

res.json({
  message: 'Package purchased successfully',
  miningPower: totalMiningPower,
  balance: user.balance
});

  } catch (err) {
    console.error("🔥 Purchase error:", err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


router.delete('/delete/:id', async (req, res) => {
  try {
    const deletedPackage = await Package.findByIdAndDelete(req.params.id);

    if (!deletedPackage) {
      return res.status(404).json({ message: 'Package not found' });
    }

    res.json({ message: 'Package deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Get all purchases for a user
router.get('/my-purchases/:userId', async (req, res) => {
  try {
    const purchases = await MiningPurchase.find({ userId: req.params.userId })
      .populate('packageId');

    res.json(purchases);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
module.exports = router;
