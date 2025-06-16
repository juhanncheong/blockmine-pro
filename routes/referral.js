const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET referral stats
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Count how many users were referred by this user's code
    const referralCount = await User.countDocuments({ referralCode: user.ownReferralCode });

    // (Optional) In future you can also sum commissions here if you store commissions in User model

    res.json({
      referralCount: referralCount,
      totalCommissions: user.earnings  // Assuming earnings = total commissions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
