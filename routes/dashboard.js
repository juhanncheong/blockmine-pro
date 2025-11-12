const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Withdrawal = require("../models/Withdrawal");
const MiningPurchase = require("../models/MiningPurchase");
const Package = require("../models/Package");
const Transaction = require("../models/Transaction");

// GET /api/dashboard/summary/:userId
router.get("/summary/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const [user, pendingWithdrawals, purchases] = await Promise.all([
      User.findById(userId),
      Withdrawal.countDocuments({ userId, status: "pending" }),
      MiningPurchase.find({ userId, isActive: true }).populate("packageId"),
    ]);

    const miningPowerTotal = purchases.reduce((total, purchase) => {
      const packagePower = purchase.packageId?.miningPower || 0;
      return total + packagePower;
    }, 0);

    res.json({
      usdBalance: user?.balanceUSD || 0,
      miningPower: miningPowerTotal,
      pendingWithdrawals: pendingWithdrawals || 0,
      bmtBalance: user?.bmtBalance || 0,
      activePackages: purchases.length || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load dashboard summary" });
  }
});

// GET /api/dashboard/earnings/:userId
router.get("/earnings/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const allEarnings = await Transaction.find({
      userId,
      type: "earnings",
    });

    // Sum in USD
    const totalEarnings = allEarnings.reduce(
      (sum, tx) => sum + (tx.amountUSD || 0),
      0
    );

    const today = moment().startOf("day");

    const todayEarnings = allEarnings
      .filter(
        (tx) => tx.createdAt && moment(tx.createdAt).isSame(today, "day")
      )
      .reduce((sum, tx) => sum + (tx.amountUSD || 0), 0);

    // 7-day chart
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const day = moment().subtract(i, "days").startOf("day");
      const dailyEarnings = allEarnings
        .filter(
          (tx) => tx.createdAt && moment(tx.createdAt).isSame(day, "day")
        )
        .reduce((sum, tx) => sum + (tx.amountUSD || 0), 0);

      chartData.push({
        date: day.format("MMM D"),
        amount: Number(dailyEarnings.toFixed(2)),
      });
    }

    res.json({
      totalEarnings: Number(totalEarnings.toFixed(2)),
      todayEarnings: Number(todayEarnings.toFixed(2)),
      chartData,
    });
  } catch (err) {
    console.error("❌ Failed to fetch earnings summary:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
