const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();
const jwt = require('jsonwebtoken');

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
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
  token,
  userId: user._id
});

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
module.exports = router;
