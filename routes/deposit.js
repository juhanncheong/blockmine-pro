const express = require("express");
const router = express.Router();
const Deposit = require("../models/Deposit");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

// ✅ Admin GET deposits list (search by email)
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

    const deposits = await Deposit.find(filter)
      .populate("userId", "username email")
      .sort({ createdAt: -1 });

    res.json(deposits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Admin POST add deposit (deposit + balance + transaction record)
router.post("/admin/deposit", async (req, res) => {
  try {
    const { userId, amount } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Save deposit record
    const newDeposit = new Deposit({
      userId: user._id,
      amount: parseFloat(amount),
    });
    await newDeposit.save();

    // Update user balance
    user.balance += parseFloat(amount);
    await user.save();

    // Create transaction record (this allows wallet.html to see deposit history)
    const newTransaction = new Transaction({
      userId: user._id,
      type: "deposit",
      amount: parseFloat(amount),
    });
    await newTransaction.save();

    res.json({ message: "Deposit added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// User submits deposit request (from frontend step 2)
router.post("/", async (req, res) => {
  try {
    const { userId, coin, amountUSD, sendCoinAmount, creditBTC } = req.body;

    if (!userId || !coin || !amountUSD || !sendCoinAmount || !creditBTC) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const newDeposit = new Deposit({
      userId,
      coin,
      amountUSD,
      sendCoinAmount,
      creditBTC,
      status: "pending"
    });

    await newDeposit.save();

    res.json({ message: "Deposit request submitted" });
  } catch (err) {
    console.error("Error submitting deposit:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/approve", async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) {
      return res.status(404).json({ message: "Deposit not found" });
    }

    if (deposit.status !== "pending") {
      return res.status(400).json({ message: "Deposit already processed" });
    }

    // ✅ Update deposit status
    deposit.status = "approved";
    await deposit.save();

    // ✅ Credit user balance
    await User.findByIdAndUpdate(deposit.userId, {
      $inc: { balance: deposit.creditBTC }
    });

    res.json({ message: "Deposit approved and credited" });
  } catch (err) {
    console.error("Approve deposit error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/reject", async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) {
      return res.status(404).json({ message: "Deposit not found" });
    }

    if (deposit.status !== "pending") {
      return res.status(400).json({ message: "Deposit already processed" });
    }

    // ✅ Update status only, no balance change
    deposit.status = "rejected";
    await deposit.save();

    res.json({ message: "Deposit rejected" });
  } catch (err) {
    console.error("Reject deposit error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/admin/pending", async (req, res) => {
  try {
    const pendingDeposits = await Deposit.find({ status: "pending" }).populate("userId");
    res.json(pendingDeposits);
  } catch (err) {
    console.error("Failed to fetch pending deposits:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// User Deposit History
router.get("/history/:userId", async (req, res) => {
  try {
    const deposits = await Deposit.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(deposits);
  } catch (err) {
    console.error("Failed to fetch deposit history:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin Manual Deposit creation
router.post('/admin/deposit', async (req, res) => {
  const { userId, amount } = req.body;

  if (!userId || !amount) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const deposit = new Deposit({
      userId,
      amountUSD: amount * (await getBTCPrice()),  // convert to USD based on BTC price
      creditBTC: amount,  // direct BTC amount admin enters
      status: 'approved',
      createdAt: new Date()
    });

    await deposit.save();

    // ✅ Directly update user balance:
    await User.findByIdAndUpdate(userId, { $inc: { balance: amount } });

    res.json({ message: "Deposit added successfully" });
  } catch (err) {
    console.error("Failed to add manual deposit:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ User Cancel Deposit Route
router.post("/cancel/:id", async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit || deposit.status !== "pending") {
      return res.status(400).json({ message: "Cannot cancel deposit" });
    }
    deposit.status = "rejected"; // Mark as failed after cancel
    await deposit.save();
    res.json({ message: "Deposit canceled" });
  } catch (err) {
    console.error("Failed to cancel deposit", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
