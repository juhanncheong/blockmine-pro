const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Withdrawal = require("../models/Withdrawal");
const MiningPurchase = require("../models/MiningPurchase");
const Transaction = require("../models/Transaction");

// ---------------------------------------------------------
// GET /api/dashboard/summary/:userId
// FIXED — USE SAME LOGIC AS MY-MINERS ROUTE
// ---------------------------------------------------------
router.get("/summary/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    // Load user + pending withdrawals in parallel
    const [user, pendingWithdrawals, purchases] = await Promise.all([
      User.findById(userId),
      Withdrawal.countDocuments({ userId, status: "pending" }),
      MiningPurchase.find({ userId }).populate("packageId"),
    ]);

    const today = new Date();
    let activePackages = 0;
    let miningPowerTotal = 0;

    // Loop uses SAME logic as miners.js summary (correct logic)
    for (const purchase of purchases) {
      const pkg = purchase.packageId;
      if (!pkg) continue; // skip if package was deleted

      const purchaseDate = new Date(purchase.purchaseDate);
      const durationDays = Number(pkg.duration) || 0;

      const daysSincePurchase = Math.floor(
        (today - purchaseDate) / (1000 * 60 * 60 * 24)
      );

      const remainingDays = Math.max(0, durationDays - daysSincePurchase);

      // TRUE ACTIVE miner = has not expired + isActive flag still true
      const isActiveMiner = purchase.isActive && remainingDays > 0;

      if (isActiveMiner) {
        activePackages += 1;
        miningPowerTotal += Number(pkg.miningPower || 0);
      }
    }

    res.json({
      usdBalance: user?.balanceUSD || 0,
      miningPower: miningPowerTotal,       // CORRECTED
      pendingWithdrawals: pendingWithdrawals || 0,
      bmtBalance: user?.bmtBalance || 0,
      activePackages: activePackages,      // CORRECTED
    });

  } catch (err) {
    console.error("❌ Error loading dashboard summary:", err);
    res.status(500).json({ error: "Failed to load dashboard summary" });
  }
});

// ---------------------------------------------------------
// GET /api/dashboard/earnings/:userId (UNCHANGED)
// ---------------------------------------------------------
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

    // 7-day earnings chart
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
