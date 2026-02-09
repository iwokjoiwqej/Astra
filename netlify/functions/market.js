const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();
let lastGoodPayload = null;

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { ts: Date.now(), data });
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify(body),
  };
}

async function fetchSpySeries() {
  const cached = getCache("spy");
  if (cached) return cached;

  const apiKey = process.env.ALPHAVANTAGE_KEY;
  if (!apiKey) throw new Error("Missing ALPHAVANTAGE_KEY");

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=SPY&outputsize=compact&apikey=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.Note) {
    throw new Error("Alpha Vantage rate limit");
  }
  const series = data["Time Series (Daily)"] || {};
  const points = Object.entries(series)
    .map(([date, ohlc]) => ({
      time: date,
      value: Number(ohlc["4. close"]),
    }))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => (a.time > b.time ? 1 : -1));

  setCache("spy", points);
  return points;
}

async function fetchBtcSeries() {
  const cached = getCache("btc");
  if (cached) return cached;

  const apiKey = process.env.COINGECKO_DEMO_KEY;
  if (!apiKey) throw new Error("Missing COINGECKO_DEMO_KEY");

  const url = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=90";
  const res = await fetch(url, {
    headers: { "x-cg-demo-api-key": apiKey },
  });
  const data = await res.json();
  const points = (data.prices || [])
    .map(([ts, price]) => ({
      time: Math.floor(ts / 1000),
      value: Number(price),
    }))
    .filter((p) => Number.isFinite(p.value));

  setCache("btc", points);
  return points;
}

export async function handler() {
  try {
    const [spy, btc] = await Promise.all([fetchSpySeries(), fetchBtcSeries()]);
    lastGoodPayload = { spy, btc, stale: false, updatedAt: new Date().toISOString() };
    return json(200, lastGoodPayload);
  } catch (err) {
    if (lastGoodPayload) {
      return json(200, { ...lastGoodPayload, stale: true, error: "Using cached data" });
    }
    return json(200, { spy: [], btc: [], stale: true, error: "Market data unavailable" });
  }
}
