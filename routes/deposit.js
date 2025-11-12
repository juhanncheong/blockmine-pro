const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Deposit = require("../models/Deposit");
const Transaction = require("../models/Transaction");

/**
 * POST /deposit
 * Create a deposit request.
 * Body:
 *  - userId: string (required)
 *  - amountUSD: number (required)         // how much USD to credit on approval
 *  - coin: string (required)              // 'BTC', 'ETH', 'USDT-TRC20', etc.
 *  - network?: string                     // 'BTC', 'ERC20', 'TRC20', etc.
 *  - expectedCoinAmount: number (required)// from FE quote at request time
 *  - quoteRate?: number                   // USD per coin at quote time (for audit)
 *  - txHash?: string                      // optional; can be added later
 *  - confirmations?: number               // optional; can be updated later
 *  - source?: 'user' | 'admin'            // default 'user'
 */
router.post("/", async (req, res) => {
  try {
    const {
      userId,
      amountUSD,
      coin,
      network,
      expectedCoinAmount,
      quoteRate,
      txHash,
      confirmations,
      source
    } = req.body;

    const amt = Number(amountUSD);
    const coinAmt = Number(expectedCoinAmount);

    if (!userId || !coin || !Number.isFinite(amt) || amt <= 0 || !Number.isFinite(coinAmt) || coinAmt <= 0) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    // create pending deposit; no wallet credit here
    const dep = await Deposit.create({
      userId,
      amountUSD: +amt,
      coin,
      network: network || "",
      expectedCoinAmount: +coinAmt,
      quoteRate: Number(quoteRate || 0),
      txHash: txHash || "",
      confirmations: Number(confirmations || 0),
      status: "pending",
      source: source === "admin" ? "admin" : "user"
    });

    res.json({ message: "Deposit created (pending)", depositId: dep._id });
  } catch (err) {
    console.error("deposit create error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * PATCH /deposit/:id/proof
 * Update proof fields (txHash / confirmations) after user pays.
 * Body: { txHash?, confirmations? }
 */
router.patch("/:id/proof", async (req, res) => {
  try {
    const dep = await Deposit.findById(req.params.id);
    if (!dep) return res.status(404).json({ message: "Deposit not found" });
    if (dep.status !== "pending") {
      return res.status(400).json({ message: "Deposit already processed" });
    }

    if (typeof req.body.txHash === "string") dep.txHash = req.body.txHash;
    if (Number.isFinite(Number(req.body.confirmations))) {
      dep.confirmations = Number(req.body.confirmations);
    }
    await dep.save();
    res.json({ message: "Proof updated", depositId: dep._id });
  } catch (err) {
    console.error("deposit proof error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /deposit/:id/approve
 * Admin approves after verifying on-chain payment.
 * Credits user.balanceUSD and logs a Transaction.
 */
router.post("/:id/approve", async (req, res) => {
  try {
    const dep = await Deposit.findById(req.params.id);
    if (!dep) return res.status(404).json({ message: "Deposit not found" });
    if (dep.status !== "pending") {
      return res.status(400).json({ message: "Deposit already processed" });
    }

    const user = await User.findById(dep.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Credit USD balance
    user.balanceUSD = Number(((user.balanceUSD || 0) + (dep.amountUSD || 0)).toFixed(2));
    await user.save();

    // Ledger entry
    await Transaction.create({
      userId: user._id,
      type: "deposit",
      amountUSD: Number(dep.amountUSD || 0),
      note: `Deposit via ${dep.coin}${dep.network ? "@" + dep.network : ""}${dep.txHash ? " tx:" + dep.txHash : ""}`
    });

    dep.status = "approved";
    await dep.save();

    res.json({ message: "Deposit approved and credited", balanceUSD: user.balanceUSD });
  } catch (err) {
    console.error("deposit approve error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /deposit/:id/reject
 * Reject deposit (no credit). Optionally include a reason.
 * Body: { reason? }
 */
router.post("/:id/reject", async (req, res) => {
  try {
    const dep = await Deposit.findById(req.params.id);
    if (!dep) return res.status(404).json({ message: "Deposit not found" });
    if (dep.status !== "pending") {
      return res.status(400).json({ message: "Deposit already processed" });
    }

    dep.status = "rejected";
    // Optionally: store reason in a new field if you add one (e.g. dep.note = req.body.reason)
    await dep.save();

    res.json({ message: "Deposit rejected" });
  } catch (err) {
    console.error("deposit reject error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /deposit/my/:userId
 * User: list own deposits
 */
router.get("/my/:userId", async (req, res) => {
  try {
    const list = await Deposit.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error("deposit my error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /deposit/all
 * Admin: list all deposits
 */
router.get("/all", async (_req, res) => {
  try {
    const list = await Deposit.find().populate("userId", "username email").sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error("deposit all error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
