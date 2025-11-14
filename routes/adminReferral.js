// routes/adminReferral.js
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Deposit = require('../models/Deposit');
const Withdrawal = require('../models/Withdrawal');

async function buildReferralOverview(user) {
  // who this user invited
  const invitedUsers = await User
    .find({ referralCode: user.ownReferralCode })
    .select('email createdAt');

  const invitedIds = invitedUsers.map((u) => u._id);

  // all referral commission transactions
  const txs = await Transaction.find({
    userId: user._id,
    type: 'referral-commission',
  })
    .sort({ createdAt: -1 })
    .select('amountUSD note createdAt');

  const totalReferralCommissionUSD = txs.reduce(
    (sum, tx) => sum + Number(tx.amountUSD || 0),
    0
  );

  // 🔹 Downline deposits (approved)
  let downlineDepositsUSD = 0;
  // 🔹 Downline withdrawals (paid out)
  let downlineWithdrawalsUSD = 0;

  if (invitedIds.length > 0) {
    const depAgg = await Deposit.aggregate([
      { $match: { userId: { $in: invitedIds }, status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amountUSD' } } },
    ]);
    downlineDepositsUSD = depAgg[0]?.total || 0;

    const wAgg = await Withdrawal.aggregate([
      { $match: { userId: { $in: invitedIds }, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amountUSD' } } },
    ]);
    downlineWithdrawalsUSD = wAgg[0]?.total || 0;
  }

  return {
    userId: user._id,
    email: user.email,
    ownReferralCode: user.ownReferralCode,

    referralCount: invitedUsers.length,
    totalReferralCommissionUSD: Number(totalReferralCommissionUSD.toFixed(2)),
    invitedUsers,
    transactions: txs,

    // 👇 NEW fields for the KPI card
    downlineDepositsUSD: Number(downlineDepositsUSD.toFixed(2)),
    downlineWithdrawalsUSD: Number(downlineWithdrawalsUSD.toFixed(2)),
  };
}

/**
 * GET /api/admin/referral/by-email?email=...
 */
router.get('/by-email', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: 'Missing email' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const overview = await buildReferralOverview(user);
    return res.json(overview);
  } catch (err) {
    console.error('admin referral by-email error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/admin/referral/by-code?code=...
 * looks up the user whose ownReferralCode matches
 */
router.get('/by-code', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ message: 'Missing code' });
    }

    const normalizedCode = code.trim().toUpperCase();
    const user = await User.findOne({ ownReferralCode: normalizedCode });
    if (!user) {
      return res.status(404).json({ message: 'User not found for this referral code' });
    }

    const overview = await buildReferralOverview(user);
    return res.json(overview);
  } catch (err) {
    console.error('admin referral by-code error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
