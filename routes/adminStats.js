const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Deposit = require("../models/Deposit");
const Withdrawal = require("../models/Withdrawal");

router.get("/", async (_req, res) => {
  try {
    const totalUsers = await User.countDocuments();

    const depositsAgg = await Deposit.aggregate([
      { $group: { _id: null, total: { $sum: "$amountUSD" } } }
    ]);
    const totalDepositsUSD = depositsAgg[0]?.total || 0;

    const withdrawalsAgg = await Withdrawal.aggregate([
      { $group: { _id: null, total: { $sum: "$amountUSD" } } }
    ]);
    const totalWithdrawalsUSD = withdrawalsAgg[0]?.total || 0;

    // Optional: compute total earningsUSD from users (or sum transactions of type 'earnings')
    const totalEarningsUSD = 0;

    res.json({
      totalUsers,
      totalDepositsUSD: +Number(totalDepositsUSD).toFixed(2),
      totalWithdrawalsUSD: +Number(totalWithdrawalsUSD).toFixed(2),
      totalEarningsUSD
    });
  } catch (err) {
    console.error("Error generating stats:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
