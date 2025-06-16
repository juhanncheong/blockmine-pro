const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Deposit = require("../models/Deposit");
const Withdrawal = require("../models/Withdrawal");

router.get("/", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();

    const deposits = await Deposit.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalDeposits = deposits[0]?.total || 0;

    const withdrawals = await Withdrawal.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalWithdrawals = withdrawals[0]?.total || 0;

    // 🔧 Total earnings — you can replace this logic later:
    const totalEarnings = totalDeposits * 10000;  // example placeholder

    res.json({
      totalUsers,
      totalDeposits,
      totalWithdrawals,
      totalEarnings
    });
  } catch (err) {
    console.error("Error generating stats:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
