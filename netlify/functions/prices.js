const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();

const CRYPTO_ID_MAP = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  BNB: "binancecoin",
  DOGE: "dogecoin",
  LTC: "litecoin",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  POL: "polygon-ecosystem-token",
  LINK: "chainlink",
  DOT: "polkadot",
  ATOM: "cosmos",
  SHIB: "shiba-inu",
};

const METAL_SYMBOLS = new Set(["XAU", "XAG", "XPT", "XPD"]);

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

async function fetchCoinGecko(ids) {
  const cacheKey = `cg:${ids.sort().join(",")}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.COINGECKO_DEMO_KEY;
  if (!apiKey) throw new Error("Missing COINGECKO_DEMO_KEY");

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=usd`;
  const res = await fetch(url, {
    headers: { "x-cg-demo-api-key": apiKey },
  });
  const data = await res.json();
  setCache(cacheKey, data);
  return data;
}

async function fetchAlphaVantage(symbol) {
  const cacheKey = `av:${symbol}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.ALPHAVANTAGE_KEY;
  if (!apiKey) throw new Error("Missing ALPHAVANTAGE_KEY");

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  setCache(cacheKey, data);
  return data;
}

async function fetchMetalPrice(currencies) {
  const cacheKey = `mp:${currencies.sort().join(",")}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.METALPRICE_KEY;
  if (!apiKey) throw new Error("Missing METALPRICE_KEY");

  const url = `https://api.metalpriceapi.com/v1/latest?api_key=${apiKey}&base=USD&currencies=${encodeURIComponent(
    currencies.join(",")
  )}`;
  const res = await fetch(url);
  const data = await res.json();
  setCache(cacheKey, data);
  return data;
}

function parseForexPair(symbol) {
  const cleaned = symbol.replace(/[^A-Z]/g, "");
  if (cleaned.length !== 6) return null;
  return { base: cleaned.slice(0, 3), quote: cleaned.slice(3) };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return json(400, { error: "Invalid JSON" });
  }

  const holdings = Array.isArray(payload.holdings) ? payload.holdings : [];
  const prices = {};
  const errors = {};

  const cryptoIds = [];
  const cryptoSymbolToId = {};
  const stockSymbols = [];
  const metalSymbols = new Set();
  const forexPairs = [];
  const forexCurrencies = new Set();

  for (const h of holdings) {
    const symbol = String(h.symbol || "").trim().toUpperCase();
    const type = String(h.type || "").trim();
    if (!symbol) continue;

    if (type === "Crypto") {
      const id = CRYPTO_ID_MAP[symbol];
      if (!id) {
        errors[symbol] = "Unknown crypto";
        continue;
      }
      cryptoIds.push(id);
      cryptoSymbolToId[symbol] = id;
    } else if (type === "Stock") {
      stockSymbols.push(symbol);
    } else if (type === "Metal") {
      if (!METAL_SYMBOLS.has(symbol)) {
        errors[symbol] = "Unknown metal";
        continue;
      }
      metalSymbols.add(symbol);
    } else if (type === "Forex") {
      const pair = parseForexPair(symbol);
      if (!pair) {
        errors[symbol] = "Invalid FX pair";
        continue;
      }
      forexPairs.push({ symbol, ...pair });
      forexCurrencies.add(pair.base);
      forexCurrencies.add(pair.quote);
    } else {
      errors[symbol] = "Unsupported type";
    }
  }

  try {
    if (cryptoIds.length) {
      const data = await fetchCoinGecko(cryptoIds);
      for (const [symbol, id] of Object.entries(cryptoSymbolToId)) {
        const price = data?.[id]?.usd;
        if (Number.isFinite(price)) {
          prices[symbol] = { price, source: "coingecko" };
        } else if (!errors[symbol]) {
          errors[symbol] = "No crypto price";
        }
      }
    }
  } catch (err) {
    for (const symbol of Object.keys(cryptoSymbolToId)) {
      errors[symbol] = "Crypto API error";
    }
  }

  if (stockSymbols.length) {
    for (const symbol of stockSymbols) {
      try {
        const data = await fetchAlphaVantage(symbol);
        const price = Number(data?.["Global Quote"]?.["05. price"]);
        if (Number.isFinite(price)) {
          prices[symbol] = { price, source: "alphavantage" };
        } else if (data?.Note) {
          errors[symbol] = "Rate limit";
        } else {
          errors[symbol] = "No stock price";
        }
      } catch (err) {
        errors[symbol] = "Stock API error";
      }
    }
  }

  if (metalSymbols.size || forexPairs.length) {
    const currencies = [...metalSymbols, ...forexCurrencies];
    if (currencies.length) {
      try {
        const data = await fetchMetalPrice(currencies);
        const rates = data?.rates || {};

        for (const metal of metalSymbols) {
          const rate = rates[metal];
          if (Number.isFinite(rate) && rate > 0) {
            prices[metal] = { price: 1 / rate, source: "metalpriceapi" };
          } else if (!errors[metal]) {
            errors[metal] = "No metal price";
          }
        }

        for (const pair of forexPairs) {
          const baseRate = rates[pair.base];
          const quoteRate = rates[pair.quote];
          if (Number.isFinite(baseRate) && Number.isFinite(quoteRate) && baseRate > 0) {
            const price = quoteRate / baseRate;
            prices[pair.symbol] = { price, source: "metalpriceapi" };
          } else if (!errors[pair.symbol]) {
            errors[pair.symbol] = "No FX price";
          }
        }
      } catch (err) {
        for (const metal of metalSymbols) {
          errors[metal] = "Metal API error";
        }
        for (const pair of forexPairs) {
          errors[pair.symbol] = "FX API error";
        }
      }
    }
  }

  return json(200, {
    prices,
    errors,
    updatedAt: new Date().toISOString(),
  });
}
