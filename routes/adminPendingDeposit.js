const express = require("express");
const router = express.Router();
const Deposit = require("../models/Deposit");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

// ✅ GET all pending deposits
router.get("/", async (_req, res) => {
  try {
    const pending = await Deposit.find({ status: "pending" }).populate("userId");
    res.json(pending);
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
    if (deposit.status !== "pending") return res.status(400).json({ message: "Already processed" });

    deposit.status = "approved";
    await deposit.save();

    // ✅ Credit USD balance
    const user = await User.findById(deposit.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.balanceUSD = (user.balanceUSD || 0) + (deposit.amountUSD || 0);
    await user.save();

    // ✅ Ledger entry
    await Transaction.create({
      userId: deposit.userId,
      type: "deposit",
      amountUSD: deposit.amountUSD,
      note: `Approved deposit via ${deposit.coin}${deposit.network ? "@" + deposit.network : ""}`
    });

    res.json({ message: "Deposit approved and credited in USD", balanceUSD: user.balanceUSD });
  } catch (err) {
    console.error("Approve deposit error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ POST reject deposit
router.post("/:id/reject", async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) return res.status(404).json({ message: "Deposit not found" });
    if (deposit.status !== "pending") return res.status(400).json({ message: "Already processed" });

    deposit.status = "rejected";
    await deposit.save();

    res.json({ message: "Deposit rejected" });
  } catch (err) {
    console.error("Reject deposit error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
