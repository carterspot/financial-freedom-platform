# Investment Module v1.0 — Scope Document
**Author:** CTO  
**Date:** 2026-04-07  
**Status:** DRAFT — awaiting Carter review  

---

## What It Is

A taxable investment tracker. The user enters their brokerage positions manually — ticker, shares, cost basis — and the module calculates unrealized gains/losses, tracks dividends, and gives an AI portfolio analysis. No live price feeds at v1; prices are entered manually or on-demand.

This is **not** the retirement module. Retirement covers tax-advantaged accounts (401k, IRA, etc.). Investment covers taxable brokerage, individual stocks, ETFs, and mutual funds.

---

## V1 Scope Boundary

### In v1
- **Account types:** Taxable brokerage, individual stocks, ETFs, mutual funds
- **Position tracking:** ticker/name, shares held, average cost basis, current price (manual entry), current value, unrealized gain/loss ($  and %)
- **Dividend tracking:** log dividends per position; running dividend total per year
- **Portfolio summary:** total invested, current value, total unrealized gain/loss, top gainers/losers
- **Allocation view:** % of portfolio by position (pie-style SVG chart)
- **AI tab:** portfolio analysis — concentration risk, allocation feedback, top recommendations
- **Backup/restore:** JSON + CSV (standard platform pattern)
- **Shared key:** `ffp_investments_{profileId}` — written by Investment, read by AI Advisor (future)

### Not in v1
- No live price feeds (no API calls to market data services)
- No crypto (Investment v2 candidate)
- No options, bonds, or fixed income
- No tax-loss harvesting calculations
- No dividend reinvestment (DRIP) modeling
- No performance vs. benchmark comparison
- No portfolio rebalancing tool

---

## Data Model

### Account schema
```json
{
  "id": "inv_acct_abc123",
  "name": "Fidelity Brokerage",
  "type": "brokerage",
  "color": "#6366f1",
  "notes": ""
}
```
`type` values: `"brokerage" | "individual" | "etf" | "mutual"`

### Position schema
```json
{
  "id": "inv_pos_abc123",
  "accountId": "inv_acct_abc123",
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "assetType": "stock",
  "shares": "10",
  "avgCostBasis": "150.00",
  "currentPrice": "185.00",
  "currentValue": 1850.00,
  "unrealizedGain": 350.00,
  "unrealizedGainPct": 23.33,
  "notes": "",
  "lastPriceUpdate": "2026-04-07T00:00:00.000Z"
}
```
`assetType` values: `"stock" | "etf" | "mutual_fund"`

### Dividend log schema
```json
{
  "id": "inv_div_abc123",
  "positionId": "inv_pos_abc123",
  "date": "2026-03-15",
  "amount": 42.50,
  "notes": ""
}
```

---

## Storage Keys

```
inv_accounts_{profileId}   (shared) — array of account objects
inv_positions_{profileId}  (shared) — array of position objects
inv_dividends_{profileId}  (shared) — array of dividend log entries
inv_ai_results_{profileId} (shared) — saved AI analysis
inv_dark                   (local)  — dark mode boolean
ffp_investments_{profileId}(shared) — summary key: { totalInvested, currentValue, unrealizedGain, positionCount, calculatedOn }
                                       Written by Investment, read by AI Advisor
cc_profiles                (shared) — SHARED across all modules
cc_active_profile          (shared) — SHARED across all modules
cc_apikey                  (shared) — SHARED across all modules
```

---

## Tab Structure (3 tabs)

**Tab 1 — Overview**
- Portfolio summary stat cards: Total Invested · Current Value · Unrealized Gain/Loss · Annual Dividends
- Allocation donut chart (SVG) — % by position, top 8 labeled
- Top gainers / top losers table (top 3 each)
- Accounts list with per-account totals

**Tab 2 — Positions**
- Per-account expandable sections
- Position rows: ticker + name, shares, avg cost, current price (editable inline), current value, gain/loss $ and %
- "Update Price" inline — user types new price, value/gain recalculates immediately
- Add Position form, Edit, Delete
- Dividend log button per position → opens dividend history modal + log form

**Tab 3 — AI Analysis**
- "Analyze My Portfolio" button
- Sends: all positions with values/gains, allocation %, total portfolio value, annual dividend total
- Also sends `ffp_baseline_` if available (spending floor context)
- Returns: concentration risks, diversification gaps, top 3 actionable recommendations
- Standard callClaude pattern

---

## AI Prompt Context

```
Portfolio summary:
- Total invested: $X
- Current value: $X
- Unrealized gain/loss: $X (X%)
- Annual dividends: $X
- Positions: [ticker, shares, value, gain%] for each

Allocation: [ticker: X%] for each

[If ffp_baseline_ exists]:
Monthly spending baseline: $X — context for how much liquidity user needs outside of investments
```

---

## Accent Color

**Blue — `#3b82f6`** (distinct from indigo/emerald/amber already used by other modules)

---

## Cross-Module Key

`ffp_investments_{profileId}` — written on every recalc, read by AI Advisor:
```json
{
  "totalInvested": 25000,
  "currentValue": 31500,
  "unrealizedGain": 6500,
  "positionCount": 8,
  "calculatedOn": "2026-04-07T00:00:00.000Z"
}
```

---

## Open Questions for Carter

1. **Price updates** — Should there be a "Last updated X days ago" staleness indicator on positions with old prices? Or keep it simple — no staleness tracking at v1?
2. **Multiple accounts** — Should the Positions tab default to "All Accounts" combined view, or always show account-by-account? 
3. **Dividend frequency** — Do we need a dividend schedule (quarterly/annual) per position, or just a log of actual payments received?
4. **Module color** — Blue (`#3b82f6`) or something else?

---

## Build Prompt

Once scope is approved, build prompt goes to `docs/build-prompts/investment-v1.0-prompt.md`.  
Storage prefix: `inv_`  
Artifact: `modules/investment.jsx`  
Deploy to: `docs/investment/`  
Base URL: `/financial-freedom-platform/investment/`
