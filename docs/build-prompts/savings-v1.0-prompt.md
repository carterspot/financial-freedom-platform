# Build Prompt: SavingsModule v1.0

Build `modules/savings.jsx` — a brand new module. This is a self-contained React artifact
with no npm dependencies. Follow all FFP platform patterns exactly.

Read `docs/internal/ffp-cto-SKILL.md` for platform constraints before writing any code.

---

## What this module does

Tracks savings funds and goals. Two goal types:
- **Accumulation goals** — user manually contribuves toward a target (emergency fund, vacation, down payment)
- **Sinking fund goals** — tied to a known recurring expense; app suggests monthly contribution based on target ÷ months until due date

A **Fund** is a physical savings account. **Goals** live inside a fund as line items.
Fund balance is tracked via manual deposits. Each goal tracks its own progress via logged contributions.

---

## File

`modules/savings.jsx` — version v1.0

---

## All components (top-level named functions only — never nested)

- `SavingsModule` — root component
- `useTheme(dm)` — returns theme tokens (copy pattern from other modules)
- `useBreakpoint()` — responsive hook (copy exact pattern from ffp-cto-SKILL.md)
- `probeCloudStorage / storeGet / storeSet / hasCloudStorage` — storage layer (copy exact pattern)
- `FundCard` — displays one fund with its goals nested inside
- `GoalRow` — single goal line item inside a FundCard
- `AddFundModal` — create / edit a fund
- `AddGoalModal` — create / edit a goal (handles both goalTypes)
- `DepositModal` — log a deposit to a fund (adds to fund.deposits[])
- `ContribModal` — log a contribution toward a specific goal (increments goal.currentAmount)
- `MarkPaidModal` — "Looks like [Goal Name] was paid — confirm reset?" prompt
- `SuggestionBanner` — surfaced when SpendingTracker has isSinkingFundCandidate transactions with no matching goal
- `AlertBanner` — 30-day due date warnings (ready / underfunded)
- `BackupRestorePanel` — JSON export/import + CSV export/import for funds and goals
- `ProfileDropdown` — profile switcher with Edit + Add New (standard platform pattern)
- `ConfirmModal` — for destructive actions (no window.confirm)
- `InfoTooltip` — small ℹ️ inline helper (reuse pattern from other modules if available)

---

## Layout

Single-page layout. No tabs at v1 — vertical scroll.

```
[Header]
  Module title "Savings"  |  [sun/moon]  [floppy/backup]  [key/api]  [profile initials]

[AlertBanner]  ← only renders if any goals have due dates within 30 days

[SuggestionBanner]  ← only renders if unmatched isSinkingFundCandidate transactions found

[Stats Row]
  Total Saved (sum of all fund balances)
  Total Targeted (sum of all goal targetAmounts)
  Monthly Commitment (sum of all active goal monthly contributions)
  Coverage % (Total Saved / Total Targeted × 100)

[Fund Cards]  ← one card per fund
  Fund name, account nickname, color swatch, balance
  [+ Log Deposit] button
  Goals list (GoalRow × N)
  [+ Add Goal] button (bottom of card)

[+ Add Fund] button  ← below all fund cards
```

On mobile (isMobile): stack stats 2×2, fund cards full width.

---

## FundCard internals

Each fund card shows:
- Fund name (bold) + account nickname (muted)
- Current balance (large monospace) vs total goal allocations
- A thin progress bar: goal allocations / fund balance (red if over-allocated, green if covered)
- [+ Log Deposit] button — opens DepositModal
- GoalRow list for each goal in this fund

---

## GoalRow internals

For each goal, show:
- Goal name + goalType badge ("Accumulation" | "Sinking Fund") — pill, muted
- Progress bar: currentAmount / targetAmount (COLOR.success when ≥ 100%)
- currentAmount / targetAmount (monospace)
- Due date (if set) — formatted "MMM YYYY"; turns amber when within 90 days, red within 30
- Required monthly contribution (calculated, see formula below) — show as "~$X/mo"
  If user has set a manual override (goal.monthlyContrib is not null), show override value with a small "custom" label
- [Log Contribution] button — opens ContribModal
- [Edit] pencil + [Delete] trash (small icon buttons, right side)
- If goalType === "sinking_fund" and lastPaidDate: show last paid date muted below

---

## Monthly contribution formula

```javascript
function calcRequiredMonthly(goal) {
  if (goal.monthlyContrib !== null && goal.monthlyContrib !== "") {
    return parseFloat(goal.monthlyContrib); // user override
  }
  const remaining = Math.max(0, parseFloat(goal.targetAmount || 0) - parseFloat(goal.currentAmount || 0));
  if (!goal.dueDate) return 0;
  const now = new Date();
  const due = new Date(goal.dueDate);
  const months = Math.max(1, (due.getFullYear() - now.getFullYear()) * 12 + (due.getMonth() - now.getMonth()));
  return remaining / months;
}
```

---

## Alert system (display logic only — no storage)

On render, scan all goals where dueDate is set:
- Days until due < 30 AND currentAmount >= targetAmount → green alert: "✓ [Goal Name] is fully funded and due soon"
- Days until due < 30 AND currentAmount < targetAmount → amber alert: "[Goal Name] due in X days — $Y short"

Render these in `AlertBanner` at the top. If no alerts, render nothing.

---

## Spending → Savings handoff

Run this logic once on mount (inside a useEffect, after profile loads):

### 1. Goal suggestions (first-run / ongoing)
```
Read sp_transactions_{profileId} from storage
Filter: isSinkingFundCandidate === true
Group by recurrencePattern (ignore empty patterns)
For each group: check if any existing sinking_fund goal has matching recurrencePattern or categoryId
If NO match found → add to suggestionList: { recurrencePattern, categoryId, estimatedAmount, frequency }
```
Render `SuggestionBanner` if suggestionList.length > 0.
Each suggestion shows: "We noticed recurring [recurrencePattern] — add as a sinking fund goal?"
[Add Goal] button on each suggestion pre-fills AddGoalModal with the suggestion data.

### 2. Mark-as-paid detection
```
For each goal where goalType === "sinking_fund":
  Find sp_transactions_ entries where:
    (categoryId matches goal.categoryId OR description contains goal.recurrencePattern)
    AND date is within the last 45 days
    AND transaction date > goal.lastPaidDate (or lastPaidDate is null)
  If match found → open MarkPaidModal for that goal
```
Only fire ONE MarkPaidModal at a time. Queue the rest.
MarkPaidModal confirms: sets goal.lastPaidDate = transaction date, resets goal.currentAmount to 0.

---

## Schemas

### Fund object
```json
{
  "id": "sav_fund_abc123",
  "name": "Sinking Fund Account",
  "accountNickname": "Ally Savings",
  "color": "#6366f1",
  "balance": 1200.00,
  "deposits": [
    { "id": "dep_001", "amount": 300, "date": "2026-04-01", "note": "April deposit" }
  ]
}
```

### Goal object
```json
{
  "id": "sav_goal_abc123",
  "fundId": "sav_fund_abc123",
  "name": "Car Registration",
  "goalType": "sinking_fund",
  "targetAmount": "240",
  "currentAmount": "80",
  "dueDate": "2026-12-01",
  "monthlyContrib": null,
  "categoryId": "exp_045",
  "recurrencePattern": "DMV REGISTRATION",
  "linkedTransactionId": "",
  "lastPaidDate": ""
}
```

`goalType` values: `"accumulation"` | `"sinking_fund"`

---

## AddGoalModal fields

- Goal name (text, required)
- Goal type (toggle: Accumulation | Sinking Fund)
- Fund (dropdown of existing funds, required)
- Target amount ($, required)
- Due date (date input, optional for accumulation, required for sinking fund)
- Monthly contribution override (optional — shows calculated value as placeholder)
- Category (dropdown from ffp_categories_{profileId}, filtered to expense categories — only shown for sinking_fund type)
- Recurrence pattern (text, pre-filled if created from a suggestion — only shown for sinking_fund type)

---

## Storage keys

```
sav_funds_{profileId}    (shared) — array of fund objects (includes deposits[])
sav_goals_{profileId}    (shared) — array of goal objects
sav_dark                 (local)  — dark mode boolean
cc_profiles              (shared) — SHARED across all modules
cc_active_profile        (shared) — SHARED across all modules
cc_apikey                (shared) — SHARED across all modules (needed for BackupRestorePanel API key display)
ffp_categories_{profileId} (shared) — read for category dropdown; seed DEFAULT_CATEGORIES if empty
```

Read `sp_transactions_{profileId}` (shared, read-only) for spending handoff. Never write to it.

---

## Storage pattern (copy exactly)

```javascript
let _cloudAvailable = null;
async function probeCloudStorage() {
  if (_cloudAvailable !== null) return _cloudAvailable;
  if (!window?.storage?.get) { _cloudAvailable = false; return false; }
  try {
    await Promise.race([
      window.storage.get("__probe__", false),
      new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 2500))
    ]);
    _cloudAvailable = true;
  } catch { _cloudAvailable = false; }
  return _cloudAvailable;
}
async function storeGet(key, shared=false) {
  if (await probeCloudStorage()) {
    try { const r = await window.storage.get(key, shared); return r ? JSON.parse(r.value) : null; }
    catch { _cloudAvailable = false; }
  }
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function storeSet(key, value, shared=false) {
  if (await probeCloudStorage()) {
    try { await window.storage.set(key, JSON.stringify(value), shared); return; }
    catch { _cloudAvailable = false; }
  }
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
const hasCloudStorage = () => _cloudAvailable === true;
```

---

## Design system tokens

```javascript
function useTheme(dm) {
  return {
    bg: dm?"#020617":"#f1f5f9", panelBg: dm?"#0f172a":"#ffffff",
    surf: dm?"#1e293b":"#f1f5f9", deepBg: dm?"#0a0f1e":"#ffffff",
    border: dm?"#1e293b":"#e2e8f0", border2: dm?"#334155":"#cbd5e1",
    tx1: dm?"#f1f5f9":"#0f172a", tx2: dm?"#94a3b8":"#64748b", tx3: dm?"#475569":"#94a3b8",
  };
}
const COLOR = {
  primary:"#6366f1", success:"#10b981", warning:"#f59e0b", danger:"#ef4444",
  pink:"#ec4899", blue:"#3b82f6", orange:"#f97316", purple:"#8b5cf6", teal:"#06b6d4",
};
const AVATAR_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];
// Font: 'DM Sans','Segoe UI',sans-serif  |  Monospace for all financial numbers
```

---

## Backup/Restore

Standard panel. Two sections:
1. **Full backup** — JSON export/import of both `sav_funds_` and `sav_goals_` together. Replace or Merge (dedup by id).
2. **CSV export/import** — two separate pairs:
   - Funds CSV: `id, name, accountNickname, color, balance`
   - Goals CSV: `id, fundId, name, goalType, targetAmount, currentAmount, dueDate, monthlyContrib, categoryId, recurrencePattern, lastPaidDate`

Button labels: **"Save Backup"** (export JSON), **"Restore Backup"** (import JSON), **"Export CSV"**, **"Import CSV"**

Use `document.body.appendChild(a) / a.click() / document.body.removeChild(a)` for all downloads.

---

## First-run / empty state

If no funds exist:
- Show centered empty state: "No savings funds yet"
- Subtext: "Add a fund to start tracking your savings goals"
- [+ Add Your First Fund] button — opens AddFundModal

---

## JSX rules (non-negotiable)

- Always `return (` or `return <` with a space — never `return<`
- Never define JSX-returning functions inside a component — ALL listed components above are top-level
- No `window.confirm()` or `window.alert()` — use ConfirmModal
- No streaming AI — no AI calls in v1
- No `<form>` tags — use `onClick`/`onChange`
- SVG only for any visual elements — no external chart libraries
- Always use probe/fallback storage pattern above
- No Unicode box-drawing chars in comments (use --- not ─── )
- No `window.innerWidth` in useState initializer — use `() => typeof window !== 'undefined' ? window.innerWidth : 1280`
- No ES2023+ methods: no findLastIndex, toSorted, toReversed, at(-n)

---

## Pre-ship checklist

- [ ] `cd preview && npm run build` — 0 errors, 0 warnings
- [ ] grep -c "return<" modules/savings.jsx → must be 0
- [ ] grep -c "─" modules/savings.jsx → must be 0
- [ ] No nested JSX-returning component definitions
- [ ] All financial numbers use monospace font style
- [ ] Empty state renders when no funds exist
- [ ] Alert banner renders correctly with a test goal due within 30 days
- [ ] Version comment at top: `// SavingsModule v1.0`
