// routes/withdrawal.js
const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v);

const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const Transaction = require('../models/Transaction');

// ---- Config ----
const MIN_WITHDRAW = 20;
const METHOD_WHITELIST = ['bitcoin', 'ethereum', 'usdc', 'usdt'];

// If your Transaction schema uses a different enum value, change this:
const LEDGER_WITHDRAW_TYPE = 'withdraw';

// ---- Address validators ----
const reBTC = /^(bc1[a-z0-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/i; // bech32 or base58
const reEVM = /^0x[a-fA-F0-9]{40}$/;                                    // ETH/USDC/USDT on EVM
const reTRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;                            // USDT/USDC TRC20

function validateAddress(method, address) {
  if (!address || typeof address !== 'string') return false;
  const a = address.trim();

  if (method === 'bitcoin') return reBTC.test(a);
  if (method === 'ethereum') return reEVM.test(a);

  // usdc/usdt: allow either EVM or TRON formats (you can restrict later)
  if (method === 'usdc' || method === 'usdt') return reEVM.test(a) || reTRON.test(a);

  return false;
}

function normalizeAddress(method, address) {
  // Bech32 is case-insensitive but typically lowercased; EVM is usually lowercased.
  if (!address) return '';
  const a = address.trim();
  if (method === 'ethereum' || method === 'usdc' || method === 'usdt') {
    // If it's an EVM address, normalize to lowercase; TRON stays as-is
    return reEVM.test(a) ? a.toLowerCase() : a;
  }
  if (method === 'bitcoin') return a.toLowerCase();
  return a;
}

/**
 * POST /withdrawal/request
 * Body: { userId, amountUSD, method, details }  // details = crypto address
 * Behavior:
 *  - Validates payload (ObjectId, amount >= $20, method in whitelist, address format)
 *  - Validates user + USD balance
 *  - Deducts immediately (hold) and logs Transaction(-amountUSD, 'withdraw')
 *  - Creates Withdrawal({ status:'pending', method, details })
 */
router.post('/request', async (req, res) => {
  try {
    let { userId, amountUSD, method, details } = req.body;

    // ---- normalize/validate method ----
    method = (method || '').toString().trim().toLowerCase();
    if (!METHOD_WHITELIST.includes(method)) {
      return res.status(400).json({ message: 'Unsupported payout method' });
    }

    // ---- validate address ----
    const address = normalizeAddress(method, details);
    if (!validateAddress(method, address)) {
      return res.status(400).json({ message: 'Invalid address for selected method' });
    }

    // ---- amounts & ids ----
    const amt = Number(amountUSD);
    if (!userId) return res.status(400).json({ message: 'Missing userId' });
    if (!isObjectId(userId)) return res.status(400).json({ message: 'Invalid userId' });
    if (!Number.isFinite(amt)) return res.status(400).json({ message: 'amountUSD must be a number' });
    if (amt < MIN_WITHDRAW) return res.status(400).json({ message: `Minimum withdrawal is $${MIN_WITHDRAW}` });

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

    // ---- ledger (change LEDGER_WITHDRAW_TYPE if your enum differs) ----
    await Transaction.create({
      userId: user._id,
      type: LEDGER_WITHDRAW_TYPE,
      amountUSD: -amt,
      note: `Withdrawal request via ${method.toUpperCase()}`
    });

    // ---- withdrawal record (store address in details) ----
    const w = await Withdrawal.create({
      userId: user._id,
      amountUSD: amt,
      method,
      details: address,          // <— address lives here
      status: 'pending'
    });

    return res.json({
      message: 'Withdrawal requested (pending)',
      withdrawalId: w._id,
      balanceUSD: user.balanceUSD
    });
  } catch (err) {
    console.error('withdrawal/request error:', err);
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

/**
 * POST /withdrawal/process
 * Body: { withdrawalId, action }  // action: 'approve' | 'reject' | 'paid'
 *  - approve: mark approved
 *  - reject: refund USD back to user + ledger reversal
 *  - paid: mark paid
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
      if (w.status !== 'pending') return res.status(400).json({ message: 'Withdrawal already processed' });
      w.status = 'approved';
      w.processedAt = new Date();
      await w.save();
      return res.json({ message: 'Withdrawal approved' });
    }

    if (action === 'reject') {
      if (w.status !== 'pending') return res.status(400).json({ message: 'Withdrawal already processed' });
      const user = await User.findById(w.userId);
      if (user) {
        user.balanceUSD = Number(((Number(user.balanceUSD || 0)) + Number(w.amountUSD || 0)).toFixed(2));
        await user.save();

        await Transaction.create({
          userId: user._id,
          type: LEDGER_WITHDRAW_TYPE,
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
      if (w.status !== 'approved') return res.status(400).json({ message: 'Can only mark paid after approval' });
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
 * GET /withdrawal/my/:userId  — user history (newest first)
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
 * GET /withdrawal/all — admin list (newest first)
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
