const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Search by email to get referral code and stats
router.get('/by-email', async (req, res) => {
  try {
    const rawEmail = req.query.email;
    if (!rawEmail) return res.status(400).json({ message: 'Email required' });

    const email = rawEmail.trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const invitedUsers = await User.find({ referralCode: user.ownReferralCode }).select('email createdAt');

    const totalCommissionResult = await Transaction.aggregate([
      { $match: { userId: user._id, type: 'referral-commission' } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const totalReferralCommission = (totalCommissionResult[0]?.total || 0).toFixed(8);

    res.json({
      email: user.email,
      ownReferralCode: user.ownReferralCode,
      referralCount: invitedUsers.length,
      invitedUsers: invitedUsers,
      totalReferralCommission: parseFloat(totalReferralCommission)
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});



// Search directly by ownReferralCode
router.get('/by-code', async (req, res) => {
  try {
    const code = req.query.code;
    const user = await User.findOne({ ownReferralCode: code });

    if (!user) return res.status(404).json({ message: 'Referral code not found' });

    const referralCount = await User.countDocuments({ referralCode: user.ownReferralCode });

    res.json({
      email: user.email,
      ownReferralCode: user.ownReferralCode,
      referralCount: referralCount
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
