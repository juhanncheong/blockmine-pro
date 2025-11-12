const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// GET referral stats
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Users referred by this user
    const invitedUsers = await User
      .find({ referralCode: user.ownReferralCode })
      .select('email createdAt');

    // Sum USD referral commissions
    const commissionTx = await Transaction.find({
      userId: user._id,
      type: "referral-commission"
    }).select('amountUSD createdAt');

    const totalCommissionsUSD = commissionTx.reduce(
      (sum, tx) => sum + Number(tx.amountUSD || 0), 0
    );

    res.json({
      referralCount: invitedUsers.length,
      totalCommissionsUSD: Number(totalCommissionsUSD.toFixed(2)),
      invitedUsers
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
