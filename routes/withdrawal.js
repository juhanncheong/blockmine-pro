// routes/withdrawal.js
const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v);

const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const Transaction = require('../models/Transaction');

/**
 * POST /withdrawal/request
 * Body: { userId, amountUSD, method?, details? }
 * Behavior:
 *  - Validates payload (userId is ObjectId, amountUSD is number >= 20)
 *  - Validates user + balanceUSD
 *  - Deducts immediately (hold) and logs Transaction(-amountUSD, 'withdrawal')
 *  - Creates Withdrawal({status:'pending'})
 */
router.post('/request', async (req, res) => {
  try {
    const { userId, amountUSD, method, details } = req.body;

    // ---- input validation ----
    const amt = Number(amountUSD);
    if (!userId) return res.status(400).json({ message: 'Missing userId' });
    if (!isObjectId(userId)) return res.status(400).json({ message: 'Invalid userId' });
    if (!Number.isFinite(amt)) return res.status(400).json({ message: 'amountUSD must be a number' });
    if (amt < 20) return res.status(400).json({ message: 'Minimum withdrawal is $20' });

    // ---- user & balance ----
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const balanceUSD = Number(user.balanceUSD || 0);
    if (balanceUSD < amt) {
      return res.status(400).json({ message: 'Insufficient USD balance' });
    }

    // ---- hold funds ----
    user.balanceUSD = Number((balanceUSD - amt).toFixed(2));
    await user.save();

    // ---- ledger ----
    await Transaction.create({
      userId: user._id,
      type: 'withdrawal',
      amountUSD: -amt,
      note: method ? `Withdrawal request via ${method}` : 'Withdrawal request'
    });

    // ---- withdrawal record ----
    const w = await Withdrawal.create({
      userId: user._id,
      amountUSD: amt,
      method: method || 'manual',
      details: details || '',
      status: 'pending'
    });

    return res.json({
      message: 'Withdrawal requested (pending)',
      withdrawalId: w._id,
      balanceUSD: user.balanceUSD
    });
  } catch (err) {
    console.error('withdrawal/request error:', err);
    // Return a helpful message while still indicating server-side failure
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

/**
 * POST /withdrawal/process
 * Body: { withdrawalId, action }  // action: 'approve' | 'reject' | 'paid'
 * Behavior:
 *  - approve: mark approved (funds already held)
 *  - reject: refund USD back to user and mark rejected
 *  - paid: mark as paid (after you actually send funds)
 */
router.post('/process', async (req, res) => {
  try {
    const { withdrawalId, action } = req.body;

    if (!isObjectId(withdrawalId)) {
      return res.status(400).json({ message: 'Invalid withdrawalId' });
    }

    const w = await Withdrawal.findById(withdrawalId);
    if (!w) return res.status(404).json({ message: 'Withdrawal not found' });

    if (action === 'approve') {
      if (w.status !== 'pending') {
        return res.status(400).json({ message: 'Withdrawal already processed' });
      }
      w.status = 'approved';
      w.processedAt = new Date();
      await w.save();
      return res.json({ message: 'Withdrawal approved' });
    }

    if (action === 'reject') {
      if (w.status !== 'pending') {
        return res.status(400).json({ message: 'Withdrawal already processed' });
      }
      // Refund the held USD
      const user = await User.findById(w.userId);
      if (user) {
        user.balanceUSD = Number(((Number(user.balanceUSD || 0)) + Number(w.amountUSD || 0)).toFixed(2));
        await user.save();

        // Optional: ledger reversal
        await Transaction.create({
          userId: user._id,
          type: 'withdrawal',
          amountUSD: +Number(w.amountUSD || 0),
          note: 'Withdrawal rejected refund'
        });
      }
      w.status = 'rejected';
      w.processedAt = new Date();
      await w.save();
      return res.json({ message: 'Withdrawal rejected and refunded' });
    }

    if (action === 'paid') {
      if (w.status !== 'approved') {
        return res.status(400).json({ message: 'Can only mark paid after approval' });
      }
      w.status = 'paid';
      w.processedAt = new Date();
      await w.save();
      return res.json({ message: 'Withdrawal marked as paid' });
    }

    return res.status(400).json({ message: 'Invalid action' });
  } catch (err) {
    console.error('withdrawal/process error:', err);
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

/**
 * GET /withdrawal/my/:userId
 * - List user’s withdrawals (newest first)
 */
router.get('/my/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isObjectId(userId)) return res.status(400).json({ message: 'Invalid userId' });

    const list = await Withdrawal.find({ userId }).sort({ requestedAt: -1 });
    return res.json(list);
  } catch (err) {
    console.error('withdrawal/my error:', err);
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

/**
 * GET /withdrawal/all
 * - Admin: all withdrawals (newest first)
 */
router.get('/all', async (_req, res) => {
  try {
    const withdrawals = await Withdrawal.find()
      .populate('userId', 'username email')
      .sort({ requestedAt: -1 });
    return res.json(withdrawals);
  } catch (err) {
    console.error('withdrawal/all error:', err);
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

module.exports = router;
