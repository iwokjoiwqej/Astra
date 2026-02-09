const state = {
  tab: "portfolio",
  lastUpdated: null,
  priceErrors: {},
  priceDisabled: false,
  lastFetchAt: 0,
  lastKnownPrices: {},
  holdings: [
    { id: "1", name: "Bitcoin", symbol: "BTC", type: "Crypto", entry: 42000, current: 46500, qty: 0.35 },
    { id: "2", name: "Apple", symbol: "AAPL", type: "Stock", entry: 168, current: 185, qty: 18 },
    { id: "3", name: "Gold", symbol: "XAU", type: "Metal", entry: 1995, current: 2038, qty: 1.4 },
    { id: "4", name: "Ethereum", symbol: "ETH", type: "Crypto", entry: 2200, current: 2450, qty: 2.1 },
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
const assetModal = document.getElementById("asset-modal");
const assetNameInput = document.getElementById("asset-name");
const assetSymbolInput = document.getElementById("asset-symbol");
const assetTypeInput = document.getElementById("asset-type");
const assetEntryInput = document.getElementById("asset-entry");
const assetQtyInput = document.getElementById("asset-qty");
const assetSaveBtn = document.getElementById("asset-save");
const assetCancelBtn = document.getElementById("asset-cancel");
const assetCloseBtn = document.getElementById("asset-close");
const filterTextInput = document.getElementById("filter-text");
const filterSortInput = document.getElementById("filter-sort");
const marketStatusEl = document.getElementById("market-status");
const chartSpyEl = document.getElementById("chart-spy");
const chartBtcEl = document.getElementById("chart-btc");

let chartsInitialized = false;
let spySeries = null;
let btcSeries = null;

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

function getFilteredHoldings() {
  const query = (filterTextInput?.value || "").trim().toLowerCase();
  const sort = filterSortInput?.value || "name";

  let list = [...state.holdings];
  if (query) {
    list = list.filter((h) => {
      const name = (h.name || "").toLowerCase();
      const symbol = (h.symbol || "").toLowerCase();
      return name.includes(query) || symbol.includes(query);
    });
  }

  if (sort === "pnl") {
    list.sort((a, b) => (b.current - b.entry) * b.qty - (a.current - a.entry) * a.qty);
  } else if (sort === "value") {
    list.sort((a, b) => b.current * b.qty - a.current * a.qty);
  } else {
    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }

  return list;
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
  const list = getFilteredHoldings();
  holdingsList.innerHTML = list
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
              <label>Asset</label>
              <div class="current-display">
                <span>${h.name || "Untitled"} · ${h.symbol}</span>
              </div>
            </div>
            <div>
              <label>Type</label>
              <div class="current-display">
                <span>${h.type || "Other"}</span>
              </div>
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

  // Chart placeholders are now real charts.
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

function loadCachedPrices() {
  try {
    const cached = JSON.parse(localStorage.getItem("astra_prices") || "{}");
    if (cached && typeof cached === "object") {
      state.lastKnownPrices = cached;
      state.holdings = state.holdings.map((h) => {
        const symbol = h.symbol.trim().toUpperCase();
        const price = cached[symbol];
        return Number.isFinite(price) ? { ...h, current: price } : h;
      });
    }
  } catch {
    state.lastKnownPrices = {};
  }
}

function saveCachedPrices() {
  try {
    localStorage.setItem("astra_prices", JSON.stringify(state.lastKnownPrices));
  } catch {
    // ignore storage errors
  }
}
function setMarketStatus(text) {
  if (marketStatusEl) marketStatusEl.textContent = text;
}

function initCharts() {
  if (chartsInitialized) return;
  if (!window.LightweightCharts || !chartSpyEl || !chartBtcEl) return;

  const chartOptions = {
    layout: {
      background: { color: "transparent" },
      textColor: "#f3efe3",
    },
    grid: {
      vertLines: { color: "rgba(180, 150, 60, 0.08)" },
      horzLines: { color: "rgba(180, 150, 60, 0.08)" },
    },
    rightPriceScale: { borderColor: "rgba(180, 150, 60, 0.2)" },
    timeScale: { borderColor: "rgba(180, 150, 60, 0.2)" },
  };

  const spyChart = window.LightweightCharts.createChart(chartSpyEl, chartOptions);
  spySeries = spyChart.addLineSeries({ color: "#c7a342", lineWidth: 2 });

  const btcChart = window.LightweightCharts.createChart(chartBtcEl, chartOptions);
  btcSeries = btcChart.addLineSeries({ color: "#e6cd77", lineWidth: 2 });

  chartsInitialized = true;
}

async function fetchMarketCharts() {
  if (!chartsInitialized) initCharts();
  if (!spySeries || !btcSeries) return;

  setMarketStatus("Market data: loading...");
  try {
    const res = await fetch("/.netlify/functions/market");
    const data = await res.json();

    if (Array.isArray(data.spy)) {
      spySeries.setData(data.spy);
    }
    if (Array.isArray(data.btc)) {
      btcSeries.setData(data.btc);
    }
    if (data.stale) {
      setMarketStatus("Market data: stale (cached)");
    } else {
      setMarketStatus("Market data: updated");
    }
  } catch (err) {
    setMarketStatus("Market data: unavailable (using cached)");
  }
}

async function fetchPrices() {
  if (state.priceDisabled) return;
  const now = Date.now();
  if (now - state.lastFetchAt < 60 * 1000) return;
  state.lastFetchAt = now;

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
      if (Number.isFinite(price)) {
        state.lastKnownPrices[symbol] = price;
        return { ...h, current: price };
      }
      const fallback = state.lastKnownPrices[symbol];
      return Number.isFinite(fallback) ? { ...h, current: fallback } : h;
    });
    saveCachedPrices();
    state.lastUpdated = data.updatedAt ? new Date(data.updatedAt) : new Date();
    const errorCount = Object.keys(state.priceErrors).length;
    if (errorCount > 0) {
      setPriceStatus("Prices: updated (fallback used)");
    } else {
      setPriceStatus(`Prices: updated ${state.lastUpdated.toLocaleTimeString()}`);
    }
    render();
  } catch (err) {
    if (String(err.message || "").includes("Netlify functions")) {
      setPriceStatus("Prices: unavailable on Live Server (deploy to Netlify)");
      state.priceDisabled = true;
    } else {
      setPriceStatus("Prices: failed to load (using last known)");
    }
    state.holdings = state.holdings.map((h) => {
      const symbol = h.symbol.trim().toUpperCase();
      const fallback = state.lastKnownPrices[symbol];
      return Number.isFinite(fallback) ? { ...h, current: fallback } : h;
    });
    render();
  }
}

function enterApp() {
  if (introSection) introSection.classList.remove("is-active");
  if (appSection) appSection.classList.remove("is-hidden");
  fetchMarketCharts();
}

function openAssetModal() {
  if (!assetModal) return;
  assetModal.classList.add("is-open");
  assetModal.setAttribute("aria-hidden", "false");
  if (assetNameInput) assetNameInput.value = "";
  if (assetSymbolInput) assetSymbolInput.value = "";
  if (assetEntryInput) assetEntryInput.value = "";
  if (assetQtyInput) assetQtyInput.value = "";
  if (assetTypeInput) assetTypeInput.value = "Crypto";
  if (assetNameInput) assetNameInput.focus();
}

function closeAssetModal() {
  if (!assetModal) return;
  assetModal.classList.remove("is-open");
  assetModal.setAttribute("aria-hidden", "true");
}

document.addEventListener("click", (event) => {
  const tabButton = event.target.closest(".tab");
  if (tabButton) {
    setTab(tabButton.dataset.tab);
    return;
  }

  const addBtn = event.target.closest("#add-asset");
  if (addBtn) {
    openAssetModal();
    return;
  }

  const removeBtn = event.target.closest("[data-action='remove']");
  if (removeBtn) {
    const row = removeBtn.closest("[data-id]");
    state.holdings = state.holdings.filter((h) => h.id !== row.dataset.id);
    render();
  }

  if (event.target.closest("[data-modal-close='true']")) {
    closeAssetModal();
  }
});

document.addEventListener("input", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
  if (input.id === "filter-text" || input.id === "filter-sort") {
    render();
    return;
  }
  const row = input.closest("[data-id]");
  if (!row) return;
  const id = row.dataset.id;
  const field = input.dataset.field;
  if (!field) return;
  const holding = state.holdings.find((h) => h.id === id);
  if (!holding) return;

  if (field === "entry" || field === "qty") {
    holding[field] = Number(input.value);
  }

  renderSummary();
  renderAllocations();
  renderPnlList();
});

if (addAssetBtn) {
  addAssetBtn.addEventListener("click", openAssetModal);
}

if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    fetchPrices();
  });
}

if (startBtn) startBtn.addEventListener("click", enterApp);
if (skipBtn) skipBtn.addEventListener("click", enterApp);

if (assetCancelBtn) assetCancelBtn.addEventListener("click", closeAssetModal);
if (assetCloseBtn) assetCloseBtn.addEventListener("click", closeAssetModal);

if (assetSaveBtn) {
  assetSaveBtn.addEventListener("click", () => {
    const name = (assetNameInput?.value || "").trim();
    const symbol = (assetSymbolInput?.value || "").trim().toUpperCase();
    const type = assetTypeInput?.value || "Other";
    const entry = Number(assetEntryInput?.value || 0);
    const qty = Number(assetQtyInput?.value || 0);
    if (!symbol) return;

    state.holdings.push({
      id: makeId(),
      name: name || symbol,
      symbol,
      type,
      entry,
      current: 0,
      qty,
    });
    closeAssetModal();
    render();
    fetchPrices();
  });
}

setTab("portfolio");
renderSuggestions();
loadCachedPrices();
render();
fetchPrices();
setInterval(fetchPrices, 60 * 1000);
setInterval(fetchMarketCharts, 5 * 60 * 1000);

if (appSection) {
  appSection.classList.add("is-hidden");
}
