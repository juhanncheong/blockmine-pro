// routes/adminReferral.js
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Deposit = require('../models/Deposit');
const Withdrawal = require('../models/Withdrawal');

async function buildReferralOverview(user) {
  // direct invited users
  const invitedUsers = await User
    .find({ referralCode: user.ownReferralCode })
    .select('email createdAt');

  const invitedIds = invitedUsers.map((u) => u._id);

  // referral commission tx for this user
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

  // team (all levels) tree
  const tree = await buildDownlineTree(user);

  return {
    userId: user._id,
    email: user.email,
    ownReferralCode: user.ownReferralCode,

    referralCount: invitedUsers.length,
    totalReferralCommissionUSD: Number(totalReferralCommissionUSD.toFixed(2)),
    invitedUsers,
    transactions: txs,

    // team totals (all levels)
    downlineDepositsUSD: tree.teamDepositsUSD,
    downlineWithdrawalsUSD: tree.teamWithdrawalsUSD,

    // full tree per member
    downlineTree: tree.nodes,  // [{ userId,email,level,depositsUSD,withdrawalsUSD,... }, ...]
  };
}

async function buildDownlineTree(rootUser, maxDepth = 10) {
  const allNodes = [];
  const seenIds = new Set();

  let currentLevel = 1;
  let frontierCodes = [rootUser.ownReferralCode];

  while (frontierCodes.length && currentLevel <= maxDepth) {
    const users = await User.find({ referralCode: { $in: frontierCodes } })
      .select('email ownReferralCode referralCode createdAt');

    if (!users.length) break;

    const nextFrontier = [];

    for (const u of users) {
      const idStr = u._id.toString();
      if (seenIds.has(idStr)) continue;
      seenIds.add(idStr);

      allNodes.push({
        userId: u._id,
        email: u.email,
        ownReferralCode: u.ownReferralCode,
        referralCode: u.referralCode,
        createdAt: u.createdAt,
        level: currentLevel,
      });

      if (u.ownReferralCode) {
        nextFrontier.push(u.ownReferralCode);
      }
    }

    frontierCodes = nextFrontier;
    currentLevel += 1;
  }

  if (!allNodes.length) {
    return {
      nodes: [],
      teamDepositsUSD: 0,
      teamWithdrawalsUSD: 0,
    };
  }

  const ids = allNodes.map((n) => n.userId);

  // Aggregate deposits for all downline users
  const depAgg = await Deposit.aggregate([
    { $match: { userId: { $in: ids }, status: 'approved' } },
    { $group: { _id: '$userId', total: { $sum: '$amountUSD' } } },
  ]);

  const wAgg = await Withdrawal.aggregate([
    { $match: { userId: { $in: ids }, status: 'paid' } },
    { $group: { _id: '$userId', total: { $sum: '$amountUSD' } } },
  ]);

  const depMap = new Map(depAgg.map((r) => [String(r._id), r.total]));
  const wMap = new Map(wAgg.map((r) => [String(r._id), r.total]));

  let teamDepositsUSD = 0;
  let teamWithdrawalsUSD = 0;

  const nodesWithTotals = allNodes.map((n) => {
    const idStr = String(n.userId);
    const dep = Number(depMap.get(idStr) || 0);
    const w = Number(wMap.get(idStr) || 0);
    teamDepositsUSD += dep;
    teamWithdrawalsUSD += w;
    return {
      ...n,
      depositsUSD: dep,
      withdrawalsUSD: w,
    };
  });

  return {
    nodes: nodesWithTotals,
    teamDepositsUSD: Number(teamDepositsUSD.toFixed(2)),
    teamWithdrawalsUSD: Number(teamWithdrawalsUSD.toFixed(2)),
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
