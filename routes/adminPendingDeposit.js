const express = require("express");
const router = express.Router();
const PendingDeposit = require("../models/PendingDeposit");
const Deposit = require("../models/Deposit");
const User = require("../models/User");
const Transaction = require("../models/Transaction"); // ✅ <-- ADD THIS LINE

// GET: fetch all pending deposits
router.get("/", async (req, res) => {
  try {
    const pendingDeposits = await PendingDeposit.find().populate("userId");
    res.json(pendingDeposits);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST: Approve deposit
router.post("/:id/approve", async (req, res) => {
  try {
    const pending = await PendingDeposit.findById(req.params.id);
    if (!pending) return res.status(404).json({ message: "Pending deposit not found" });

    // 1️⃣ Create Deposit record
    const deposit = new Deposit({
      userId: pending.userId,
      coin: pending.coin,
      amount: pending.creditBTC, // your Deposit.js always saves BTC credit
      createdAt: new Date()
    });
    await deposit.save();

    // 2️⃣ Update user balance
    await User.findByIdAndUpdate(pending.userId, {
      $inc: { balance: pending.creditBTC }
    });

    // ✅ 3️⃣ Create transaction history for user wallet
    await Transaction.create({
      userId: pending.userId,
      type: "deposit",
      amount: pending.creditBTC,
      createdAt: new Date()
    });

    // 4️⃣ Delete from pending list
    await PendingDeposit.findByIdAndDelete(pending._id);

    res.json({ message: "Deposit approved, credited & added to transaction history" });
  } catch (err) {
    console.error("Approve Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST: Reject deposit
router.post("/:id/reject", async (req, res) => {
  try {
    await PendingDeposit.findByIdAndDelete(req.params.id);
    res.json({ message: "Deposit rejected and removed" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
