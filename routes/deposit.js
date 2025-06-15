const express = require("express");
const router = express.Router();
const Deposit = require("../models/Deposit");
const User = require("../models/User");

// Get all deposits (with optional email search)
router.get("/admin/list", async (req, res) => {
  const { email } = req.query;

  try {
    let filter = {};
    if (email) {
      const user = await User.findOne({ email });
      if (user) {
        filter.userId = user._id;
      } else {
        return res.json([]);
      }
    }

    const deposits = await Deposit.find(filter).populate("userId", "username email").sort({ createdAt: -1 });
    res.json(deposits);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


router.post("/admin/deposit", async (req, res) => {
  try {
    const { userId, amount } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const newDeposit = new Deposit({
      userId: user._id,
      amount: parseFloat(amount),
    });
    await newDeposit.save();

    user.balance += parseFloat(amount);
    await user.save();

    res.json({ message: "Deposit added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
