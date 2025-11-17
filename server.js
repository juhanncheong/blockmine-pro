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
const adminPendingDepositRoutes = require("./routes/adminPendingDeposit");
const transactionRoutes = require("./routes/transaction");
const referralRoutes = require('./routes/referral');
const adminReferralRoutes = require('./routes/adminReferral');
const adminStatsRoutes = require("./routes/adminStats");
const dashboardRoutes = require("./routes/dashboard");
const minersRoutes = require("./routes/miners");
const bmtRoutes = require('./routes/bmt');
const swapRoute = require("./routes/swap");
const stakeRoute = require("./routes/stake");
const priceRoutes = require("./routes/price");
const { runDailyEarnings, ensureDailyEarningsUpToDate } = require('./utils/miningJobs');
const adminBMTSales = require("./routes/adminBMTSales");
const newsRoutes = require("./routes/news");
const adminNewsRoutes = require("./routes/adminNews");

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
app.use('/api/admin/referral', require('./routes/adminReferral'));
app.use("/api/admin/pending-deposits", adminPendingDepositRoutes);
app.use("/api/admin/stats", adminStatsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/miners", minersRoutes);
app.use('/api/settings', require('./routes/settings'));
app.use('/api', bmtRoutes);
app.use("/api", swapRoute);
app.use(stakeRoute);
app.use("/api/price", priceRoutes);
app.use("/api/admin", adminBMTSales);
app.use("/api/news", newsRoutes);
app.use("/api/admin/news", adminNewsRoutes);

// Simple test route
app.get('/', (req, res) => {
  res.send('BlockMine Pro Backend Running ✅');
});

// MongoDB connect
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('MongoDB connected');
})
.catch(err => console.error('MongoDB error:', err));


// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
