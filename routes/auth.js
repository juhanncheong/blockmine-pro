const express = require('express');
const bcrypt = require('bcryptjs');
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

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate own referral code
    const ownReferralCode = generateReferralCode();

    // Self-referral protection
    if (referralCode && referralCode === ownReferralCode) {
    return res.status(400).json({ message: 'You cannot use your own referral code.' });
    }

    // Create new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      referralCode,
      ownReferralCode
    });

    await newUser.save();

// Generate JWT after registration
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

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    // ✅ Calculate miningPower dynamically:
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
        ownReferralCode: user.ownReferralCode
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
