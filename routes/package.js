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

router.post('/purchase', async (req, res) => {
  try {
    const { userId, packageId } = req.body;

    // Validate payload
    if (!userId || !packageId) {
      return res.status(400).json({ message: 'Invalid payload' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const pkg = await Package.findById(packageId);
    if (!pkg) return res.status(404).json({ message: 'Package not found' });

    const priceUSD = Number(pkg.priceUSD || 0);
    if (!Number.isFinite(priceUSD) || priceUSD <= 0) {
      return res.status(400).json({ message: 'Package priceUSD is invalid' });
    }

    // ---- NEW: use bonus + normal balance together ----
    const currentBalanceUSD = Number(user.balanceUSD || 0);
    const currentBonusUSD = Number(user.bonusBalanceUSD || 0);
    const totalAvailable = currentBalanceUSD + currentBonusUSD;

    if (totalAvailable < priceUSD) {
      return res.status(400).json({ message: 'Insufficient USD balance (including bonus)' });
    }

    // Deduct from BONUS first, then from NORMAL
    let remaining = priceUSD;
    let usedFromBonus = 0;
    let usedFromBalance = 0;

    if (currentBonusUSD > 0) {
      usedFromBonus = Math.min(currentBonusUSD, remaining);
      remaining -= usedFromBonus;
    }

    if (remaining > 0) {
      // At this point we know totalAvailable >= priceUSD, so balance must be enough for remaining
      if (currentBalanceUSD < remaining) {
        return res.status(400).json({ message: 'Insufficient normal balance for remaining amount' });
      }
      usedFromBalance = remaining;
      remaining = 0;
    }

    // Apply deductions to user
    user.bonusBalanceUSD = Number((currentBonusUSD - usedFromBonus).toFixed(2));
    user.balanceUSD = Number((currentBalanceUSD - usedFromBalance).toFixed(2));

    // Optional referral commission (guard self-referral) — 15% of priceUSD (based on full package price)
    if (user.referralCode && user.referralCode !== user.ownReferralCode) {
      const inviter = await User.findOne({ ownReferralCode: user.referralCode });
      if (inviter) {
        const commissionUSD = Number((priceUSD * 0.15).toFixed(2));
        inviter.balanceUSD = Number(((inviter.balanceUSD || 0) + commissionUSD).toFixed(2));
        await inviter.save();

        await Transaction.create({
          userId: inviter._id,
          type: 'referral-commission',
          amountUSD: commissionUSD,
          note: `Commission from ${user.username} (${pkg.name})`
        });
      }
    }

    // Record the purchase spend (negative) - full price
    await Transaction.create({
      userId: user._id,
      type: 'purchase',
      amountUSD: -priceUSD,
      note: `${pkg.name} (bonus: $${usedFromBonus.toFixed(2)}, balance: $${usedFromBalance.toFixed(2)})`
    });

    // Create the mining purchase (track how much came from bonus vs normal)
    const etNow = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
    );

    await MiningPurchase.create({
      userId: user._id,
      packageId: pkg._id,
      purchaseDate: etNow,   // store ET time, not UTC
      isActive: true,
      earningsUSD: 0,
      principalUSD: priceUSD,
      principalFromBonusUSD: usedFromBonus,
      principalFromBalanceUSD: usedFromBalance,
      principalRefunded: false
    });

    // BMT reward (if any)
    const tokensToAdd = Number(pkg.bmtReward || 0);
    if (tokensToAdd > 0) {
      user.bmtBalance = Number(((user.bmtBalance || 0) + tokensToAdd).toFixed(8));
    }

    // Persist user changes
    await user.save();

    // Return updated total mining power from active purchases
    const purchases = await MiningPurchase
      .find({ userId: user._id, isActive: true })
      .populate('packageId');

    const totalMiningPower = purchases.reduce(
      (sum, p) => sum + (p.packageId?.miningPower || 0),
      0
    );

    res.json({
      message: 'Package purchased successfully (USD)',
      miningPower: totalMiningPower,
      balanceUSD: user.balanceUSD,
      bonusBalanceUSD: user.bonusBalanceUSD
    });

  } catch (err) {
    console.error('🔥 USD Purchase error:', err);
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
