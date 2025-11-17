const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Deposit = require("../models/Deposit");
const Transaction = require("../models/Transaction");

// ✅ POST /admin/manual-deposit
router.post("/", async (req, res) => {
  try {
    const { userId, amountUSD, note, depositType } = req.body;

    if (!userId || !amountUSD || amountUSD <= 0) {
      return res.status(400).json({ message: "Invalid input" });
    }

    // ✅ Normalize deposit type (default: normal)
    //    depositType can be "normal" or "bonus"
    const type = depositType === "bonus" ? "bonus" : "normal";

    // ✅ Find user first
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ If this is a welcome bonus, enforce one-time rule
    if (type === "bonus" && user.welcomeBonusRedeemed) {
      return res.status(400).json({
        message: "Welcome bonus already redeemed for this user."
      });
    }

    // ✅ Create USD deposit record (we can also tag the source type)
    const deposit = new Deposit({
      userId,
      coin: "USD",
      amountUSD,
      expectedCoinAmount: 0,
      quoteRate: 1,
      status: "approved",
      source: type === "bonus" ? "admin_bonus" : "admin",
      createdAt: new Date()
    });

    await deposit.save();

    // ✅ Update user's balances
    if (type === "bonus") {
      user.bonusBalanceUSD = (user.bonusBalanceUSD || 0) + Number(amountUSD);
      user.welcomeBonusRedeemed = true; // mark that they used their one-time welcome bonus
    } else {
      // normal manual deposit
      user.balanceUSD = (user.balanceUSD || 0) + Number(amountUSD);
    }

    await user.save();

    // ✅ Record transaction
    await Transaction.create({
      userId,
      type: type === "bonus" ? "bonusDeposit" : "deposit",
      amountUSD: +Number(amountUSD),
      note:
        note ||
        (type === "bonus"
          ? "Admin bonus credit"
          : "Admin manual deposit")
    });

    console.log(
      `✅ Manual ${type === "bonus" ? "BONUS" : "NORMAL"} deposit: +$${amountUSD} USD for user ${
        user.email
      }`
    );
    res.json({
      message:
        type === "bonus"
          ? "Bonus USD credited successfully"
          : "Manual USD deposit added successfully"
    });
  } catch (err) {
    console.error("❌ Manual deposit failed:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
