const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Search by email to get referral code and stats
router.get('/by-email', async (req, res) => {
  try {
    const email = req.query.email;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: 'User not found' });

    const invitedUsers = await User.find({ referralCode: user.ownReferralCode }).select('email createdAt');

    res.json({
      email: user.email,
      ownReferralCode: user.ownReferralCode,
      referralCount: invitedUsers.length,
      invitedUsers: invitedUsers
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Search by referral code
router.get('/by-code', async (req, res) => {
  try {
    const code = req.query.code;
    const user = await User.findOne({ ownReferralCode: code });
    if (!user) {
      return res.status(404).json({ message: 'Referral code not found' });
    }

    // Get all invited users by matching referralCode
    const invitedUsers = await User.find({ referralCode: user.ownReferralCode }).select('email createdAt');
    const referralCount = invitedUsers.length;

    res.json({
      email: user.email,
      ownReferralCode: user.ownReferralCode,
      referralCount,
      invitedUsers  // ✅ include full invitedUsers list
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
