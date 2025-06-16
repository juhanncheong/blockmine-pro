const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// GET referral stats
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ✅ Find users who were referred by this user
    const invitedUsers = await User.find({ referralCode: user.ownReferralCode }).select('email createdAt');

    // ✅ Calculate commissions from transaction logs
    const commissionTx = await Transaction.find({
      userId: user._id,
      type: "referral-commission"
    });

    const totalCommissions = commissionTx.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

    res.json({
      referralCount: invitedUsers.length,
      totalCommissions: totalCommissions.toFixed(8),
      invitedUsers: invitedUsers
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
