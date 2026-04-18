# SpendingTracker v1.10 — Prompt 2: Standalone Reconciliation Panel

## Model: claude-opus-4-7
Run `/model claude-opus-4-7` before reading any files.

**Prerequisite:** Prompt 1 (splits) must be merged first. This prompt builds on `isSplit` / `splits[]` / `SPLIT_CATEGORY_ID`.

---

## Read First (in order)
1. `CLAUDE.md` — JSX rules, storage prefixes, pre-ship checklist
2. `docs/project-instruction.md` — Module 5 (SpendingTracker) section only
3. `docs/design-system.md` — theme tokens, tab patterns, modal patterns
4. `modules/spending.jsx` — full file, with Prompt 1 splits already in

---

## Surgical Scope
Add a standalone reconciliation panel (new tab) that detects post-hoc duplicates across all entry methods. One file: `modules/spending.jsx`.

**The gap being closed:** existing dedup is entry-time only. `buildDedupData` fires during CSV import, `findDuplicate` fires during receipt scan. A manual entry + a later CSV import of the same transaction is never caught. A scanned receipt + a later manual entry is never caught. This panel catches all of it post-hoc.

**Do not touch:** any other module, shared key, or file outside `modules/spending.jsx`. Do not alter the existing CSV import dedup flow (`buildDedupData`, `ImportStep4`) or the scan dedup flow (`findDuplicate`, `DuplicateCheckModal`). They stay exactly as they are.

---

## What to Build

### 1. New storage key (profile-scoped)

```
sp_dedup_dismissed_{profileId}
```

Shape:
```js
[
  { pairKey: "txnA_id:txnB_id", dismissedAt: "2026-04-18T..." },
  ...
]
```

Use the existing probe/fallback storage pattern. `pairKey` is always the two transaction IDs sorted lexically and joined by `:`, so the same pair always produces the same key regardless of which transaction is A or B.

Helper:
```js
function pairKeyFor(idA, idB) {
  return [idA, idB].sort().join(':');
}
```

---

### 2. Duplicate detection function (top-level, hoisted)

```js
function findDuplicatePairs(transactions, dismissedPairs) {
  // Returns array of { a, b, score, reason }
  // Excludes:
  //   - same id
  //   - either side is a split child (we only compare parent-level records)
  //   - already reconciled to each other (a.reconciledWith === b.id or vice versa)
  //   - dismissed pair
  // Includes candidates where:
  //   - |amount| matches exactly (to the penny)
  //   - date delta <= 3 days
  //   - description similarity score >= 0.5 (Jaccard on lowercased token sets)
}
```

**Performance requirement:** bucket by `Math.abs(amount).toFixed(2)` first — only compare within each amount bucket. Must handle 5,000+ transactions in under 500ms on a mid-range laptop.

**Description similarity** — Jaccard index:
```js
function describeSimilarity(a, b) {
  const tokA = new Set((a || '').toLowerCase().split(/\s+/).filter(Boolean));
  const tokB = new Set((b || '').toLowerCase().split(/\s+/).filter(Boolean));
  if (!tokA.size || !tokB.size) return 0;
  let inter = 0;
  tokA.forEach(t => { if (tokB.has(t)) inter++; });
  return inter / (tokA.size + tokB.size - inter);
}
```

**Reason string** — human-readable, e.g.:
- `"Same amount, same day, similar description"` (date delta 0, score ≥ 0.7)
- `"Same amount, 2 days apart"` (date delta 1–3, score < 0.7)
- `"Same amount, identical description"` (score 1.0)

---

### 3. New tab: `ReconciliationTab`

Add a new top-level tab in SpendingTracker alongside the existing tabs. Tab label: `"Reconcile"`.

**Tab badge:** if unresolved pairs exist, show the count in a red/accent pill next to the tab label, e.g. `"Reconcile (4)"`.

**Tab content structure:**

- **Header bar**
  - Title: "Duplicate review"
  - Subtitle: `"{N} potential duplicates found across {totalTxnCount} transactions"`
  - If N = 0: empty state message — "No duplicates detected. All transactions look unique." Use the muted text color.

- **Pair list** — one card per candidate pair:
  - Two transaction rows side by side (or stacked on mobile using `useBreakpoint`):
    - Date, description, amount, category pill, account, `entryMethod` badge (small text: `manual` / `imported` / `scanned`)
  - Reason text above the pair: the `reason` string from `findDuplicatePairs`
  - Action buttons below the pair:
    - `Keep A` — deletes B, marks A as `reconciled: true, reconciledWith: <B.id>`
    - `Keep B` — deletes A, marks B as `reconciled: true, reconciledWith: <A.id>`
    - `Keep both` — marks both as `reconciled: true` with each other's IDs, leaves both in the transaction list, adds pair to `sp_dedup_dismissed_`
    - `Not a duplicate` — adds pair to `sp_dedup_dismissed_`, no other changes

- **Confirmation modal** for destructive actions (`Keep A` / `Keep B`) — reuse the existing modal pattern, not `window.confirm` (see CLAUDE.md rule 3).

---

### 4. Update transaction delete logic

When `Keep A` or `Keep B` is chosen, the deleted transaction is removed from `sp_transactions_` via the existing delete helper. Do not create a new delete path — reuse whatever `deleteTransaction` / `removeTransaction` already does.

If the deleted transaction is a split parent, the whole record (including `splits[]`) goes with it. This is expected behavior — do not try to preserve split children separately.

---

### 5. Tab integration

Find the existing tab array (or tab definition) in the main SpendingTracker component. Add `"Reconcile"` as a new entry, ordered to appear AFTER the existing tabs (last position). Follow the same pattern as existing tabs — same styling, same active/inactive states.

---

### 6. Reconciliation count on summary (optional polish)

If the existing SummaryTab or main header surfaces counts (transaction count, etc.), do not add reconciliation count there. The tab badge is sufficient signal.

---

## Edge Cases to Handle

- **Split parents:** compare only on parent-level `amount`. Do not compare split children against other transactions — splits are internal to their parent.
- **Already reconciled from scan flow:** if `a.reconciled === true && a.reconciledWith === b.id` (or vice versa), skip — it's already resolved.
- **User dismisses a pair, then edits one of the transactions:** the `pairKey` is still valid (IDs don't change), so the dismissal persists. This is correct behavior.
- **Zero transactions:** empty state, no errors.
- **Transactions with no description:** Jaccard returns 0; pair won't reach the 0.5 threshold unless date and amount match exactly — in that case, include it with reason `"Same amount, same day, no description"` as a special case.

---

## Regression Guard

These flows must still work exactly as before:
- CSV import `buildDedupData` + `ImportStep4` — untouched
- Receipt scan `findDuplicate` + `DuplicateCheckModal` — untouched
- `ffp_baseline_` calculation
- Splits (from Prompt 1) — `accumulateTx`, `computeRollingAvg` logic unchanged
- All existing tabs render correctly

---

## Verification Steps

Before committing, confirm:
- [ ] `cd preview && npm run build` passes with 0 errors, 0 warnings
- [ ] New tab "Reconcile" appears after existing tabs
- [ ] Seeding 2 transactions with same amount, same day, similar description → shows as a pair
- [ ] Seeding a scan transaction with `reconciled: true, reconciledWith: <manual.id>` → does NOT appear in the panel
- [ ] Clicking `Not a duplicate` removes the pair and persists dismissal across reload
- [ ] Clicking `Keep A` deletes B, reload confirms B is gone, A is marked reconciled
- [ ] Empty state renders when no candidates exist
- [ ] `sp_dedup_dismissed_{profileId}` key appears in storage after a dismiss
- [ ] No other files modified

---

## Report Back

```
SpendingTracker v1.10-P2 build report
- Build: PASS / FAIL
- New storage key: sp_dedup_dismissed_{profileId} — line ___ (probe/fallback helpers)
- pairKeyFor helper: line ___
- findDuplicatePairs function: lines ___–___
- describeSimilarity helper: line ___
- ReconciliationTab component: lines ___–___
- Tab registration: line ___
- Action handlers (keepA/keepB/keepBoth/dismiss): lines ___–___
- Delete integration reuses existing: YES / NO
- Other files modified: YES / NO (list if yes)
- Diff line count (approx): ___
- Build size: ___ KB
```

---

## Commit Message

```
feat: SpendingTracker v1.10 — standalone reconciliation panel

Add post-hoc cross-method duplicate detection. New Reconcile tab surfaces probable
duplicate pairs across manual/imported/scanned transactions using amount+date+description
similarity. Actions: Keep A, Keep B, Keep Both, Not a duplicate. Dismissed pairs persist
in sp_dedup_dismissed_. Existing entry-time dedup flows (CSV import, receipt scan)
unchanged.
```
