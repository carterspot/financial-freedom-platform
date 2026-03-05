# CardTracker — Development Notes
**v3.0 · March 2026 Session**

---

## Session Overview

This session added three major feature sets to `credit-card-tracker.jsx`: payment tracking with balance updates, an AI strategy flow overhaul with apply/save/export, and a full responsive layout pass. The artifact grew from 1,724 lines to 2,037 lines.

---

## Architecture: What Changed

### New Top-Level Components

**`QuickPayModal`** (new, ~60 lines)
- Props: `card, onConfirm, onClose, darkMode`
- Computes `monthlyInterest = balance * apr / 100 / 12`
- `principal = Math.max(0, paid - monthlyInterest)`
- `newBalance = Math.max(0, balance - principal)`
- Returns payment object to `App.handleQuickPay()` on confirm
- Shows real-time balance preview as user edits amount
- Live diff display (over/under vs expected) in amber/green

### Modified Components

**`CardPanel`**
- Added `onQuickPay` prop
- Added `✓ Pay` button with `rgba(16,185,129,.25)` background (green tint on card color)
- Added `useBreakpoint()` for responsive expanded stats grid (2-col mobile, 4-col desktop)

**`StrategyTab`** (full rewrite)
- New props: `profileId, onApplyStrategy, initiallyShowQuestionnaire`
- Storage keys: `cc_strategy_answers_{profileId}`, `cc_ai_results_{profileId}`
- On mount: loads saved answers + saved result from storage
- Generate prompt now requests `<strategy_data>` XML block containing JSON after natural language analysis
- JSON parsed with regex: `raw.match(/<strategy_data>\s*([\s\S]*?)\s*<\/strategy_data>/)`
- JSON stripped from display text before rendering via `.replace(/<strategy_data>[\s\S]*?<\/strategy_data>/,"")`
- `strategyData` shape: `{method, extraBudget, cardFocus, reasoning}`
- Apply button calls `onApplyStrategy(strategyData)` — no JSON ever shown to user
- Copy/download export includes timestamp, card snapshot, full analysis
- `showQ` state controls questionnaire visibility separately from `done`
- Graceful degradation: if JSON parse fails, analysis still displays, Apply button does not appear

**`PayoffScheduleModal`** (major rewrite)
- New prop: `profileId`
- New state: `appliedStrategy, aiSavedAt, aiCopied`
- Initial tab resolved async: checks `cc_ai_results_{profileId}` → strategy (first-time) or schedule (returning)
- Tab order changed: Strategy → Schedule → Charts → What-If → Progress
- `applyStrategy(data)`: sets `method`, `extraBudget`, `appliedStrategy` state; switches to schedule tab
- Applied strategy shows as indigo badge in header
- Schedule tab: "Apply AI Strategy" / "Change Strategy" button routes to strategy tab
- AI Analysis: Copy + Download .txt buttons appear after generation
- AI results auto-saved merged into existing storage key (preserves strategy result)
- Mobile: tabs show icons only, compact header, responsive stat grids

**`App`**
- New state: `quickPayCard`
- New handler: `handleQuickPay(payment)` — updates card balance via `setCards` map, closes modal
- `PayoffScheduleModal` now receives `profileId={activeProfileId||"default"}`
- `CardPanel` now receives `onQuickPay={c=>setQuickPayCard(c)}`
- `QuickPayModal` added to modal stack at bottom of return

---

## Storage Keys Added This Session

| Key | Scope | Contents |
|---|---|---|
| `cc_strategy_answers_{profileId}` | shared | `{goal, stress, income, extra, timeline}` — questionnaire answers |
| `cc_ai_results_{profileId}` | shared | `{analysis, strategyData, savedAt, answers, scheduleAnalysis, scheduleAnalysisSavedAt}` |

Note: Both strategy result and schedule analysis are merged into the same `cc_ai_results_` key to avoid multiple storage probes on open.

---

## AI Prompt Design

### Strategy Tab Prompt
Instructs Claude to respond in two parts in a single call:
1. ~500 word natural language plan with 7 sections
2. A `<strategy_data>` XML block containing structured JSON

The app parses these separately — natural language displayed via `Markdown` component, JSON extracted silently. This avoids a second API call and ensures the structured data always matches the text the user reads.

Prompt ends with:
```
After your analysis, output this exact block (no markdown around it):
<strategy_data>
{"method":"avalanche","extraBudget":0,"cardFocus":"","reasoning":""}
</strategy_data>
```

### Schedule Analysis Prompt
Unchanged from v2.0 — 6-section analysis of avalanche vs snowball comparison specific to the user's portfolio. ~400 words.

---

## Payment Math

When a payment is confirmed in `QuickPayModal`:
```
monthlyInterest = balance × (apr / 100 / 12)
principal = max(0, amountPaid - monthlyInterest)
newBalance = max(0, balance - principal)
```

This is simple interest math — same formula used by the payoff schedule engine. It does not handle mid-month compounding or days-in-period variations. For the purposes of tracking and projection, this is accurate enough and consistent with the schedule engine.

If a user pays less than the monthly interest (negative principal), `Math.max(0, ...)` prevents the balance from increasing. In a real scenario the balance would grow, but tracking that edge case adds complexity without meaningful benefit for the target user.

---

## Responsive Implementation

`useBreakpoint()` hook added in v2.1. This session consumed it in:
- `CardPanel` — expanded stat grid columns
- `SummaryDashboard` — stat grid columns, button labels
- `CalendarView` — cell height, event label length, day header abbreviation
- `PayoffScheduleModal` — padding, tab label visibility (icons only on mobile), button text
- `App` — nav padding, button labels, card grid columns

Breakpoints:
- `isMobile`: `window.innerWidth < 640`
- `isTablet`: `window.innerWidth < 1024`

---

## Critical JSX Rules (Ongoing)

These caused crashes in earlier sessions and must be maintained:

1. `return (` or `return <` — never `return<`
2. No JSX-returning functions defined inside components — all hoisted to top level
3. No `window.confirm()` — custom `DeleteConfirm` modal used throughout
4. No streaming AI — all calls use `await res.json()`
5. No `while(true)` — `computeSchedule` uses `while(month<600)` with explicit break

---

## Files Modified This Session

| File | Change |
|---|---|
| `modules/card-tracker.jsx` | Major feature additions — v3.0 |
| `docs/whats-new.md` | Created |
| `docs/development-notes.md` | Created (this file) |
| `docs/user-quickstart.html` | Created |

---

## Deferred / Future Work

- **Named strategy snapshots** — user-labeled saves ("March Plan", "After bonus")
- **Payment log in Progress tab** — QuickPay currently updates balance only; Progress tab log is separate manual entry. These should be unified so QuickPay auto-populates the Progress log.
- **Negative balance guard** — if user pays more than balance, balance should floor at 0 and excess ignored (currently handled by `Math.max(0, ...)` but not communicated to user)
- **DebtTracker module** — loans with amortization, separate from cards
- **Platform unification** — single dashboard linking all modules

