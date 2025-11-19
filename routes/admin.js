const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const Admin = require('../models/Admin');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const MiningPurchase = require('../models/MiningPurchase');
const Package = require('../models/Package');
const Deposit = require('../models/Deposit');
const Stake = require('../models/Stake');
const Transaction = require('../models/Transaction'); // ← for USD ledger writes

// ---------- Auth ----------

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ message: 'Invalid credentials' });
    if (password !== admin.password) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ adminId: admin._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, email: admin.email });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

function verifyAdminToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Invalid token' });
    req.adminId = decoded.adminId;
    next();
  });
}

// ---------- Stats ----------

// ---------- Stats ----------

router.get('/stats', verifyAdminToken, async (_req, res) => {
  try {
    // 1) Total users
    const totalUsers = await User.countDocuments();

    // 2) Total deposits (approved only)
    const depositsAgg = await Deposit.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amountUSD' } } }
    ]);
    const totalDepositsUSD = depositsAgg[0]?.total || 0;

    // 3) Total withdrawals (PAID only – matches WithdrawalsManagement)
    const withdrawalsAgg = await Withdrawal.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amountUSD' } } }
    ]);
    const totalWithdrawalsUSD = withdrawalsAgg[0]?.total || 0;

    // 4) Total mining power (same as before)
    const miningAgg = await MiningPurchase.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'packages',
          localField: 'packageId',
          foreignField: '_id',
          as: 'pkg'
        }
      },
      { $unwind: '$pkg' },
      { $group: { _id: null, totalPower: { $sum: '$pkg.miningPower' } } }
    ]);
    const totalMiningPower = miningAgg[0]?.totalPower || 0;

    // 5) Total earnings (mining + referral + BMT earnings)
    const earningsAgg = await Transaction.aggregate([
      {
        $match: {
          type: { $in: ['earnings', 'referral-commission', 'bmt-earnings'] }
        }
      },
      { $group: { _id: null, total: { $sum: '$amountUSD' } } }
    ]);
    const totalEarningsUSD = earningsAgg[0]?.total || 0;

    res.json({
      totalUsers,
      totalDepositsUSD: Number(totalDepositsUSD.toFixed(2)),
      totalWithdrawalsUSD: Number(totalWithdrawalsUSD.toFixed(2)),
      totalEarningsUSD: Number(totalEarningsUSD.toFixed(2)),
      totalMiningPower
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- Users (search/list/update) ----------

router.get('/users', verifyAdminToken, async (req, res) => {
  const { email, page = 1 } = req.query;
  const limit = 10;
  const skip = (page - 1) * limit;

  try {
    const query = email ? { email: { $regex: email, $options: 'i' } } : {};
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const usersWithMiningPower = await Promise.all(
      users.map(async (user) => {
        const purchases = await MiningPurchase
          .find({ userId: user._id, isActive: true })
          .populate('packageId');
        const totalMiningPower = purchases.reduce(
          (sum, p) => sum + (p.packageId?.miningPower || 0),
          0
        );
        return { ...user, miningPower: totalMiningPower };
      })
    );

    res.json({ total, users: usersWithMiningPower });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/users/:id', verifyAdminToken, async (req, res) => {
  const { id } = req.params;
  const { password, email, withdrawalPin, balanceUSD, freezeAccount } = req.body;

  try {
    const update = {};
    if (password) update.password = password; // (consider hashing later)
    if (email) update.email = email;
    if (withdrawalPin) update.withdrawalPin = withdrawalPin;
    if (balanceUSD !== undefined) update.balanceUSD = balanceUSD; // USD era
    if (freezeAccount !== undefined) update.isFrozen = freezeAccount;

    const user = await User.findByIdAndUpdate(id, update, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User updated', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- Withdrawals (list/process) ----------

router.get('/withdrawals', verifyAdminToken, async (_req, res) => {
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

router.post('/withdrawals/process', verifyAdminToken, async (req, res) => {
  const { withdrawalId, action } = req.body;
  try {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') return res.status(400).json({ message: 'Already processed' });

    if (action === 'approve') {
      withdrawal.status = 'approved';
      withdrawal.processedAt = new Date();
      await withdrawal.save();
      return res.json({ message: 'Withdrawal approved' });
    }

    if (action === 'reject') {
      withdrawal.status = 'rejected';
      withdrawal.processedAt = new Date();

      const user = await User.findById(withdrawal.userId);
      if (user) {
        user.balanceUSD = (user.balanceUSD || 0) + (withdrawal.amountUSD || 0);
        await user.save();

        // Ledger reversal for transparency
        await Transaction.create({
          userId: user._id,
          type: 'withdrawal',
          amountUSD: +(withdrawal.amountUSD || 0),
          note: 'Withdrawal rejected refund (admin)'
        });
      }

      await withdrawal.save();
      return res.json({ message: 'Withdrawal rejected and refunded' });
    }

    return res.status(400).json({ message: 'Invalid action' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- Packages CRUD ----------

router.get('/packages', verifyAdminToken, async (_req, res) => {
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
    const updatedPackage = await Package.findByIdAndUpdate(
      id,
      { name, priceUSD, miningPower, duration },
      { new: true }
    );
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

// ---------- Admin deposit (manual credit with bonus support) ----------
router.post('/deposit', verifyAdminToken, async (req, res) => {
  try {
    const { userId, amountUSD, depositType } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const amount = Number(amountUSD);
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const type = depositType === "bonus" ? "bonus" : "normal";

    const newDeposit = new Deposit({
      userId: user._id,
      amountUSD: amount,
      coin: "USD",
      network: type === "bonus" ? "admin_bonus" : "manual",
      expectedCoinAmount: 0,
      quoteRate: 1,
      status: "approved",
      source: "admin"
    });
    await newDeposit.save();

    if (type === "bonus") {
      user.bonusBalanceUSD = (user.bonusBalanceUSD || 0) + amount;
      user.welcomeBonusRedeemed = true;
    } else {
      user.balanceUSD = (user.balanceUSD || 0) + amount;
    }

    await user.save({ validateBeforeSave: false });

    await Transaction.create({
      userId: user._id,
      type: type === "bonus" ? "bonusDeposit" : "deposit",
      amountUSD: amount,
      note: type === "bonus" ? "Admin bonus credit" : "Admin manual deposit",
    });

    res.json({
      message: type === "bonus"
        ? "Bonus USD credited successfully"
        : "Manual USD deposit added successfully",
      balanceUSD: user.balanceUSD,
      bonusBalanceUSD: user.bonusBalanceUSD
    });

  } catch (err) {
    console.error("Admin deposit error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------- Admin attach/detach user packages ----------

router.get('/user-packages/:userId', verifyAdminToken, async (req, res) => {
  try {
    const purchases = await MiningPurchase
      .find({ userId: req.params.userId })
      .populate('packageId');
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
    if (!pkg) return res.status(404).json({ message: 'Package not found' });

    await MiningPurchase.create({
      userId,
      packageId: pkg._id,
      purchaseDate: new Date(),
      isActive: true,
      earningsUSD: 0,
      principalUSD: 0,          // admin-granted package, no charge taken
      principalRefunded: false
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
    if (!deleted) return res.status(404).json({ message: 'Purchase not found' });
    res.json({ message: 'Package purchase deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete package purchase' });
  }
});

// ---------- BMT helpers ----------

router.get('/user-bmt', verifyAdminToken, async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      userId: user._id,
      email: user.email,
      bmtBalance: user.bmtBalance || 0,
    });
  } catch (err) {
    console.error('Failed to fetch user BMT', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/adjust-bmt', verifyAdminToken, async (req, res) => {
  const { userId, amount } = req.body;
  if (!userId || typeof amount !== 'number') {
    return res.status(400).json({ message: 'Missing userId or invalid amount' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.bmtBalance = (user.bmtBalance || 0) + amount;
    await user.save();

    res.json({ message: 'BMT balance updated', bmtBalance: user.bmtBalance });
  } catch (err) {
    console.error('Failed to adjust BMT balance', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- Stakes ----------

router.get('/stakes', verifyAdminToken, async (req, res) => {
  const { email } = req.query;

  try {
    const userFilter = {};
    if (email) {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: 'User not found' });
      userFilter.userId = user._id;
    }

    const stakes = await Stake.find(userFilter)
      .sort({ startDate: -1 })
      .populate('userId', 'email');

    res.json(stakes);
  } catch (err) {
    console.error('Failed to fetch stakes', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/bmt-stats', verifyAdminToken, async (_req, res) => {
  try {
    const users = await User.find({}, 'bmtBalance email');
    const totalBMT = users.reduce((sum, u) => sum + (u.bmtBalance || 0), 0);
    const topHolder = users.sort((a, b) => (b.bmtBalance || 0) - (a.bmtBalance || 0))[0];

    res.json({
      totalBMT,
      topHolder: {
        email: topHolder?.email || 'N/A',
        bmtBalance: topHolder?.bmtBalance || 0,
      },
    });
  } catch (err) {
    console.error('Failed to fetch BMT stats', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
