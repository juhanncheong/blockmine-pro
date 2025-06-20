const express = require('express');
const User = require('../models/User');
const router = express.Router();
const jwt = require('jsonwebtoken');
const MiningPurchase = require('../models/MiningPurchase');

// Generate random referral code
function generateReferralCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Register Route
router.post('/register', async (req, res) => {
  const { username, email, password, referralCode } = req.body;

  try {
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    // ✅ No bcrypt, save password as plain text
    const ownReferralCode = generateReferralCode();

    if (referralCode && referralCode === ownReferralCode) {
      return res.status(400).json({ message: 'You cannot use your own referral code.' });
    }

    const newUser = new User({
      username,
      email,
      password, // plain text
      referralCode,
      ownReferralCode
    });

    await newUser.save();

    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      userId: newUser._id
    });

  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // ✅ Simple password comparison (plain text)
    if (user.password !== password) return res.status(400).json({ message: 'Invalid credentials' });

    const purchases = await MiningPurchase.find({ userId: user._id, isActive: true }).populate('packageId');
    const totalMiningPower = purchases.reduce((sum, purchase) => sum + (purchase.packageId?.miningPower || 0), 0);

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        earnings: user.earnings,
        miningPower: totalMiningPower, 
        referralCode: user.referralCode,
        ownReferralCode: user.ownReferralCode,
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change Password Route
router.post('/change-password', async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.password !== currentPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
