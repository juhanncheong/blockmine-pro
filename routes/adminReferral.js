const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const MiningPurchase = require("../models/MiningPurchase");

// ✅ Search by Email
router.get("/by-email", async (req, res) => {
  try {
    const rawEmail = req.query.email;
    if (!rawEmail) return res.status(400).json({ message: "Email required" });

    const email = rawEmail.trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const invitedUsers = await User.find({ referralCode: user.ownReferralCode }).select("email createdAt");
    const referralCount = invitedUsers.length;

    // ✅ Read commissions directly from Transaction log (SAFE & ACCURATE)
    const transactions = await Transaction.find({
      userId: user._id,
      type: "referral-commission"
    }).select("amount createdAt");

    let totalReferralCommission = 0;
    for (const tx of transactions) {
      totalReferralCommission += parseFloat(tx.amount);
    }

    res.json({
      email: user.email,
      ownReferralCode: user.ownReferralCode,
      referralCount,
      invitedUsers,
      totalReferralCommission: totalReferralCommission.toFixed(8),
      transactions
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Search by Referral Code
router.get("/by-code", async (req, res) => {
  try {
    const code = req.query.code;
    const user = await User.findOne({ ownReferralCode: code });
    if (!user) return res.status(404).json({ message: "Referral code not found" });

    const invitedUsers = await User.find({ referralCode: user.ownReferralCode }).select("email createdAt");
    const referralCount = invitedUsers.length;

    // ✅ Read commissions directly from Transaction log (SAFE & ACCURATE)
    const transactions = await Transaction.find({
      userId: user._id,
      type: "referral-commission"
    }).select("amount createdAt");

    let totalReferralCommission = 0;
    for (const tx of transactions) {
      totalReferralCommission += parseFloat(tx.amount);
    }

    res.json({
      email: user.email,
      ownReferralCode: user.ownReferralCode,
      referralCount,
      invitedUsers,
      totalReferralCommission: totalReferralCommission.toFixed(8),
      transactions
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
