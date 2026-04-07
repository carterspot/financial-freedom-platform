# SavingsModule v1.1 — Emergency Fund Seeder + Baseline Integration
**File:** `modules/savings.jsx`  
**Author:** CTO  
**Date:** 2026-04-07  
**Depends on:** SpendingTracker v1.8 must be shipped first (writes `ffp_baseline_`)

---

## Before You Start

Read in this order:
1. `CLAUDE.md` — JSX rules, storage prefix, shared keys
2. `docs/design-system.md` — callClaude pattern, canonical component patterns
3. `docs/project-instruction.md` — Savings module schema, fund/goal model

---

## Objective

Add two things to SavingsModule:

1. **Emergency Fund Seeder** — on load, if `ffp_baseline_` exists and no Emergency Fund goal exists yet, prompt the user to create one with the amount pre-calculated from their spending baseline.
2. **Baseline context in AI** — pass `ffp_baseline_` data into the AI advisor prompt so it can reason about savings rate and goal feasibility against real spending.

**Scope: exactly these two changes. No UI redesign, no new tabs.**

---

## Change 1 — Read `ffp_baseline_` on Init

In the `init()` function (the `useEffect` that loads profile data), after loading the active profile, add:

```javascript
const baseline = await storeGet(`ffp_baseline_${profile.id}`, true) || null;
setBaseline(baseline);
```

Add `const [baseline, setBaseline] = useState(null);` to the component's state declarations.

Also refresh baseline on profile switch — same pattern as other profile data loads.

---

## Change 2 — Emergency Fund Seeder Banner

In the **Overview tab** (or the main funds/goals view — wherever the goal list renders), add a seeder banner. Show it when ALL of these are true:
- `baseline !== null && baseline.amount > 0`
- No existing goal has a name containing "Emergency" (case-insensitive) OR the goal category is "Emergency Fund"
- The user has not dismissed the banner (track dismissal in `useState` — do not persist, just session-level)

**Banner design** — emerald color scheme, matches existing panel style:

```
┌─ 💡 Emergency Fund Recommendation ───────────────────────────────────┐
│  Based on your spending, your minimum monthly expenses are $X,XXX.   │
│  A 3-month emergency fund would be $X,XXX.                           │
│                                                                       │
│  [Create Emergency Fund Goal]                [Dismiss]               │
└───────────────────────────────────────────────────────────────────────┘
```

**On "Create Emergency Fund Goal":**
Pre-fill the new goal form with:
```javascript
{
  name: "Emergency Fund",
  targetAmount: Math.round(baseline.amount * 3),
  notes: `3-month baseline from spending data (${fmt$(baseline.amount)}/mo)`
}
```
Open the existing add-goal modal/form with these values pre-filled. User can edit before saving. Do not auto-save — user must confirm.

**On "Dismiss":** hide the banner for the session. Set a local state flag `seederDismissed = true`.

---

## Change 3 — Baseline Context in AI Advisor

In the AI advisor tab, wherever the prompt is built for Claude, add baseline data to the context if available:

```javascript
const baselineContext = baseline
  ? `\n\nSpending Baseline (from SpendingTracker):\n- Minimum monthly expenses: ${fmt$(baseline.amount)}\n- Top essential categories: ${baseline.breakdown.slice(0,5).map(b => `${b.catName} $${b.avg.toFixed(0)}/mo`).join(", ")}\n- Calculated: ${baseline.calculatedOn ? new Date(baseline.calculatedOn).toLocaleDateString() : "unknown"}`
  : "\n\nSpending Baseline: Not available (user hasn't run SpendingTracker v1.8+ yet).";
```

Append `baselineContext` to the existing system or user prompt. Keep all existing prompt content — this is additive only.

---

## JSX Rules Audit

- [ ] No `return<` — all returns use `return (` or `return <`
- [ ] No JSX-returning functions defined inside a component
- [ ] No `window.confirm()` — modal pattern for confirmations
- [ ] `await res.json()` only, no streaming
- [ ] No `<form>` tags

---

## Verification

1. Ensure SpendingTracker v1.8 has been run and `ffp_baseline_{profileId}` exists in localStorage
2. Open SavingsModule — seeder banner appears if no Emergency Fund goal exists
3. Click "Create Emergency Fund Goal" — goal form opens with $X,XXX pre-filled (3× baseline)
4. Dismiss banner — banner hides, does not reappear in same session
5. If baseline doesn't exist — no banner, no errors, module works normally
6. AI tab — baseline data appears in Claude's context (verify by checking what the AI says about your spending)

---

## Vite Build + Deploy

1. `preview/src/App.jsx` — set import to `../../modules/savings.jsx`
2. `preview/vite.config.js` — set `base: "/financial-freedom-platform/savings/"` and `outDir: "../docs/savings"`
3. `cd preview && npm run build` — must pass with 0 errors
4. Commit: `modules/savings.jsx` + `docs/savings/` + `preview/vite.config.js` + `preview/src/App.jsx`

---

## Commit Message

```
feat: SavingsModule v1.1 — emergency fund seeder from spending baseline, AI context
```

---

## Report Back

- Build result (pass/fail, bundle size)
- Whether seeder banner appeared with correct dollar amount
- Whether goal form pre-filled correctly
- Confirm baseline data flows into AI context
