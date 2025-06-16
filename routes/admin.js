const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const router = express.Router();
const MiningPurchase = require('../models/MiningPurchase');
const Package = require('../models/Package');
const Deposit = require("../models/Deposit");

// Admin login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ message: 'Invalid credentials' });

    // For now plain text, so direct compare
    if (password !== admin.password) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ adminId: admin._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, email: admin.email });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Middleware to protect admin routes
function verifyAdminToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Invalid token' });
    req.adminId = decoded.adminId;
    next();
  });
}

// Admin Stats Endpoint
router.get('/stats', verifyAdminToken, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalMiningPower = await User.aggregate([
      { $group: { _id: null, totalPower: { $sum: "$miningPower" } } }
    ]);
    const totalWithdrawals = await Withdrawal.countDocuments({ status: 'approved' });
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });

    res.json({
      totalUsers,
      totalMiningPower: totalMiningPower[0]?.totalPower || 0,
      totalWithdrawals,
      pendingWithdrawals,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// User Management (search + paginate + sort)
router.get('/users', verifyAdminToken, async (req, res) => {
  const { email, page = 1 } = req.query;
  const limit = 10;
  const skip = (page - 1) * limit;

  try {
    let query = {};
    if (email) query.email = { $regex: email, $options: 'i' };

    const total = await User.countDocuments(query);
    const users = await User.find(query).skip(skip).limit(limit).lean();

    // Now calculate miningPower for each user dynamically:
    const usersWithMiningPower = await Promise.all(users.map(async (user) => {
      const purchases = await MiningPurchase.find({ userId: user._id, isActive: true }).populate('packageId');
      const totalMiningPower = purchases.reduce((sum, purchase) => sum + (purchase.packageId?.miningPower || 0), 0);

      return {
        ...user,
        miningPower: totalMiningPower
      };
    }));

    res.json({ total, users: usersWithMiningPower });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user fields (password, email, withdrawalPin, balance, freeze)
router.put('/users/:id', verifyAdminToken, async (req, res) => {
  const { id } = req.params;
  const { password, email, withdrawalPin, balance, freezeAccount } = req.body;

  try {
    const update = {};
    if (password) update.password = password; // hash if you want later
    if (email) update.email = email;
    if (withdrawalPin) update.withdrawalPin = withdrawalPin;
    if (balance !== undefined) update.balance = balance;
    if (freezeAccount !== undefined) update.isFrozen = freezeAccount;

    const user = await User.findByIdAndUpdate(id, update, { new: true });

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User updated', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// List Withdrawals (for admin)
router.get('/withdrawals', verifyAdminToken, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find()
      .populate('userId', 'email username')
      .sort({ requestedAt: -1 })
      .lean();
    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve or Reject Withdrawal
router.post('/withdrawals/process', verifyAdminToken, async (req, res) => {
  const { withdrawalId, action } = req.body;
  try {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') return res.status(400).json({ message: 'Already processed' });

    if (action === 'approve') {
      withdrawal.status = 'approved';
      withdrawal.processedAt = new Date();
    } else if (action === 'reject') {
      withdrawal.status = 'rejected';
      withdrawal.processedAt = new Date();

      // Refund user
      const user = await User.findById(withdrawal.userId);
      user.balance += withdrawal.amount;
      await user.save();
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }

    await withdrawal.save();
    res.json({ message: `Withdrawal ${action}d successfully` });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Package Management endpoints
router.get('/packages', verifyAdminToken, async (req, res) => {
  try {
    const packages = await Package.find().lean();
    res.json(packages);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/packages', verifyAdminToken, async (req, res) => {
  const { name, priceUSD, miningPower, duration } = req.body;
  try {
    const newPackage = new Package({ name, priceUSD, miningPower, duration });
    await newPackage.save();
    res.status(201).json({ message: 'Package created' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/packages/:id', verifyAdminToken, async (req, res) => {
  const { id } = req.params;
  const { name, priceUSD, miningPower, duration } = req.body;
  try {
    const updatedPackage = await Package.findByIdAndUpdate(id, { name, priceUSD, miningPower, duration }, { new: true });
    if (!updatedPackage) return res.status(404).json({ message: 'Package not found' });
    res.json({ message: 'Package updated', updatedPackage });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/packages/:id', verifyAdminToken, async (req, res) => {
  const { id } = req.params;
  try {
    await Package.findByIdAndDelete(id);
    res.json({ message: 'Package deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});



router.post("/admin/deposit", async (req, res) => {
  try {
    const { userId, amount } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Create deposit record
    const newDeposit = new Deposit({
      userId: user._id,
      amount: parseFloat(amount),
    });
    await newDeposit.save();

    // Update user balance
    user.balance += parseFloat(amount);
    await user.save();

    res.json({ message: "Deposit added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get('/user-packages/:userId', verifyAdminToken, async (req, res) => {
  try {
    const purchases = await MiningPurchase.find({ userId: req.params.userId }).populate('packageId');
    res.json(purchases);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch user packages' });
  }
});

router.post('/user-packages', verifyAdminToken, async (req, res) => {
  const { userId, packageId } = req.body;

  if (!userId || !packageId) {
    return res.status(400).json({ message: 'Missing userId or packageId' });
  }

  try {
    const pkg = await Package.findById(packageId);
    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }

    await MiningPurchase.create({
      userId,
      packageId: pkg._id,
      purchaseDate: new Date(),
      earnings: 0,
      isActive: true
    });

    res.json({ message: 'Package added to user successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add package' });
  }
});

router.delete('/user-packages/:purchaseId', verifyAdminToken, async (req, res) => {
  try {
    const deleted = await MiningPurchase.findByIdAndDelete(req.params.purchaseId);

    if (!deleted) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    res.json({ message: 'Package purchase deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete package purchase' });
  }
});

module.exports = router;
