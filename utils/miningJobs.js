// utils/miningJobs.js
require('dotenv').config();
const axios = require('axios');
const GlobalSettings = require('../models/GlobalSettings');

// If you ever change your backend URL, set CRON_BASE_URL or BACKEND_URL in env
const BASE_URL =
  process.env.CRON_BASE_URL ||
  process.env.BACKEND_URL ||
  'https://blockmine-pro.onrender.com';

// Helper: number of whole days between two dates (based on local TZ = America/New_York)
function wholeDaysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  const d1 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const d2 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((d2 - d1) / MS);
}

/**
 * runDailyEarnings
 * - Calls your existing mining routes:
 *   - POST /api/mining/run-daily-earnings   (credits USD based on TH/s)
 *   - POST /api/mining/cleanup-expired      (handles package expiry + principal refunds)
 */
async function runDailyEarnings() {
  console.log('[miningJobs] Running one daily earnings cycle via API...');

  // 1) credit daily USD earnings
  await axios.post(`${BASE_URL}/api/mining/run-daily-earnings`);

  // 2) clean up expired packages & principal refunds
  try {
    await axios.post(`${BASE_URL}/api/mining/cleanup-expired`);
  } catch (err) {
    // not critical if this fails; just log
    console.error('[miningJobs] cleanup-expired failed:', err.message || err);
  }

  console.log('[miningJobs] Daily earnings cycle finished.');
}

/**
 * ensureDailyEarningsUpToDate
 *
 * Idea:
 * - We store lastMiningEarningsAt in GlobalSettings.
 * - Each time this runs, we compare "today" vs that date.
 * - If we missed N days (e.g. Render slept), we call runDailyEarnings() N times.
 *
 * TZ is handled by setting TZ=America/New_York in your Render env, so
 * new Date() is already Eastern time.
 */
async function ensureDailyEarningsUpToDate() {
  const now = new Date();

  let settings = await GlobalSettings.findOne();
  if (!settings) {
    settings = new GlobalSettings();
  }

  // First time ever: just initialise marker to today and exit (no retro-credit)
  if (!settings.lastMiningEarningsAt) {
    settings.lastMiningEarningsAt = now;
    await settings.save();
    console.log('[miningJobs] Initialized lastMiningEarningsAt');
    return;
  }

  const daysMissed = wholeDaysBetween(settings.lastMiningEarningsAt, now);
  if (daysMissed <= 0) {
    // up to date
    return;
  }

  console.log(`[miningJobs] Catch-up needed: ${daysMissed} day(s) of earnings.`);

  for (let i = 0; i < daysMissed; i++) {
    try {
      await runDailyEarnings();
    } catch (err) {
      console.error('[miningJobs] runDailyEarnings failed during catch-up:', err.message || err);
      // if one day fails, stop to avoid infinite spam; next user hit will retry
      break;
    }
  }

  settings.lastMiningEarningsAt = now;
  await settings.save();
  console.log('[miningJobs] Catch-up complete, lastMiningEarningsAt updated.');
}

module.exports = {
  runDailyEarnings,
  ensureDailyEarningsUpToDate,
};
