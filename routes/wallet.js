const express = require("express");
const router = express.Router();
const User = require("../models/User");

// GET wallet balance
router.get("/balance/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ btcBalance: user.btcBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
