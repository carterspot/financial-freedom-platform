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

Add an **AI Advisor tab** to SavingsModule as the 4th tab (after Overview / Funds / Goals). This is the only change — no other UI modifications.

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

## JSX Rules Audit

- [ ] AI Advisor tab content is a top-level named function component — not defined inside `SavingsModule`
- [ ] No `window.confirm()` — modal pattern used
- [ ] `await res.json()` only, no streaming
- [ ] No `<form>` tags

---

## Verification

1. 4th tab "AI Advisor" appears in tab bar
2. "Analyze My Savings" button visible on first load
3. Click → loading spinner → AI response renders
4. If `ffp_baseline_` exists, AI references spending baseline in response
5. Results persist after switching tabs and returning
6. No API key → key prompt shown

---

## Vite Build + Deploy

1. `preview/src/App.jsx` → `import App from "../../modules/savings.jsx"`
2. `preview/vite.config.js` → `base: "/financial-freedom-platform/savings/"`, `outDir: "../docs/savings"`
3. `cd preview && npm run build` — must pass clean
4. Commit: `modules/savings.jsx` + `docs/savings/` + `preview/vite.config.js` + `preview/src/App.jsx`

---

## Commit Message

```
feat: SavingsModule v1.2 — AI Advisor tab with spending baseline context
```

---

## Report Back

- Build result (pass/fail, bundle size)
- Whether AI tab renders and returns a response
- Whether baseline data is referenced in AI output
- Whether results persist across tab switches
