const state = {
  tab: "portfolio",
  lastUpdated: null,
  priceErrors: {},
  holdings: [
    { id: "1", symbol: "BTC", type: "Crypto", entry: 42000, current: 46500, qty: 0.35 },
    { id: "2", symbol: "AAPL", type: "Stock", entry: 168, current: 185, qty: 18 },
    { id: "3", symbol: "XAU", type: "Metal", entry: 1995, current: 2038, qty: 1.4 },
    { id: "4", symbol: "ETH", type: "Crypto", entry: 2200, current: 2450, qty: 2.1 },
  ],
};

const marketCards = [
  { label: "S&P 500", value: "5,120.42", change: "+0.84%" },
  { label: "VIX", value: "13.7", change: "-4.1%" },
  { label: "Fear & Greed", value: "68", change: "Greed" },
  { label: "DXY", value: "104.2", change: "+0.18%" },
  { label: "BTC Dominance", value: "52.4%", change: "+0.6%" },
  { label: "10Y Yield", value: "4.08%", change: "+3 bps" },
];

const sectors = [
  { label: "Tech Momentum", score: 82 },
  { label: "Energy Cycles", score: 61 },
  { label: "Defensives", score: 47 },
  { label: "Risk Appetite", score: 71 },
];

const chartTitles = ["S&P 500 Trend", "Nasdaq Momentum", "Commodity Pulse"];

const assetSuggestions = [
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "ADA",
  "BNB",
  "DOGE",
  "LTC",
  "AVAX",
  "MATIC",
  "LINK",
  "DOT",
  "ATOM",
  "SHIB",
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "SPY",
  "QQQ",
  "DIA",
  "IWM",
  "GLD",
  "SLV",
  "XAU",
  "XAG",
  "XPT",
  "XPD",
  "EURUSD",
  "USDJPY",
  "GBPUSD",
  "AUDUSD",
  "USDCAD",
  "USDCHF",
  "NZDUSD",
];

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const holdingsList = document.getElementById("holdings-list");
const allocationList = document.getElementById("allocation-list");
const pnlList = document.getElementById("pnl-list");
const totalCostEl = document.getElementById("total-cost");
const totalValueEl = document.getElementById("total-value");
const totalPnlEl = document.getElementById("total-pnl");
const totalPnlPctEl = document.getElementById("total-pnl-pct");
const addAssetBtn = document.getElementById("add-asset");
const refreshBtn = document.getElementById("refresh-prices");
const priceStatusEl = document.getElementById("price-status");
const assetDatalist = document.getElementById("asset-symbols");
const introSection = document.getElementById("intro");
const appSection = document.getElementById("app");
const startBtn = document.getElementById("start-btn");
const skipBtn = document.getElementById("skip-btn");

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function calcTotals() {
  const totalCost = state.holdings.reduce((sum, h) => sum + h.entry * h.qty, 0);
  const totalValue = state.holdings.reduce((sum, h) => sum + h.current * h.qty, 0);
  const totalPnl = totalValue - totalCost;
  const pnlPct = totalCost === 0 ? 0 : (totalPnl / totalCost) * 100;
  return { totalCost, totalValue, totalPnl, pnlPct };
}

function calcAllocations() {
  const totalValue = state.holdings.reduce((sum, h) => sum + h.current * h.qty, 0);
  return state.holdings.map((h) => ({
    ...h,
    value: h.current * h.qty,
    pct: totalValue === 0 ? 0 : (h.current * h.qty * 100) / totalValue,
  }));
}

function setTab(nextTab) {
  state.tab = nextTab;
  document.querySelectorAll(".tab").forEach((btn) => {
    const active = btn.dataset.tab === nextTab;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.getElementById("portfolio-view").classList.toggle("is-active", nextTab === "portfolio");
  document.getElementById("analysis-view").classList.toggle("is-active", nextTab === "analysis");
}

function renderHoldings() {
  holdingsList.innerHTML = state.holdings
    .map((h) => {
      const pnl = (h.current - h.entry) * h.qty;
      const pnlPct = h.entry === 0 ? 0 : ((h.current - h.entry) / h.entry) * 100;
      const pnlClass = pnl >= 0 ? "good" : "bad";
      const symbolKey = h.symbol.trim().toUpperCase();
      const error = state.priceErrors[symbolKey] || "";
      const currentLabel = Number.isFinite(h.current) && h.current > 0 ? formatMoney(h.current) : "—";
      return `
        <div class="holding" data-id="${h.id}">
          <div class="holding-grid">
            <div>
              <label>Symbol</label>
              <input type="text" value="${h.symbol}" data-field="symbol" placeholder="BTC" list="asset-symbols" />
            </div>
            <div>
              <label>Type</label>
              <select data-field="type">
                ${["Crypto", "Stock", "Metal", "Forex", "Other"]
                  .map((t) => `<option value="${t}" ${h.type === t ? "selected" : ""}>${t}</option>`)
                  .join("")}
              </select>
            </div>
            <div>
              <label>Entry</label>
              <input type="number" value="${h.entry}" data-field="entry" />
            </div>
            <div>
              <label>Current</label>
              <div class="current-display">
                <span>${currentLabel}</span>
                ${error ? `<small>${error}</small>` : ""}
              </div>
            </div>
            <div>
              <label>Qty</label>
              <input type="number" value="${h.qty}" data-field="qty" />
            </div>
            <button class="pill" data-action="remove">Remove</button>
          </div>
          <div class="holding-footer">
            <div>Value: ${formatMoney(h.current * h.qty)}</div>
            <div class="${pnlClass}">PnL: ${formatMoney(pnl)} (${pnlPct.toFixed(2)}%)</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderSummary() {
  const totals = calcTotals();
  totalCostEl.textContent = formatMoney(totals.totalCost);
  totalValueEl.textContent = formatMoney(totals.totalValue);
  totalPnlEl.textContent = formatMoney(totals.totalPnl);
  totalPnlPctEl.textContent = `${totals.pnlPct.toFixed(2)}%`;
  totalPnlEl.className = totals.totalPnl >= 0 ? "good" : "bad";
  totalPnlPctEl.className = totals.totalPnl >= 0 ? "good" : "bad";
}

function renderAllocations() {
  const allocations = calcAllocations();
  allocationList.innerHTML = allocations
    .map(
      (a) => `
      <div class="signal">
        <span>${a.symbol || "Untitled"} · ${a.type}<em>${a.pct.toFixed(1)}%</em></span>
        <div class="bar"><span style="width: ${Math.min(100, a.pct)}%"></span></div>
      </div>
    `
    )
    .join("");
}

function renderPnlList() {
  const totals = calcTotals();
  const allocations = calcAllocations();
  pnlList.innerHTML = allocations
    .map((a) => {
      const pnl = (a.current - a.entry) * a.qty;
      const width = Math.min(100, Math.abs(pnl) / (totals.totalCost || 1) * 400);
      const barClass = pnl >= 0 ? "bar good" : "bar bad";
      const pnlClass = pnl >= 0 ? "good" : "bad";
      return `
        <div class="holding">
          <div class="holding-footer">
            <div>${a.symbol || "Untitled"}</div>
            <div class="${pnlClass}">${formatMoney(pnl)}</div>
          </div>
          <div class="${barClass}">
            <span style="width: ${width}%"></span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderMarkets() {
  const marketEl = document.getElementById("market-cards");
  marketEl.innerHTML = marketCards
    .map(
      (card) => `
      <div class="metric">
        <span>${card.label}</span>
        <strong>${card.value}</strong>
        <em>${card.change}</em>
      </div>
    `
    )
    .join("");

  const sectorEl = document.getElementById("sector-list");
  sectorEl.innerHTML = sectors
    .map(
      (s) => `
      <div class="signal">
        <span>${s.label}<em>${s.score}/100</em></span>
        <div class="bar"><span style="width: ${s.score}%"></span></div>
      </div>
    `
    )
    .join("");

  const chartEl = document.getElementById("chart-list");
  chartEl.innerHTML = chartTitles
    .map(
      (title) => `
      <div class="chart-card">
        <div>${title}</div>
        <div class="chart-placeholder"></div>
      </div>
    `
    )
    .join("");
}

function render() {
  renderHoldings();
  renderSummary();
  renderAllocations();
  renderPnlList();
  renderMarkets();
}

function renderSuggestions() {
  assetDatalist.innerHTML = assetSuggestions.map((s) => `<option value="${s}"></option>`).join("");
}

function setPriceStatus(text) {
  priceStatusEl.textContent = text;
}

async function fetchPrices() {
  const payload = {
    holdings: state.holdings
      .filter((h) => h.symbol.trim())
      .map((h) => ({ symbol: h.symbol.trim().toUpperCase(), type: h.type })),
  };

  if (payload.holdings.length === 0) {
    setPriceStatus("Prices: add symbols to load");
    return;
  }

  setPriceStatus("Prices: loading...");
  try {
    const res = await fetch("/.netlify/functions/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error("Netlify functions not available");
      }
      throw new Error(`Price API error (${res.status})`);
    }
    const data = await res.json();
    const prices = data.prices || {};
    state.priceErrors = data.errors || {};

    state.holdings = state.holdings.map((h) => {
      const symbol = h.symbol.trim().toUpperCase();
      const price = prices[symbol]?.price;
      return Number.isFinite(price) ? { ...h, current: price } : h;
    });
    state.lastUpdated = data.updatedAt ? new Date(data.updatedAt) : new Date();
    setPriceStatus(`Prices: updated ${state.lastUpdated.toLocaleTimeString()}`);
    render();
  } catch (err) {
    if (String(err.message || "").includes("Netlify functions")) {
      setPriceStatus("Prices: unavailable on Live Server (deploy to Netlify)");
    } else {
      setPriceStatus("Prices: failed to load");
    }
  }
}

function enterApp() {
  if (introSection) introSection.classList.remove("is-active");
  if (appSection) appSection.classList.remove("is-hidden");
}

document.addEventListener("click", (event) => {
  const tabButton = event.target.closest(".tab");
  if (tabButton) {
    setTab(tabButton.dataset.tab);
    return;
  }

  const removeBtn = event.target.closest("[data-action='remove']");
  if (removeBtn) {
    const row = removeBtn.closest("[data-id]");
    state.holdings = state.holdings.filter((h) => h.id !== row.dataset.id);
    render();
  }
});

document.addEventListener("input", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
  const row = input.closest("[data-id]");
  if (!row) return;
  const id = row.dataset.id;
  const field = input.dataset.field;
  if (!field) return;
  const holding = state.holdings.find((h) => h.id === id);
  if (!holding) return;

  if (field === "symbol") {
    holding.symbol = input.value.toUpperCase();
  } else if (field === "type") {
    holding.type = input.value;
  } else if (field === "entry" || field === "qty") {
    holding[field] = Number(input.value);
  }

  renderSummary();
  renderAllocations();
  renderPnlList();
});

if (addAssetBtn) {
  addAssetBtn.addEventListener("click", () => {
    state.holdings.push({
      id: makeId(),
      symbol: "",
      type: "Other",
      entry: 0,
      current: 0,
      qty: 0,
    });
    render();
  });
}

if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    fetchPrices();
  });
}

if (startBtn) startBtn.addEventListener("click", enterApp);
if (skipBtn) skipBtn.addEventListener("click", enterApp);

setTab("portfolio");
renderSuggestions();
render();
fetchPrices();
setInterval(fetchPrices, 5 * 60 * 1000);

if (appSection) {
  appSection.classList.add("is-hidden");
}
