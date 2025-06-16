const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET referral stats
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ✅ Find users who were referred by this user
    const invitedUsers = await User.find({ referralCode: user.ownReferralCode }).select('email createdAt');

    res.json({
      referralCount: invitedUsers.length,
      totalCommissions: user.earnings,
      invitedUsers: invitedUsers
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
