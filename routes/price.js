const express = require("express");
const axios = require("axios");
const router = express.Router();

let cache = { price: null, ts: 0 };
const CACHE_MS = 60_000; // 1 minute

async function getBTC() {
  const now = Date.now();
  if (cache.price && now - cache.ts < CACHE_MS) return cache.price;

  // Try Binance → fallback CoinGecko → final static
  try {
    const r = await axios.get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT");
    cache = { price: parseFloat(r.data.price), ts: now };
  } catch {
    try {
      const cg = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
      cache = { price: Number(cg.data.bitcoin.usd), ts: now };
    } catch {
      cache = { price: 65000, ts: now }; // safe static fallback
    }
  }
  return cache.price;
}

router.get("/btc", async (_req, res) => {
  try {
    const price = await getBTC();
    res.json({ price });
  } catch {
    res.status(200).json({ price: 65000 });
  }
});

module.exports = router;
