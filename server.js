require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const adminRoutes = require('./routes/admin');
const app = express();
const walletRoutes = require("./routes/wallet");
const depositRoutes = require("./routes/deposit");
const pendingDepositRoutes = require("./routes/pendingDeposit");
const transactionRoutes = require("./routes/transaction");
const referralRoutes = require('./routes/referral');
const adminReferralRoutes = require('./routes/adminReferral');

// Middleware
app.use(express.json());
app.use(cors());
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
const packageRoutes = require('./routes/package');
app.use('/api/package', packageRoutes);
const miningRoutes = require('./routes/mining');
app.use('/api/mining', miningRoutes);
const withdrawalRoutes = require('./routes/withdrawal');
app.use('/api/withdrawal', withdrawalRoutes);
app.use('/api/admin', adminRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/deposit", depositRoutes);
app.use("/api/transactions", transactionRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/admin/referral', adminReferralRoutes);
app.use("/api/pending-deposit", pendingDepositRoutes);

// Simple test route
app.get('/', (req, res) => {
  res.send('BlockMine Pro Backend Running ✅');
});

// MongoDB connect
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB error:', err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Auto Mining Scheduler — runs daily at 00:00 UTC
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily mining earnings...');

  try {
    const earningRate = parseFloat(process.env.EARNING_RATE_USD_PER_THS);
    const priceRes = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const btcPriceUSD = priceRes.data.bitcoin.usd;

    const users = await User.find();

    for (let user of users) {
      if (user.miningPower > 0) {
        const earningsUSD = user.miningPower * earningRate;
        const earningsBTC = earningsUSD / btcPriceUSD;

        user.balance += earningsBTC;
        await user.save();

        console.log(`User ${user.username} earned ${earningsBTC.toFixed(8)} BTC today.`);
      }
    }

  } catch (err) {
    console.error('Mining job failed:', err);
  }
});
