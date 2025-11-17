const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Deposit = require("../models/Deposit");
const Transaction = require("../models/Transaction");
const GlobalSettings = require('../models/GlobalSettings');
const { sendDepositApprovedEmail } = require("../utils/mailer");

// POST /api/deposit  -> create pending deposit (user flow)
router.post("/", async (req, res) => {
  try {
    const {
      userId,
      amountUSD,
      coin,
      network,
      expectedCoinAmount,   // optional (FE name in some pages)
      sendCoinAmount,       // optional (FE name in other pages)
      quoteRate,
      txHash,
      confirmations,
      source
    } = req.body || {};

    const amt = Number(amountUSD);
    const coinAmt = Number(
      expectedCoinAmount ?? sendCoinAmount // ✅ accept either name
    );

    if (!userId || !coin || !Number.isFinite(amt) || amt <= 0 || !Number.isFinite(coinAmt) || coinAmt <= 0) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Get admin-configured address for this coin
    const settings = await GlobalSettings.findOne();
    const address = settings?.depositAddresses?.[coin] || "";

    // Create pending deposit (no wallet credit here)
    const dep = await Deposit.create({
      userId: user._id,
      amountUSD: +amt,
      coin,
      network: network || "",
      expectedCoinAmount: +coinAmt,
      quoteRate: Number(quoteRate || 0),
      txHash: txHash || "",
      confirmations: Number(confirmations || 0),
      status: "pending",
      source: source === "admin" ? "admin" : "user",
      address,                              // ✅ persist it
    });

    return res.json({ message: "Deposit created (pending)", depositId: dep._id, address });
  } catch (err) {
    console.error("deposit create error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/deposit/:id/proof -> update tx hash / confirmations
router.patch("/:id/proof", async (req, res) => {
  try {
    const dep = await Deposit.findById(req.params.id);
    if (!dep) return res.status(404).json({ message: "Deposit not found" });
    if (dep.status !== "pending") {
      return res.status(400).json({ message: "Deposit already processed" });
    }
    if (typeof req.body.txHash === "string") dep.txHash = req.body.txHash;
    if (Number.isFinite(Number(req.body.confirmations))) dep.confirmations = Number(req.body.confirmations);
    await dep.save();
    res.json({ message: "Proof updated", depositId: dep._id });
  } catch (err) {
    console.error("deposit proof error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/deposit/:id/admin-note -> add/update admin note (txid, comments)
router.patch("/:id/admin-note", async (req, res) => {
  try {
    const dep = await Deposit.findById(req.params.id);
    if (!dep) return res.status(404).json({ message: "Deposit not found" });

    // simple string note
    if (typeof req.body.adminNote === "string") {
      dep.adminNote = req.body.adminNote;
    }

    await dep.save();
    res.json({ message: "Admin note updated" });
  } catch (err) {
    console.error("deposit admin-note error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/deposit/:id/approve -> admin approves & credits USD
router.post("/:id/approve", async (req, res) => {
  try {
    const dep = await Deposit.findById(req.params.id);
    if (!dep) return res.status(404).json({ message: "Deposit not found" });
    if (dep.status !== "pending")
      return res.status(400).json({ message: "Deposit already processed" });

    const user = await User.findById(dep.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.balanceUSD = Number(
      ((user.balanceUSD || 0) + (dep.amountUSD || 0)).toFixed(2)
    );
    await user.save();

    await Transaction.create({
      userId: user._id,
      type: "deposit",
      amountUSD: Number(dep.amountUSD || 0),
      note: `Deposit via ${dep.coin}${
        dep.network ? "@" + dep.network : ""
      }${dep.txHash ? " tx:" + dep.txHash : ""}`,
    });

    dep.status = "approved";
    await dep.save();

    // 🔔 Send email ONLY for user-submitted deposits
    if (dep.source !== "admin") {
      // we don't want manual admin balance tweaks to fire an email
      sendDepositApprovedEmail({
        to: user.email,
        username: user.username || user.email,
        amountUSD: dep.amountUSD,
        coin: dep.coin,
        txHash: dep.txHash,
      }).catch((err) => {
        console.error("Failed to send deposit email:", err);
      });
    }

    res.json({
      message: "Deposit approved and credited",
      balanceUSD: user.balanceUSD,
    });
  } catch (err) {
    console.error("deposit approve error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/deposit/:id/reject -> admin rejects (no credit)
router.post("/:id/reject", async (req, res) => {
  try {
    const dep = await Deposit.findById(req.params.id);
    if (!dep) return res.status(404).json({ message: "Deposit not found" });
    if (dep.status !== "pending") return res.status(400).json({ message: "Deposit already processed" });

    dep.status = "rejected";
    await dep.save();

    res.json({ message: "Deposit rejected" });
  } catch (err) {
    console.error("deposit reject error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ NEW: POST /api/deposit/cancel/:id -> user cancels a pending request
router.post("/cancel/:id", async (req, res) => {
  try {
    const dep = await Deposit.findById(req.params.id);
    if (!dep) return res.status(404).json({ message: "Deposit not found" });
    if (dep.status !== "pending") return res.status(400).json({ message: "Deposit already processed" });

    dep.status = "canceled";
    await dep.save();
    res.json({ message: "Deposit canceled" });
  } catch (err) {
    console.error("deposit cancel error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/deposit/my/:userId -> user list
router.get("/my/:userId", async (req, res) => {
  try {
    const list = await Deposit.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error("deposit my error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/deposit/pending-count -> for admin sound alerts / polling + volume
router.get("/pending-count", async (_req, res) => {
  try {
    const agg = await Deposit.aggregate([
      { $match: { status: "pending" } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmountUSD: { $sum: "$amountUSD" },
        },
      },
    ]);

    const stats = agg[0] || { count: 0, totalAmountUSD: 0 };

    res.json({
      pending: stats.count,              // 🔢 count
      pendingAmountUSD: stats.totalAmountUSD, // 💵 volume in USD
    });
  } catch (err) {
    console.error("deposit pending-count error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/deposit/all -> admin list
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
