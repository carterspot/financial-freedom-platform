# SpendingTracker v1.10 — Prompt 1: Transaction Splits

## Model: claude-opus-4-7
Run `/model claude-opus-4-7` before reading any files.

---

## Read First (in order)
1. `CLAUDE.md` — JSX rules, storage prefixes, pre-ship checklist
2. `docs/project-instruction.md` — Module 5 (SpendingTracker) section only
3. `docs/design-system.md` — theme tokens and component patterns
4. `modules/spending.jsx` — the full file (read before touching anything)

---

## Surgical Scope
Add transaction splits to SpendingTracker. One file: `modules/spending.jsx`.

**Do not touch:** any other module, shared key, or file outside `modules/spending.jsx`.

---

## What to Build

### 1. Add the split sentinel constant (near top of file, with other constants)

```js
const SPLIT_CATEGORY_ID = 'cat_split';
```

---

### 2. Update `TransactionForm` (around L940–L1040)

Add split state initialized from the transaction being edited:

```js
const [isSplit,    setIsSplit]    = useState(transaction?.isSplit || false);
const [splits,     setSplits]     = useState(transaction?.splits  || []);
```

**Split toggle button** — place immediately after the category `<select>` (around L1008). Styled as a small secondary button using the existing theme tokens:

- Label: "Split transaction" when off, "Remove split" when on
- Toggling ON: sets `isSplit = true`, initializes `splits` with one empty line item `{ id: generateId(), amount: '', categoryId: 'exp_057', notes: '' }`
- Toggling OFF: sets `isSplit = false`, clears `splits = []`, restores normal category selector

**When `isSplit` is true:**
- Hide the single category `<select>`
- Show a split allocation section in its place:
  - One row per split item: `[amount input]` `[category select]` `[notes input optional]` `[× remove button]`
  - "＋ Add line item" button below the rows (disabled if splits already has 8 items)
  - Running total indicator: `"Allocated: $X.XX of $Y.YY"` — text color red if over/under, green if exact match
- Category select in each split row uses the same `categories` prop as the main form

**Validation on save (when `isSplit` is true):**
- Sum of `splits[].amount` must equal `Math.abs(amt)` — show inline error if not, block save
- Every split item must have a `categoryId` — block save if any are missing
- At least 2 split items required — block save if only 1

---

### 3. Update `onSave` call (L975)

Add `isSplit` and `splits` to the saved object:

```js
onSave({
  ...(transaction||{}),
  id: transaction?.id || generateId(),
  date,
  description: description.trim(),
  amount: amt,
  accountId,
  categoryId: isSplit ? SPLIT_CATEGORY_ID : categoryId,
  notes,
  recurrenceType: recurrenceType || null,
  recurrencePattern: (recurrenceType && recurrenceType !== "monthly") ? recurrencePattern.trim() : null,
  isSinkingFundCandidate,
  isSplit,
  splits: isSplit
    ? splits.map(s => ({ ...s, amount: parseFloat(s.amount) || 0 }))
    : [],
  categoryLocked: true,
  needsReview: false,
  importedAt: transaction?.importedAt || new Date().toISOString(),
  entryMethod: transaction?.entryMethod || "manual",
});
```

---

### 4. Fix category aggregation in `SummaryTab` (L2419+)

There are two aggregation loops — both at approximately L2429 and L2678. In each loop that accumulates spending by `tx.categoryId`, replace the single-line accumulation with a helper:

```js
function accumulateTx(tx, buckets) {
  if (tx.isSplit && tx.splits?.length) {
    tx.splits.forEach(s => {
      const cid = s.categoryId || 'exp_057';
      buckets[cid] = (buckets[cid] || 0) + Math.abs(s.amount);
    });
  } else {
    const cid = tx.categoryId || 'exp_057';
    buckets[cid] = (buckets[cid] || 0) + Math.abs(tx.amount);
  }
}
```

Hoist `accumulateTx` to top-level (not inside any component). Replace both aggregation loops to call it.

**Critical:** `SPLIT_CATEGORY_ID` ('cat_split') must never appear in any budget total, chart, or summary row. If it somehow appears, filter it out.

---

### 5. Fix `computeRollingAvg` and `computeRollingAvgIncome` (L224, L239)

These filter by `t.categoryId === categoryId`. Update both to also match split children:

```js
// In computeRollingAvg — replace the .filter line:
.filter(t => {
  if (t.isSplit && t.splits?.length)
    return t.splits.some(s => s.categoryId === categoryId);
  return t.categoryId === categoryId;
})
// And when summing amounts, use:
.reduce((sum, t) => {
  if (t.isSplit && t.splits?.length) {
    return sum + t.splits
      .filter(s => s.categoryId === categoryId)
      .reduce((a, s) => a + Math.abs(s.amount), 0);
  }
  return sum + Math.abs(t.amount);
}, 0)
```

Apply the same pattern to `computeRollingAvgIncome`.

---

### 6. Update `TransactionRow` display

Where the category is rendered in the transaction list row, check for `isSplit`:
- If `transaction.isSplit`, show the category cell as a small pill/badge: `"Split (N)"` where N = number of split items, using a muted secondary color from the theme
- On hover or expand (if the row is already expandable), show the split children inline as a compact sub-list: `[category name] — $X.XX`

Do not add expand/collapse infrastructure if it doesn't already exist in `TransactionRow` — just show the "Split (N)" badge. Keep it simple.

---

### 7. Update CSV export (L566)

The export line currently reads each transaction. For split parents, export the parent row with:
- Category column: `"Split"`
- Notes column: append a split summary, e.g. `"[Split: Groceries $45.00 / Household $30.00]"`

Do not explode split parents into multiple rows — keep one row per transaction for bank statement parity.

---

## Regression Guard

These flows must still work exactly as before — do not alter their logic:
- Manual transaction entry (non-split)
- CSV import flow (ImportStep1–4, `buildDedupData`)
- Receipt scan flow (`buildScannedTx`, `DuplicateCheckModal`)
- `ffp_baseline_` calculation
- AI categorization on import

---

## Verification Steps

Before committing, confirm:
- [ ] `cd preview && npm run build` passes with 0 errors, 0 warnings
- [ ] `SPLIT_CATEGORY_ID` constant is defined once at top level
- [ ] `isSplit` and `splits` fields are saved on transaction objects
- [ ] A split transaction with 3 items: each item's category appears in SummaryTab totals, parent `cat_split` does not
- [ ] Non-split manual entry, CSV import, and receipt scan still save without `isSplit`/`splits` fields (or with `isSplit: false, splits: []`)
- [ ] No other files modified

---

## Report Back

```
SpendingTracker v1.10-P1 build report
- Build: PASS / FAIL
- SPLIT_CATEGORY_ID constant: line ___
- TransactionForm split state: lines ___–___
- Split allocation UI: lines ___–___
- onSave updated: line ___
- accumulateTx helper: line ___
- SummaryTab aggregation fixes: lines ___, ___
- computeRollingAvg fix: lines ___–___
- TransactionRow split badge: line ___
- CSV export split note: line ___
- Other files modified: YES / NO (list if yes)
- Diff line count (approx): ___
- Build size: ___ KB
```

---

## Commit Message

```
feat: SpendingTracker v1.10 — transaction splits (isSplit, splits[], SPLIT_CATEGORY_ID)

Add split transaction support: toggle in TransactionForm, per-split category/amount allocation,
SummaryTab aggregation expanded to sum split children by category, rolling avg updated,
TransactionRow shows Split (N) badge, CSV export appends split summary to notes.
```
