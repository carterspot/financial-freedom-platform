# Investment Module v1.0 — Build Prompt
**File:** `modules/investment.jsx`
**Author:** CTO
**Date:** 2026-04-07

---

## Before You Start

Read in this order:
1. `CLAUDE.md` — JSX rules, storage prefixes, shared keys, pre-ship checklist
2. `docs/design-system.md` — callClaude pattern, useBreakpoint, probe/fallback storage, canonical patterns
3. `docs/project-instruction.md` — platform architecture, DebtTracker section (for expandable card pattern reference)
4. `docs/build-prompts/investment-v1.0-scope.md` — full scope, data model, decisions

---

## Objective

Build `modules/investment.jsx` — a taxable investment tracker with manual position entry, AI-assisted price updates, dividend logging, and AI portfolio analysis. Follow the DebtTracker layout pattern for expandable account cards.

---

## Architecture Overview

- **3 tabs:** Overview · Positions · AI Analysis
- **Accent color:** `#3b82f6` (blue)
- **Storage prefix:** `inv_`
- **Shared keys written:** `ffp_investments_{profileId}` (summary, read by future AI Advisor)
- **Shared keys read:** `cc_profiles`, `cc_active_profile`, `cc_apikey`, `ffp_baseline_{profileId}`

---

## Component Structure (all top-level named functions — no nested JSX-returning functions)

```
InvestmentModule          — root component
OverviewTab               — stat cards + allocation chart + gainers/losers
PositionsTab              — combined summary + expandable account cards
AccountCard               — single expandable account with position rows
PositionRow               — ticker, shares, cost, price, value, gain/loss, staleness
AiAnalysisTab             — AI portfolio analysis
AddAccountModal           — create account
AddPositionModal          — add position to account
EditPositionModal         — edit position
DividendModal             — log + view dividends per position
AiPriceUpdateModal        — review AI-estimated prices before applying
BackupModal               — JSON + CSV export/import
ProfilePanel              — profile switcher (standard platform pattern)
ApiKeyPanel               — API key entry + status dot
ConfirmModal              — generic confirmation (no window.confirm)
```

---

## Change 1 — Module Shell + Storage

Use the standard probe/fallback storage pattern from design-system.md (`storeGet` / `storeSet` with cloud probe + localStorage fallback).

State declarations:
```javascript
const [accounts,    setAccounts]    = useState([]);
const [positions,   setPositions]   = useState([]);
const [dividends,   setDividends]   = useState([]);
const [aiResults,   setAiResults]   = useState(null);
const [baseline,    setBaseline]    = useState(null);
const [profiles,    setProfiles]    = useState([]);
const [activeProfile, setActiveProfile] = useState(null);
const [apiKey,      setApiKey]      = useState("");
const [apiKeyStatus,setApiKeyStatus]= useState("unchecked");
const [darkMode,    setDarkMode]    = useState(() => localStorage.getItem("inv_dark") === "true");
const [tab,         setTab]         = useState("overview");
const [loading,     setLoading]     = useState(true);
```

`init()` loads in this order: apiKey → profiles → activeProfile → accounts → positions → dividends → aiResults → baseline (`ffp_baseline_` shared). Call `recalcSummary()` after all data loads.

`recalcSummary` writes `ffp_investments_{profileId}` to shared storage:
```javascript
async function recalcSummary(accs, pos) {
  if (!activeProfile) return;
  const totalInvested = pos.reduce((s,p) => s + parseFloat(p.avgCostBasis||0)*parseFloat(p.shares||0), 0);
  const currentValue  = pos.reduce((s,p) => s + (parseFloat(p.currentPrice||0)*parseFloat(p.shares||0)), 0);
  const unrealizedGain = currentValue - totalInvested;
  const summary = { totalInvested, currentValue, unrealizedGain, positionCount: pos.length, calculatedOn: new Date().toISOString() };
  await storeSet(`ffp_investments_${activeProfile.id}`, summary, true);
}
```

Call `recalcSummary` after every position save/delete/price update.

---

## Change 2 — Data Helpers

Add these top-level helpers (outside component):

```javascript
const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const fmt$ = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);
const fmtPct = n => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";

function calcPosition(pos) {
  const shares = parseFloat(pos.shares) || 0;
  const cost   = parseFloat(pos.avgCostBasis) || 0;
  const price  = parseFloat(pos.currentPrice) || 0;
  const totalCost  = shares * cost;
  const currentVal = shares * price;
  const gain       = currentVal - totalCost;
  const gainPct    = totalCost > 0 ? (gain / totalCost) * 100 : 0;
  return { ...pos, currentValue: currentVal, unrealizedGain: gain, unrealizedGainPct: gainPct };
}

function daysSince(isoStr) {
  if (!isoStr) return null;
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / 86400000);
}

function staleLabel(isoStr) {
  const d = daysSince(isoStr);
  if (d === null) return "never updated";
  if (d === 0) return "updated today";
  if (d === 1) return "updated yesterday";
  return `updated ${d} days ago`;
}
```

---

## Change 3 — Overview Tab

**Stat cards (4):**
- Total Invested
- Current Value
- Unrealized Gain/Loss (green if positive, red if negative)
- Annual Dividends (sum of all dividend.amount for current year)

**Allocation chart:**
SVG donut chart. Each slice = position's % of current portfolio value. Label top 8 positions by ticker. Center shows total value. Use position's account color or cycle through blue palette shades.

**Top Gainers / Top Losers:**
Two side-by-side tables, top 3 each. Columns: Ticker · Gain % · Gain $. Green for gainers, red for losers.

**Accounts summary list:**
One row per account — name, position count, total value, gain/loss.

---

## Change 4 — Positions Tab (DebtTracker expandable card pattern)

**Combined summary bar at top:**
Total across all accounts: X positions · Invested $X · Value $X · Gain $X (X%)

**Account cards** — one per account, expandable (collapsed by default):

Collapsed state shows:
- Account name + color dot
- Position count
- Total account value
- Total account gain/loss ($ and %)
- Expand chevron ›

Expanded state shows position rows:
```
[Ticker]  [Name]          [Shares]  [Avg Cost]  [Price ▼]  [Value]   [Gain $]  [Gain %]  [Age]
AAPL      Apple Inc.      10        $150.00     $185.00    $1,850    +$350     +23.3%    3d ago  [💰][✏️][🗑]
```
- Price cell is inline-editable — click to edit, Enter to save, recalcs immediately
- `[💰]` opens DividendModal for that position
- `[✏️]` opens EditPositionModal
- `[🗑]` opens ConfirmModal before delete
- Staleness label in `[Age]` column — amber text if >7 days

**Toolbar:**
- `[+ Add Account]`
- `[🤖 Update Prices]` — opens AiPriceUpdateModal
- `[💾 Backup]`

---

## Change 5 — AiPriceUpdateModal

On open: shows loading state, calls Claude with:

```javascript
const systemPrompt = `You are a financial data assistant. Return ONLY a JSON array of price estimates for the given stock tickers. No explanation, no markdown, just the array.
Format: [{"ticker":"AAPL","price":185.50,"note":"as of approx [month year]"}, ...]
If you don't know a ticker's price, return {"ticker":"X","price":null,"note":"unknown"}.`;

const userPrompt = `Provide current price estimates for these tickers:\n${tickers.join(", ")}`;
```

Parse response. Show review table:
```
Ticker   AI Estimate    Current     Apply?
AAPL     $185.50        $150.00     [✓]
GOOGL    $172.20        $160.00     [✓]
UNKNOWN  —              $50.00      [—] (disabled)
```
- All rows checked by default; user can uncheck
- Disclaimer banner: "These are AI estimates based on training data. Prices may not reflect current market values. Verify before making investment decisions."
- `[Apply Selected]` updates checked positions: sets `currentPrice`, `lastPriceUpdate = new Date().toISOString()`, `priceSource = "ai"`, recalcs `currentValue/unrealizedGain/unrealizedGainPct`, calls recalcSummary
- Handle JSON parse errors gracefully: show "Couldn't parse AI response. Try again."

Use standard `callClaude` pattern from design-system.md.

---

## Change 6 — DividendModal

Two-panel modal:
- **Log tab:** date picker + amount + notes → Add button. Saves to `inv_dividends_` array with positionId.
- **History tab:** table of past dividends for this position — date, amount, notes. Delete per row (ConfirmModal).

Annual total shown at bottom of History tab.

---

## Change 7 — AI Analysis Tab

```
[Analyze My Portfolio]
```

On click, build context:
```javascript
const posData = positions.map(p => {
  const c = calcPosition(p);
  return `${p.ticker} (${p.name}): ${p.shares} shares, cost basis ${fmt$(parseFloat(p.avgCostBasis)*parseFloat(p.shares))}, current value ${fmt$(c.currentValue)}, gain ${fmtPct(c.unrealizedGainPct)}`;
}).join("\n");

const allocData = positions.map(p => {
  const val = parseFloat(p.currentPrice||0)*parseFloat(p.shares||0);
  const pct = totalValue > 0 ? (val/totalValue*100).toFixed(1) : "0.0";
  return `${p.ticker}: ${pct}%`;
}).join(", ");

const annualDivs = dividends
  .filter(d => d.date?.startsWith(new Date().getFullYear().toString()))
  .reduce((s,d) => s + (d.amount||0), 0);

const baselineCtx = baseline
  ? `\nMonthly spending baseline (from SpendingTracker): ${fmt$(baseline.amount)} — context for liquidity needs outside investments.`
  : "";

const systemPrompt = `You are a personal investment advisor. Analyze the portfolio and give 3-5 specific, actionable recommendations. Focus on: concentration risk, diversification gaps, and whether the portfolio aligns with long-term wealth building. Be direct. Format as a numbered list.`;

const userPrompt = `Portfolio:\n${posData}\n\nAllocation: ${allocData}\nAnnual dividends: ${fmt$(annualDivs)}${baselineCtx}`;
```

Show results in styled panel. "Re-analyze" button after first run. Save results to `inv_ai_results_{profileId}`.

---

## Change 8 — Backup / Restore

Standard platform pattern (JSON + CSV):
- JSON export: `{ accounts, positions, dividends }` — filename `investment-backup-YYYY-MM.json`
- CSV export: positions only — columns: `id, accountId, ticker, name, assetType, shares, avgCostBasis, currentPrice, lastPriceUpdate, priceSource, notes`
- Import: Replace or Merge modal (same UX as other modules); dedup by `id` on merge

---

## JSX Rules Audit

- [ ] No `return<` — all returns use `return (` or `return <`
- [ ] All JSX-returning functions are top-level named components (list above)
- [ ] No `window.confirm()` or `window.alert()` — ConfirmModal used
- [ ] No streaming — `await res.json()` only
- [ ] No `<form>` tags — `onClick`/`onChange` only
- [ ] SVG only for charts — no external libraries
- [ ] `typeof window !== 'undefined'` guard on any `window.innerWidth` usage in useState

---

## Verification

1. Add an account + 3 positions — Overview tab shows correct totals and allocation chart
2. Edit a price inline — value and gain/loss update immediately
3. Staleness label shows "updated today" after price edit; turns amber text after 7+ days (test by setting `lastPriceUpdate` to an old date in localStorage)
4. AI Update Prices — modal opens, shows review table, Apply updates positions with `priceSource: "ai"`
5. Log a dividend — shows in history, adds to annual total in Overview
6. AI Analysis tab — returns portfolio recommendations referencing specific tickers
7. `ffp_investments_{profileId}` exists in localStorage after load
8. Backup export downloads cleanly; import restores data

---

## Vite Build + Deploy

1. `preview/src/App.jsx` — set import to `../../modules/investment.jsx`
2. `preview/vite.config.js`:
   ```javascript
   base: "/financial-freedom-platform/investment/",
   build: { outDir: "../docs/investment", emptyOutDir: true }
   ```
3. `cd preview && npm run build` — must pass with 0 errors
4. Commit: `modules/investment.jsx` + `docs/investment/` + `preview/vite.config.js` + `preview/src/App.jsx`

---

## Commit Message

```
feat: Investment Module v1.0 — positions, AI price updates, dividend log, portfolio AI analysis
```

---

## Report Back

- Build result (pass/fail, bundle size)
- Whether allocation chart renders with test data
- Whether AI price update modal opens, returns data, and applies correctly
- Whether `ffp_investments_` key is written to localStorage
- Any JSX rule violations caught and fixed
