const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Search by email to get referral code and stats
router.get('/by-code', async (req, res) => {
  try {
    const code = req.query.code;
    const user = await User.findOne({ ownReferralCode: code });

    if (!user) return res.status(404).json({ message: 'Referral code not found' });

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
