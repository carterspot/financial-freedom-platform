# Dashboard v2.0.1 — Split-Aware Transaction Aggregation (Patch)

## Model: claude-sonnet-4-6
This is a single-file surgical patch on an existing module. Default Sonnet is correct.

---

## Context

SpendingTracker v1.10 (shipped 2026-04-18, commits b217d13 + 3120017) introduced transaction splits. A split parent carries `isSplit: true`, `splits: [...]`, and the sentinel `categoryId: 'cat_split'` (constant `SPLIT_CATEGORY_ID` in `modules/spending.jsx`). The real category allocations live on `tx.splits[].categoryId`.

Inside SpendingTracker itself, the `accumulateTx` helper expands split parents into per-child category totals, so SummaryTab / TrendsTab / computeRollingAvg all produce correct numbers.

**Dashboard v2.0 predates v1.10** and still iterates raw transactions by `tx.categoryId`. Three locations produce incorrect results when any split transaction exists in the profile:

| Line | Function | Bug |
|------|----------|-----|
| L354–362 | `ChartOverBudget` | Split parent appears as `cat_split` with no baseline → `pctOver` calc returns garbage, and a split transaction never lands on the real category where the overage actually happened. |
| L613–619 | Income/spending waterfall (category mode) | Split parent takes a top-5 slot as its own `cat_split` bucket, pushing a real category out. |
| L1489–1499 | Existing `spendingHealth` Freedom Score input | `cat_split` parent counted as an unbudgeted category → drags the ring score down artificially. |

---

## Read First (in order)
1. `CLAUDE.md` — JSX rules (especially rule 2: never define JSX-returning functions inside a component), storage prefixes
2. `docs/project-instruction.md` — Module 5 v1.10 feature section (split schema) and Dashboard section
3. `modules/spending.jsx` — skim the `accumulateTx` helper (around L229–242) to mirror its pattern
4. `modules/dashboard.jsx` — the full file

---

## Surgical Scope

One file: `modules/dashboard.jsx`. Do not touch `modules/spending.jsx` or any other module.

---

## What to Build

### 1. Add a top-level hoisted helper (near the other top-level helpers, above any component)

```js
// ─── Split-aware transaction expander ────────────────────────────────────────
// Mirrors accumulateTx in modules/spending.jsx. A split parent has
// categoryId === 'cat_split' with real category allocations in tx.splits[].
// This flattens a parent into one pseudo-transaction per split child so any
// downstream category aggregation works correctly.
function expandSplitTx(tx) {
  if (tx && tx.isSplit && Array.isArray(tx.splits) && tx.splits.length > 0) {
    return tx.splits.map(s => ({
      ...tx,
      categoryId: s.categoryId,
      amount: tx.amount < 0 ? -Math.abs(s.amount) : Math.abs(s.amount),
      notes: s.notes || tx.notes,
      _fromSplitParentId: tx.id,
    }));
  }
  return [tx];
}
```

Sign convention: preserve the parent's sign on each child. SpendingTracker stores split children as positive amounts; downstream code in Dashboard filters by `tx.amount < 0` (spending) or `tx.amount > 0` (income), so the sign must be copied from the parent. The helper handles that.

The `_fromSplitParentId` field is debug-only and harmless — downstream code ignores it.

---

### 2. Fix `ChartOverBudget` (around L354–362)

Replace the transaction aggregation block:

```js
// BEFORE (around L357–362):
const monthTxns = transactions.filter(tx => tx.date?.startsWith(activeMonth));
const catSpend = {};
monthTxns.forEach(tx => {
  const cat = tx.categoryId || "Uncategorized";
  catSpend[cat] = (catSpend[cat]||0) + (parseFloat(tx.amount)||0);
});

// AFTER:
const monthTxns = transactions
  .filter(tx => tx.date?.startsWith(activeMonth))
  .flatMap(expandSplitTx)
  .filter(tx => tx.categoryId !== 'cat_split');
const catSpend = {};
monthTxns.forEach(tx => {
  const cat = tx.categoryId || "Uncategorized";
  catSpend[cat] = (catSpend[cat]||0) + (parseFloat(tx.amount)||0);
});
```

The defensive `!== 'cat_split'` filter catches any malformed split parent (e.g., `isSplit: true` but empty `splits[]`) that would otherwise slip through with the sentinel categoryId.

---

### 3. Fix the income/spending waterfall category aggregation (around L613–619)

```js
// BEFORE:
const totalSpend  = monthTxns.reduce((s,tx) => s + (parseFloat(tx.amount)||0), 0);
const net         = totalIncome - totalSpend;
const catGroups   = {};
monthTxns.forEach(tx => {
  const cat = tx.categoryId || "Uncategorized";
  catGroups[cat] = (catGroups[cat]||0) + (parseFloat(tx.amount)||0);
});

// AFTER:
const totalSpend  = monthTxns.reduce((s,tx) => s + (parseFloat(tx.amount)||0), 0);
const net         = totalIncome - totalSpend;
const catGroupTxns = monthTxns
  .flatMap(expandSplitTx)
  .filter(tx => tx.categoryId !== 'cat_split');
const catGroups   = {};
catGroupTxns.forEach(tx => {
  const cat = tx.categoryId || "Uncategorized";
  catGroups[cat] = (catGroups[cat]||0) + (parseFloat(tx.amount)||0);
});
```

**Important:** `totalSpend` is computed from the **un-expanded** `monthTxns` — it must stay that way. Expanding a split into children and summing both would double-count, because the parent's total amount is already the sum of the child amounts. Only the per-category groupings get the expansion.

---

### 4. Fix the existing `spendingHealth` calc (around L1489–1499)

```js
// BEFORE:
const activeMonth    = getActiveSpendingMonth(spTransactions);
const thisMonthTxns  = spTransactions.filter(tx => tx.date?.startsWith(activeMonth));
const thisMonthSpend = thisMonthTxns.reduce((s,tx) => s+(parseFloat(tx.amount)||0), 0);
const catSpendMap    = {};
thisMonthTxns.forEach(tx => { const c = tx.categoryId||"unc"; catSpendMap[c] = (catSpendMap[c]||0)+(parseFloat(tx.amount)||0); });

// AFTER:
const activeMonth    = getActiveSpendingMonth(spTransactions);
const thisMonthTxns  = spTransactions.filter(tx => tx.date?.startsWith(activeMonth));
const thisMonthSpend = thisMonthTxns.reduce((s,tx) => s+(parseFloat(tx.amount)||0), 0);
const thisMonthByCat = thisMonthTxns
  .flatMap(expandSplitTx)
  .filter(tx => tx.categoryId !== 'cat_split');
const catSpendMap    = {};
thisMonthByCat.forEach(tx => { const c = tx.categoryId||"unc"; catSpendMap[c] = (catSpendMap[c]||0)+(parseFloat(tx.amount)||0); });
```

Same pattern: `thisMonthSpend` (the aggregate total) stays on `thisMonthTxns` (unexpanded). Only the per-category map uses the expansion.

---

## Bump the Module Version

Update the header version comment in `modules/dashboard.jsx` from `v2.0` to `v2.0.1`.

---

## Vite Deploy

Standard deployment per CLAUDE.md pre-ship checklist:

1. Ensure `preview/src/App.jsx` imports the dashboard module
2. Ensure `preview/vite.config.js` has `base: "/financial-freedom-platform/dashboard/"` and `build.outDir: "../docs/dashboard"`
3. `cd preview && npm run build` — must pass 0 errors, 0 warnings
4. Commit the source file + all of `docs/dashboard/` + vite config changes

---

## Regression Guard

Verify these still work exactly as before:
- Freedom Rings render the same when no splits exist
- `ChartOverBudget` still shows the same overages for profiles without splits
- Income/spending waterfall looks the same for non-split data
- No other tab, chart, or component touched
- No storage keys read or written that weren't before

---

## Verification Steps

Before committing, confirm:
- [ ] `npm run build` passes with 0 errors, 0 warnings
- [ ] `expandSplitTx` is defined ONCE at top level (not inside a component)
- [ ] All three aggregation sites updated with `.flatMap(expandSplitTx).filter(tx => tx.categoryId !== 'cat_split')`
- [ ] Aggregate totals (`totalSpend`, `thisMonthSpend`) still use the unexpanded transactions — not double-counted
- [ ] Version bumped to v2.0.1
- [ ] No other files modified (except Vite build output in `docs/dashboard/`)

---

## Report Back

```
Dashboard v2.0.1 build report
- Build: PASS / FAIL
- expandSplitTx helper: line ___
- ChartOverBudget fix: lines ___–___
- Waterfall (category mode) fix: lines ___–___
- spendingHealth fix: lines ___–___
- Version bumped to v2.0.1: line ___
- Vite build artifacts regenerated in docs/dashboard/: YES / NO
- Other files modified: YES / NO (list if yes)
- Diff line count (approx): ___
- Build size: ___ KB (previous v2.0: 228 KB)
```

---

## Commit Message

```
fix: Dashboard v2.0.1 — split-aware aggregation (SpendingTracker v1.10 compat)

Add expandSplitTx helper, mirroring accumulateTx in spending.jsx. Flatten split
parents into per-child pseudo-transactions in ChartOverBudget, income/spending
waterfall (category mode), and the Freedom Score spendingHealth calc. Aggregate
totals continue to use unexpanded transactions to avoid double-counting. Prevents
'cat_split' sentinel from landing in any Dashboard category breakdown.
```
