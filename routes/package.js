const express = require('express');
const Package = require('../models/Package');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const MiningPurchase = require('../models/MiningPurchase');

// Create new package (Admin Only)
router.post('/create', async (req, res) => {
  const { name, priceUSD, miningPower, duration, description, bmtReward } = req.body;

  try {
    const newPackage = new Package({
      name,
      priceUSD,
      miningPower,
      duration,
      description,
      bmtReward
    });

    await newPackage.save();
    res.status(201).json({ message: 'Package created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all packages (for frontend display)
router.get('/all', async (_req, res) => {
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
  const { name, priceUSD, miningPower, duration, description, bmtReward } = req.body;

  try {
    const updatedPackage = await Package.findByIdAndUpdate(
      req.params.id,
      { name, priceUSD, miningPower, duration, description, bmtReward },
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

// ✅ PURCHASE using client-provided requiredBTC (no live price calls)
router.post('/purchase', async (req, res) => {
  try {
    const { userId, packageId, requiredBTC } = req.body;

    // Validate payload
    if (!userId || !packageId || !(Number(requiredBTC) > 0)) {
      return res.status(400).json({ message: 'Invalid payload' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const packageData = await Package.findById(packageId);
    if (!packageData) return res.status(404).json({ message: 'Package not found' });

    const need = Number(Number(requiredBTC).toFixed(8));
    if (!Number.isFinite(need) || need <= 0) {
      return res.status(400).json({ message: 'requiredBTC must be a positive number' });
    }
    if (user.balance < need) {
      return res.status(400).json({ message: 'Insufficient BTC balance' });
    }

    // Deduct BTC
    user.balance = Number((user.balance - need).toFixed(8));

    // Optional referral commission (guard self-referral)
    if (user.referralCode && user.referralCode !== user.ownReferralCode) {
      const inviter = await User.findOne({ ownReferralCode: user.referralCode });
      if (inviter) {
        const commission = Number((need * 0.15).toFixed(8));
        inviter.balance = Number(((inviter.balance || 0) + commission).toFixed(8));
        await inviter.save();
        await Transaction.create({
          userId: inviter._id,
          type: 'referral-commission',
          amount: commission,
          createdAt: new Date()
        });
      }
    }

    // Record the spend
    await Transaction.create({
      userId: user._id,
      type: 'purchase',
      amount: need,
      createdAt: new Date()
    });

    // Create the mining purchase
    await MiningPurchase.create({
      userId: user._id,
      packageId: packageData._id,
      purchaseDate: new Date(),
      earnings: 0,
      isActive: true
    });

    // BMT reward (if any)
    const tokensToAdd = Number(packageData.bmtReward || 0);
    if (tokensToAdd > 0) {
      user.bmtBalance = Number(((user.bmtBalance || 0) + tokensToAdd).toFixed(8));
    }

    // Persist user changes
    await user.save();

    // Return updated mining power
    const purchases = await MiningPurchase
      .find({ userId: user._id, isActive: true })
      .populate('packageId');

    const totalMiningPower = purchases.reduce(
      (sum, p) => sum + (p.packageId?.miningPower || 0),
      0
    );

    res.json({
      message: 'Package purchased successfully',
      miningPower: totalMiningPower,
      balance: user.balance
    });

  } catch (err) {
    console.error('🔥 Purchase error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete package (Admin Only)
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
