# SavingsModule v1.2 — AI Advisor Tab
**File:** `modules/savings.jsx`
**Author:** CTO
**Date:** 2026-04-07

---

## Before You Start

Read in this order:
1. `CLAUDE.md` — JSX rules, storage prefix, shared keys
2. `docs/design-system.md` — callClaude pattern, canonical component patterns
3. `docs/project-instruction.md` — Savings module schema, fund/goal model

---

## Objective

Two changes in one build pass:
1. Add an **AI Advisor tab** to SavingsModule as the 4th tab (after Overview / Funds / Goals).
2. Redesign **Funds** and **Goals** lists to use the expandable card pattern (see `docs/design-system.md` — Expandable Card Pattern section).

---

## Change 1 — New Tab: AI Advisor

Add "AI Advisor" (label "AI" on mobile) as the 4th tab in the tab bar.

**Tab content — single panel:**

Show an "Analyze My Savings" button on first load. After first run, show results + a "Re-analyze" button.

---

## Change 2 — AI Prompt

On button click, read `ffp_baseline_` from shared storage (`storeGet(`ffp_baseline_${activeProfile.id}`, true)`), then build and send this prompt:

```javascript
const systemPrompt = `You are a personal savings advisor. Analyze the user's savings data and give 3-5 specific, actionable recommendations. Be direct and prioritize by impact. Format: numbered list, each item under 3 sentences.`;

const baselineCtx = baseline
  ? `\n\nMonthly spending baseline (from SpendingTracker): ${fmt$(baseline.amount)}\nTop essential categories: ${baseline.breakdown.slice(0,5).map(b => `${b.catName} $${b.avg.toFixed(0)}/mo`).join(", ")}`
  : "";

const fundsCtx = funds.map(f =>
  `Fund: ${f.name} — Balance: ${fmt$(f.balance)}`
).join("\n");

const goalsCtx = goals.map(g => {
  const progress = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
  const needed = g.targetAmount - g.currentAmount;
  const dueNote = g.dueDate ? ` · Due: ${g.dueDate}` : "";
  const urgentNote = g.dueDate && needed > 0 && (new Date(g.dueDate) - new Date()) < 60*24*60*60*1000
    ? " ⚠️ DUE WITHIN 60 DAYS — UNDERFUNDED"
    : "";
  return `Goal: ${g.name} (${g.goalType}) — Target: ${fmt$(g.targetAmount)}, Saved: ${fmt$(g.currentAmount)} (${progress}%)${dueNote}${urgentNote}`;
}).join("\n");

const hasEmergencyFund = goals.some(g => g.name.toLowerCase().includes("emergency"));

const userPrompt = `Here is my savings data:

Funds:
${fundsCtx || "No funds yet."}

Goals:
${goalsCtx || "No goals yet."}

Emergency fund: ${hasEmergencyFund ? "Yes" : "Not set up"}${baselineCtx}

Please give me 3-5 specific recommendations to improve my savings strategy.`;
```

Use the standard `callClaude` pattern from design-system.md. `await res.json()` only — no streaming.

---

## Change 3 — Results Display

Show AI response in a styled panel:
- White/dark panel, border, `border-radius: 12px`, `padding: 20px`
- Results rendered as pre-formatted text (`white-space: pre-wrap`, `font-size: 13px`, `line-height: 1.7`)
- "Re-analyze" button below results
- Loading spinner during call (same pattern as other modules)
- Error state with retry prompt if call fails

Save results to `sav_ai_results_{profileId}` on success. Load saved results on tab open so they persist across sessions.

Read `apiKey` from `storeGet("cc_apikey", true)`. If no key, show the standard API key prompt.

---

## Change 4 — Expandable Card Redesign: Funds & Goals

Read `docs/design-system.md` Expandable Card Pattern before implementing.
Module accent color: `#6366f1` (indigo).

### Fund cards (Funds tab)

**Collapsed state** (default):
- Fund name (left, `fontWeight: 700`)
- Balance (right, monospace, `fontWeight: 800`)
- Chevron icon (rotates 90° when expanded)
- No progress bar on funds (balance only — no target)

**Expanded state:**
- All existing fund detail fields (notes, linked goal if any, etc.)
- Edit / Delete buttons
- `borderLeft: "4px solid #6366f1"`

### Goal cards (Goals tab)

**Collapsed state** (default):
- Goal name (left, `fontWeight: 700`)
- `currentAmount / targetAmount` amounts (right, monospace)
- Progress bar: `height: 7`, track `background: t.surf`, fill `background: #6366f1`, `borderRadius: 99`, `transition: "width .4s ease"`
- Chevron icon (rotates 90° when expanded)
- If goal is fully funded: swap progress bar fill to `#10b981` (green) and show a "✓ Funded" pill

**Expanded state:**
- Due date, goal type, notes
- Monthly contribution needed (if due date set and unfunded)
- Edit / Delete buttons

### Card container styles (both Funds and Goals)
```javascript
const cardStyle = {
  background: t.panelBg,
  border: `1px solid ${t.border}`,
  borderLeft: "4px solid #6366f1",
  borderRadius: 14,
  overflow: "hidden",
  marginBottom: 10,
};
const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px",
  cursor: "pointer",
  userSelect: "none",
};
const bodyStyle = (expanded) => ({
  maxHeight: expanded ? 400 : 0,
  overflow: "hidden",
  transition: "max-height .25s ease",
  padding: expanded ? "0 16px 14px" : "0 16px",
});
```

`FundCard` and `GoalCard` must be **top-level named function components** — not defined inside `SavingsModule`.

---

## JSX Rules Audit

- [ ] AI Advisor tab content is a top-level named function component — not defined inside `SavingsModule`
- [ ] `FundCard` and `GoalCard` are top-level named function components — not defined inside `SavingsModule`
- [ ] No `window.confirm()` — modal pattern used
- [ ] `await res.json()` only, no streaming
- [ ] No `<form>` tags

---

## Verification

**Expandable cards:**
1. Funds tab shows fund cards in collapsed state by default
2. Click fund card header → expands smoothly, chevron rotates 90°
3. Click again → collapses
4. Goal cards show progress bar in collapsed state
5. Funded goals show green fill + "✓ Funded" pill
6. `FundCard` and `GoalCard` render correctly — no nested component warnings

**AI Advisor tab:**
7. 4th tab "AI Advisor" appears in tab bar
8. "Analyze My Savings" button visible on first load
9. Click → loading spinner → AI response renders
10. If `ffp_baseline_` exists, AI references spending baseline in response
11. Results persist after switching tabs and returning
12. No API key → key prompt shown

---

## Vite Build + Deploy

1. `preview/src/App.jsx` → `import App from "../../modules/savings.jsx"`
2. `preview/vite.config.js` → `base: "/financial-freedom-platform/savings/"`, `outDir: "../docs/savings"`
3. `cd preview && npm run build` — must pass clean
4. Commit: `modules/savings.jsx` + `docs/savings/` + `preview/vite.config.js` + `preview/src/App.jsx`

---

## Commit Message

```
feat: SavingsModule v1.2 — expandable fund/goal cards + AI Advisor tab
```

---

## Report Back

- Build result (pass/fail, bundle size)
- Whether fund and goal cards expand/collapse correctly
- Whether funded goals show green pill
- Whether AI tab renders and returns a response
- Whether baseline data is referenced in AI output
- Whether results persist across tab switches
- Do NOT paste the full JSX — it will be read from repo via GitHub MCP
