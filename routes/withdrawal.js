const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');

const router = express.Router();

// User Submit Withdrawal
router.post('/request', async (req, res) => {
  const { userId, amount, address } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check balance
    if (user.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Deduct balance (lock funds)
    user.balance -= amount;
    await user.save();

    // Create withdrawal request
    const withdrawal = new Withdrawal({
      userId,
      amount,
      address
    });

    await withdrawal.save();

    res.status(201).json({ message: 'Withdrawal request submitted successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
// Admin Approve or Reject Withdrawal
router.post('/process', async (req, res) => {
  const { withdrawalId, action } = req.body;

  try {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found' });

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ message: 'Withdrawal already processed' });
    }

    if (action === 'approve') {
      withdrawal.status = 'approved';
      withdrawal.processedAt = new Date();
      // ✅ You can trigger actual BTC payout here in future
    } 
    else if (action === 'reject') {
      withdrawal.status = 'rejected';
      withdrawal.processedAt = new Date();

      // ✅ Refund balance if rejected
      const user = await User.findById(withdrawal.userId);
      user.balance += withdrawal.amount;
      await user.save();
    }
    else {
      return res.status(400).json({ message: 'Invalid action' });
    }

    await withdrawal.save();
    res.json({ message: `Withdrawal ${action} successfully` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
// Admin: Get all withdrawals
router.get('/all', async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find().populate('userId', 'username email');
    res.json(withdrawals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
module.exports = router;
