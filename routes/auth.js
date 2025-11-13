const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const User = require('../models/User');
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

// Register
router.post('/register', async (req, res) => {
  const { username, email, password, referralCode } = req.body;

  try {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const ownReferralCode = generateReferralCode();
    if (referralCode && referralCode === ownReferralCode) {
      return res.status(400).json({ message: 'You cannot use your own referral code.' });
    }

    // 🔹 Get client IP (works behind most proxies)
    const registerIP =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.connection?.remoteAddress ||
      req.ip;

    const now = new Date();

    const newUser = new User({
      username,
      email: normalizedEmail,
      password, // (plain text for now)
      referralCode: referralCode || '',
      ownReferralCode,
      registerIP,      
      lastOnlineAt: now, 
    });

    await newUser.save();

    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({ token, userId: newUser._id });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const rawEmail = req.body.email;
  const password = req.body.password;

  try {
    const email = (rawEmail || '').trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    if (user.password !== password) return res.status(400).json({ message: 'Invalid credentials' });

    const purchases = await MiningPurchase
      .find({ userId: user._id, isActive: true })
      .populate('packageId');

    const totalMiningPower = purchases.reduce(
      (sum, p) => sum + (p.packageId?.miningPower || 0),
      0
    );

    // Update lastOnlineAt on successful login
    user.lastOnlineAt = new Date();
    await user.save();

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
        balanceUSD: user.balanceUSD || 0,
        earningsUSD: user.earningsUSD || 0,
        miningPower: totalMiningPower,
        referralCode: user.referralCode || '',
        ownReferralCode: user.ownReferralCode
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change Password
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
