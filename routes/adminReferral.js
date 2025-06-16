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
    
    // ✅ Fetch commission transactions history
const transactions = await Transaction.find({
  userId: user._id,
  type: "referral-commission"
}).sort({ createdAt: -1 }).select("amount createdAt");

    // ✅ Calculate commissions
    let totalReferralCommission = 0;
    for (const invite of invitedUsers) {
      const purchases = await MiningPurchase.find({ userId: invite._id });
      for (const purchase of purchases) {
        totalReferralCommission += parseFloat((purchase.amountBTC * 0.15).toFixed(8));
      }
    }

    res.json({
  email: user.email,
  ownReferralCode: user.ownReferralCode,
  referralCount,
  invitedUsers,
  totalReferralCommission: totalReferralCommission.toFixed(8),
  transactions  // ✅ full transactions list
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

    // ✅ Calculate commissions
    let totalReferralCommission = 0;
    for (const invite of invitedUsers) {
      const purchases = await MiningPurchase.find({ userId: invite._id });
      for (const purchase of purchases) {
        totalReferralCommission += parseFloat((purchase.amountBTC * 0.15).toFixed(8));
      }
    }

    res.json({
      email: user.email,
      ownReferralCode: user.ownReferralCode,
      referralCount,
      invitedUsers,
      totalReferralCommission: totalReferralCommission.toFixed(8)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
