# SpendingTracker v1.8 — Baseline Monthly Expenses
**File:** `modules/spending.jsx`  
**Author:** CTO  
**Date:** 2026-04-07  

---

## Before You Start

Read in this order:
1. `CLAUDE.md` — JSX rules, storage prefix, shared keys
2. `docs/design-system.md` — callClaude pattern, canonical component patterns
3. `docs/project-instruction.md` — module schemas, platform architecture

---

## Objective

Add a **Baseline Monthly Expenses** feature to SpendingTracker. This calculates the user's minimum cost of living from their actual spending data, displays a breakdown panel in the Overview tab, writes a shared platform key (`ffp_baseline_`) so Savings and Retirement can consume it, and exposes an AI tool to help tag categories as essential vs. discretionary.

**Scope: exactly these changes. Nothing else.**

---

## Change 1 — Add `isEssential` to Category Schema

### 1a. Update DEFAULT_CATEGORIES

Add `isEssential: true/false` to every entry in `DEFAULT_CATEGORIES` using this exact map:

```
Essential = true:
  exp_001  Rent / Mortgage
  exp_002  HOA Fees
  exp_004  Home Insurance
  exp_005  Property Tax
  exp_006  Groceries
  exp_010  Gas / Fuel
  exp_011  Car Payment
  exp_012  Car Insurance
  exp_016  Electric
  exp_017  Water / Sewer
  exp_018  Gas / Heat
  exp_019  Internet
  exp_020  Phone / Mobile
  exp_021  Health Insurance
  exp_022  Doctor / Medical
  exp_023  Pharmacy / Rx
  exp_045  Credit Card Payment
  exp_046  Student Loan
  exp_047  Personal Loan
  exp_048  Childcare / Daycare
  exp_049  School / Tuition
  exp_051  Baby Supplies

Essential = false (all others):
  exp_003  Home Maintenance
  exp_007  Restaurants / Dining
  exp_008  Coffee / Cafes
  exp_009  Alcohol / Bars
  exp_013  Car Maintenance
  exp_014  Parking / Tolls
  exp_015  Public Transit / Rideshare
  exp_024  Dental / Vision
  exp_025  Gym / Fitness
  exp_026  Clothing / Apparel
  exp_027  Hair / Grooming
  exp_028  Personal Care
  exp_029  Education / Books
  exp_030  Streaming Services
  exp_031  Games / Hobbies
  exp_032  Movies / Events
  exp_033  Subscriptions
  exp_034  Amazon / Online
  exp_035  Electronics
  exp_036  Home Goods
  exp_037  Gifts
  exp_038  Charitable Giving
  exp_039  Church / Tithe
  exp_040  Family Support
  exp_041  Emergency Fund
  exp_042  Sinking Fund
  exp_043  Investment / Brokerage
  exp_044  Retirement (401k/IRA)
  exp_050  Kids Activities
  exp_052  Flights
  exp_053  Hotels / Lodging
  exp_054  Vacation / Travel
  exp_055  Business Expense
  exp_056  Software / Tools
  exp_057  Uncategorized
  trn_001  Transfer
  inc_001 through inc_005  (all Income categories — never essential)
```

### 1b. Migration — existing users

In the `init()` function, after loading categories from storage, add a migration pass:

```javascript
// Migrate: backfill isEssential on any category missing the field
const ESSENTIAL_IDS = new Set([
  "exp_001","exp_002","exp_004","exp_005","exp_006",
  "exp_010","exp_011","exp_012","exp_016","exp_017",
  "exp_018","exp_019","exp_020","exp_021","exp_022",
  "exp_023","exp_045","exp_046","exp_047","exp_048",
  "exp_049","exp_051"
]);
let migrated = false;
cats = cats.map(c => {
  if (c.isEssential === undefined) {
    migrated = true;
    return { ...c, isEssential: ESSENTIAL_IDS.has(c.id) };
  }
  return c;
});
if (migrated) await storeSet(`ffp_categories_${profile.id}`, cats, true);
```

Apply the same migration in `handleSwitchProfile` after loading categories.

---

## Change 2 — Baseline Calculation Function

Add this top-level function (outside any component, near the other helper functions like `computeRollingAvg`):

```javascript
function computeBaseline(transactions, categories) {
  // 3-month rolling average of essential-tagged expenses
  const essentialIds = new Set(
    categories.filter(c => c.isEssential).map(c => c.id)
  );
  const now = new Date();
  const months = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }
  // Build per-category totals across those 3 months
  const catTotals = {};
  for (const tx of transactions) {
    if (!tx.date || !tx.categoryId) continue;
    if (!essentialIds.has(tx.categoryId)) continue;
    if (tx.amount >= 0) continue; // expenses only (negative amounts)
    const m = tx.date.slice(0,7);
    if (!months.includes(m)) continue;
    catTotals[tx.categoryId] = (catTotals[tx.categoryId] || 0) + Math.abs(tx.amount);
  }
  // Average each category over 3 months, build breakdown
  const breakdown = [];
  for (const [catId, total] of Object.entries(catTotals)) {
    const cat = categories.find(c => c.id === catId);
    if (!cat) continue;
    breakdown.push({ catId, catName: cat.name, icon: cat.icon, avg: total / 3 });
  }
  breakdown.sort((a, b) => b.avg - a.avg);
  const amount = breakdown.reduce((s, c) => s + c.avg, 0);
  return { amount, breakdown, calculatedOn: new Date().toISOString(), monthsUsed: months };
}
```

---

## Change 3 — Write `ffp_baseline_` on Every Recalculation

Add a `recalcBaseline` callback that runs:
1. On initial load (after transactions and categories are loaded)
2. After any transaction is saved/deleted
3. After any category's `isEssential` flag changes

```javascript
const recalcBaseline = useCallback(async (txns, cats) => {
  if (!activeProfile) return;
  const baseline = computeBaseline(txns, cats);
  await storeSet(`ffp_baseline_${activeProfile.id}`, baseline, true);
}, [activeProfile]);
```

Call it as `recalcBaseline(transactions, categories)` at the appropriate points. The key uses `true` (shared storage) so Savings and Retirement can read it.

---

## Change 4 — Baseline Panel in Overview Tab

In the Overview tab, add a **Baseline Monthly Expenses** panel. Place it after the existing summary stat cards and before the category breakdown chart.

Panel structure:

```
┌─ Baseline Monthly Expenses ──────────────────────────────────────────┐
│  Estimated minimum cost of living · 3-month rolling avg · essential  │
│                                                                       │
│  $X,XXX / mo                    [Edit Essential Tags]  [AI Tag Help] │
│                                                                       │
│  Top essential categories (collapsed list, expandable):              │
│  🏠 Rent / Mortgage    $X,XXX   ████████████████░░░░                 │
│  🛒 Groceries          $XXX     ██████████░░░░░░░░░░                  │
│  ⚡ Electric           $XXX     ████░░░░░░░░░░░░░░░░                  │
│  ... (show top 5, "Show all N" toggle)                               │
└──────────────────────────────────────────────────────────────────────┘
```

**If no essential transactions exist in the past 3 months**, show:
> "No essential expense data in the last 3 months. Add transactions or adjust your essential category tags."

**The number:** large, prominent. Same style as the other stat cards (dark panel, accent color = emerald `#10b981`).

**Progress bars:** each category's bar width = `(avg / totalBaseline) * 100%`, color matches the category's `color` field.

---

## Change 5 — Essential Toggle in Category Manager

In the existing Category Manager (wherever categories are listed/edited), add an **Essential** toggle to each category row.

- Small pill toggle: `Essential` (emerald) / `Discretionary` (slate)
- Toggling calls `saveCategories(updated)` and then `recalcBaseline(transactions, updatedCats)`
- Do NOT add the toggle to Income-section or Transfer categories (filter by `c.section !== "Income" && c.id !== "trn_001"`)

---

## Change 6 — AI Tag Helper

Add an **"AI Tag Help"** button in the Baseline panel header. On click, opens a modal:

**Modal: "AI Essential Category Tagger"**

```
Title: "Let AI review your categories"
Body:  "Claude will look at your category names and suggest which ones
        are essential (minimum cost of living) vs. discretionary.
        You review and confirm before anything changes."

[Analyze My Categories]   [Cancel]
```

On confirm, call Claude with this system + user prompt:

```javascript
const systemPrompt = `You are a personal finance assistant. The user has a list of spending categories. 
Your job is to classify each one as "essential" (minimum cost of living — housing, utilities, food, insurance, 
required debt payments) or "discretionary" (nice-to-have, reducible in a financial emergency).
Return ONLY a JSON array. No explanation. Format: [{"id":"exp_001","essential":true}, ...]`;

const userPrompt = `Classify these spending categories:
${categories
  .filter(c => !c.section.startsWith("Income") && c.id !== "trn_001")
  .map(c => `{"id":"${c.id}","name":"${c.name}","section":"${c.section}"}`)
  .join("\n")}`;
```

Parse the JSON response. Show a **review modal** listing each suggested change:

```
Category                 Current        AI Suggests
─────────────────────────────────────────────────────
Car Maintenance          Discretionary  → Essential
Gym / Fitness            Essential      → Discretionary
...
[Apply All]   [Apply Selected]   [Cancel]
```

On apply: update categories, save, recalcBaseline.

Use the standard `callClaude` pattern from design-system.md. Handle parse errors gracefully — if JSON is malformed, show: "Couldn't parse AI response. Try again."

---

## Change 7 — Storage Key

**New shared key written by SpendingTracker, read by other modules:**

```
ffp_baseline_{profileId}  (shared storage — storeSet with true)
{
  amount: number,           // total baseline $/month
  breakdown: [
    { catId, catName, icon, avg }  // avg = monthly average for that category
  ],
  calculatedOn: ISO string,
  monthsUsed: ["2026-03", "2026-02", "2026-01"]
}
```

---

## JSX Rules Audit (check before committing)

- [ ] No `return<` — all returns use `return (` or `return <`
- [ ] No functions returning JSX defined inside a component — `computeBaseline` is top-level
- [ ] No `window.confirm()` — modal pattern used for all confirmations
- [ ] `callClaude` uses `await res.json()` only, no streaming
- [ ] No `<form>` tags — `onClick`/`onChange` only
- [ ] SVG-only for progress bars (or CSS width — no chart libraries)
- [ ] `typeof window !== 'undefined'` guard on any `window.innerWidth` usage

---

## Verification

1. Open SpendingTracker with 3+ months of transaction data
2. Overview tab shows Baseline panel with a dollar amount
3. Amount is non-zero and matches essential-category transactions
4. Toggle a category to/from Essential → baseline recalculates immediately
5. `ffp_baseline_{profileId}` exists in localStorage after load (check DevTools → Application → Local Storage)
6. AI Tag Help button opens modal, returns suggestions, review modal shows diffs, Apply updates categories

---

## Vite Build + Deploy

After verifying the above:

1. `preview/src/App.jsx` — set import to `../../modules/spending.jsx`
2. `preview/vite.config.js` — set `base: "/financial-freedom-platform/spending/"` and `outDir: "../docs/spending"`
3. `cd preview && npm run build` — must pass with 0 errors
4. Commit: `modules/spending.jsx` + `docs/spending/` + `preview/vite.config.js` + `preview/src/App.jsx`

---

## Commit Message

```
feat: SpendingTracker v1.8 — baseline monthly expenses, essential tagging, ffp_baseline_ key
```

---

## Report Back

When done, report:
- Build result (pass/fail, bundle size)
- Whether the baseline panel renders correctly with your test data
- Any JSX rule violations caught and fixed
- Confirm `ffp_baseline_` key is written to localStorage
