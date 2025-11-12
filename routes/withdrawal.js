const express = require('express');
const router = express.Router();

const User = require('./models/User');
const Withdrawal = require('./models/Withdrawal');
const Transaction = require('./models/Transaction');

/**
 * POST /withdrawal/request
 * Body: { userId, amountUSD, method?, details? }
 * Behavior:
 *  - Validates balanceUSD
 *  - Deducts immediately (hold) and logs Transaction(-amountUSD, 'withdrawal')
 *  - Creates Withdrawal({status:'pending'})
 */
router.post('/request', async (req, res) => {
  try {
    const { userId, amountUSD, method, details } = req.body;

    const amt = Number(amountUSD);
    if (!userId || !Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: 'Invalid payload' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if ((user.balanceUSD || 0) < amt) {
      return res.status(400).json({ message: 'Insufficient USD balance' });
    }

    // Deduct funds on request (lock/hold)
    user.balanceUSD = Number(((user.balanceUSD || 0) - amt).toFixed(2));
    await user.save();

    // Ledger entry
    await Transaction.create({
      userId: user._id,
      type: 'withdrawal',
      amountUSD: -amt,
      note: method ? `Withdrawal request via ${method}` : 'Withdrawal request'
    });

    const w = await Withdrawal.create({
      userId: user._id,
      amountUSD: amt,
      method: method || 'manual',
      details: details || '',
      status: 'pending'
    });

    res.json({ message: 'Withdrawal requested (pending)', withdrawalId: w._id, balanceUSD: user.balanceUSD });
  } catch (err) {
    console.error('withdrawal/request error:', err);
    res.status(500).json({ message: 'Server error' });
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

    const w = await Withdrawal.findById(withdrawalId);
    if (!w) return res.status(404).json({ message: 'Withdrawal not found' });

    if (w.status !== 'pending' && action !== 'paid') {
      // Only allow approve/reject once; 'paid' can follow 'approved'
      return res.status(400).json({ message: 'Withdrawal already processed' });
    }

    if (action === 'approve') {
      w.status = 'approved';
      w.processedAt = new Date();
      await w.save();
      return res.json({ message: 'Withdrawal approved' });
    }

    if (action === 'reject') {
      // Refund the held USD
      const user = await User.findById(w.userId);
      if (user) {
        user.balanceUSD = Number(((user.balanceUSD || 0) + (w.amountUSD || 0)).toFixed(2));
        await user.save();

        // Optional: add a ledger reversal (credit back)
        await Transaction.create({
          userId: user._id,
          type: 'withdrawal',
          amountUSD: +Number(w.amountUSD || 0),
          note: `Withdrawal rejected refund`
        });
      }

      w.status = 'rejected';
      w.processedAt = new Date();
      await w.save();
      return res.json({ message: 'Withdrawal rejected and refunded' });
    }

    if (action === 'paid') {
      // Finalize payout (usually after it was approved)
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
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /withdrawal/my/:userId
 * - List user’s withdrawals (newest first)
 */
router.get('/my/:userId', async (req, res) => {
  try {
    const list = await Withdrawal.find({ userId: req.params.userId }).sort({ requestedAt: -1 });
    res.json(list);
  } catch (err) {
    console.error('withdrawal/my error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /withdrawal/all
 * - Admin: all withdrawals
 */
router.get('/all', async (_req, res) => {
  try {
    const withdrawals = await Withdrawal.find().populate('userId', 'username email').sort({ requestedAt: -1 });
    res.json(withdrawals);
  } catch (err) {
    console.error('withdrawal/all error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
