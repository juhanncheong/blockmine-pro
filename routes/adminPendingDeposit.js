const express = require("express");
const router = express.Router();
const Deposit = require("../models/Deposit");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

// ✅ GET pending deposits
router.get("/", async (req, res) => {
  try {
    const pendingDeposits = await Deposit.find({ status: "pending" }).populate("userId");
    res.json(pendingDeposits);
  } catch (err) {
    console.error("Failed to fetch pending deposits:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ POST approve deposit
router.post("/:id/approve", async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) return res.status(404).json({ message: "Deposit not found" });

    // ✅ Update status to approved
    deposit.status = "approved";
    await deposit.save();

    // ✅ Update user balance
    await User.findByIdAndUpdate(deposit.userId, {
      $inc: { balance: deposit.creditBTC }
    });

    // ✅ Create transaction history
    await Transaction.create({
      userId: deposit.userId,
      type: "deposit",
      amount: deposit.creditBTC,
      createdAt: new Date()
    });

    res.json({ message: "Deposit approved & credited" });
  } catch (err) {
    console.error("Approve error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ POST reject deposit
router.post("/:id/reject", async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) return res.status(404).json({ message: "Deposit not found" });

    deposit.status = "rejected";
    await deposit.save();

    res.json({ message: "Deposit rejected" });
  } catch (err) {
    console.error("Reject error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
