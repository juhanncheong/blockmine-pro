const express = require('express');
const router = express.Router();
require('dotenv').config();

const User = require('../models/User');
const Package = require('../models/Package');
const MiningPurchase = require('../models/MiningPurchase');
const Transaction = require('../models/Transaction');

// Read global earning rate from .env (USD per TH/s per day)
const ENV_RATE = parseFloat(process.env.EARNING_RATE_USD_PER_THS || '0'); // e.g. 2

function wholeDaysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  const d1 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const d2 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((d2 - d1) / MS);
}

/**
 * POST /mining/run-daily-earnings
 * - For each user, load active purchases
 * - Determine rate: per-package override OR ENV_RATE
 * - Credit USD earnings to purchase + user
 * - Record Transaction(type='earnings', amountUSD=+)
 */
router.post('/run-daily-earnings', async (req, res) => {
  try {
    if (isNaN(ENV_RATE) || ENV_RATE <= 0) {
      return res.status(400).json({ message: 'EARNING_RATE_USD_PER_THS missing or invalid in .env' });
    }

    const users = await User.find({});
    for (const user of users) {
      const purchases = await MiningPurchase
        .find({ userId: user._id, isActive: true })
        .populate('packageId');

      let creditedTodayUSD = 0;

      for (const p of purchases) {
        const pkg = p.packageId;
        if (!pkg) continue;

        const powerTHS = Number(pkg.miningPower || 0);
        // per-package override, else env
        const rate = Number(pkg.earningRateUSDPerTHSPerDay || ENV_RATE);
        const earn = +(powerTHS * rate).toFixed(2);
        if (earn <= 0) continue;

        // credit purchase + user
        p.earningsUSD = (p.earningsUSD || 0) + earn;
        await p.save();

        user.balanceUSD = (user.balanceUSD || 0) + earn;
        user.earningsUSD = (user.earningsUSD || 0) + earn;
        creditedTodayUSD += earn;

        await Transaction.create({
          userId: user._id,
          type: 'earnings',
          amountUSD: earn,
          note: pkg.name || `Purchase ${p._id}`
        });
      }

      await user.save();
      if (creditedTodayUSD > 0) {
        console.log(`User ${user.username} earned $${creditedTodayUSD.toFixed(2)} today.`);
      }
    }

    res.json({ message: 'Daily USD mining earnings completed.' });
  } catch (err) {
    console.error('run-daily-earnings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /mining/cleanup-expired
 * - Marks purchases inactive once duration is reached
 * - Refunds principalUSD exactly once if not already refunded
 * - Records Transaction(type='principal-refund', amountUSD=+)
 */
router.post('/cleanup-expired', async (req, res) => {
  try {
    const purchases = await MiningPurchase.find({ isActive: true }).populate('packageId');

    for (const p of purchases) {
      const pkg = p.packageId;
      if (!pkg) continue;

      const daysPassed = wholeDaysBetween(new Date(p.purchaseDate), new Date());
      const duration = Number(pkg.duration || 0);

      if (duration > 0 && daysPassed >= duration) {
        // refund principal once (if configured)
        if (!p.principalRefunded && p.principalUSD > 0) {
          const user = await User.findById(p.userId);
          if (user) {
            user.balanceUSD = (user.balanceUSD || 0) + p.principalUSD;
            await user.save();

            await Transaction.create({
              userId: user._id,
              type: 'principal-refund',
              amountUSD: p.principalUSD,
              note: `Refund for purchase ${p._id}`
            });

            p.principalRefunded = true;
          }
        }

        p.isActive = false;
        await p.save();
        console.log(`Marked purchase ${p._id} as expired`);
      }
    }

    res.json({ message: 'Expiration cleanup completed.' });
  } catch (err) {
    console.error('cleanup-expired error:', err);
    res.status(500).json({ message: 'Server error while cleaning expired purchases' });
  }
});

/**
 * GET /mining/earnings-history/:userId
 * - Returns USD earnings transactions
 */
router.get('/earnings-history/:userId', async (req, res) => {
  try {
    const earnings = await Transaction.find({
      userId: req.params.userId,
      type: 'earnings'
    }).sort({ createdAt: -1 });

    res.json(earnings);
  } catch (err) {
    console.error('earnings-history error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
