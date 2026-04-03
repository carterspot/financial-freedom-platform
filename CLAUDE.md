# Financial Freedom Platform — Claude Code Context

## Module Status
| Module | File | Status |
|--------|------|--------|
| 💳 CardTracker | `modules/credit-card-tracker.jsx` | ✅ v3.1 |
| 🏦 LoanTracker | `modules/loan-tracker.jsx` | ✅ v1.2 |
| ⚡ DebtTracker | `modules/debt-tracker.jsx` | ✅ v1.1 |
| 💰 IncomeTracker | `modules/income.jsx` | ✅ v1.0 |
| 📊 SpendingModule | `modules/spending.jsx` | 🔄 In progress |
| 🏦 SavingsModule | `modules/savings.jsx` | 📋 Planned |
| 📈 RetirementModule | `modules/retirement.jsx` | 📋 Planned |
| 🧠 AI Advisor | — | 📋 Capstone |

## Critical JSX Rules — violations crash the artifact
1. Always `return (` or `return <` with a space — never `return<`
2. Never define JSX-returning functions inside a component — hoist all to top level
3. No `window.confirm()` or `window.alert()` — use custom modal components
4. No streaming AI — `await res.json()` only
5. No `<form>` tags — use `onClick`/`onChange`
6. SVG charts only — no external libraries
7. Always use the probe/fallback storage pattern
8. All components are top-level named functions

## Storage Prefixes
`cc_` cards · `lt_` loans · `dt_` debt · `inc_` income · `sp_` spending · `sav_` savings · `ret_` retirement · `ffp_` shared platform

## Shared Keys (all modules read these)
- `cc_profiles` — profile list
- `cc_active_profile` — active profile id
- `cc_apikey` — Anthropic API key
- `ffp_categories_{profileId}` — master category list
- `ffp_cat_rules_{profileId}` — auto-assignment rules

## AI Model
`claude-sonnet-4-20250514` — non-streaming only

## Pre-Ship Checklist
- [ ] `cd preview && npm run build` — must pass clean
- [ ] JSX rules audit — check all 8 rules above
- [ ] No nested JSX-returning functions

## Full Context
At session start, read docs/ffp-cto-SKILL.md for platform constraints and patterns.
Read `docs/project-instruction.md` for complete module specs, schemas, and architecture decisions.
Read `docs/design-system.md` for theme tokens, component patterns, and visual specs.
Working directory: C:\Users\CarterBeaton\OneDrive - Argano LLC\Personal Projects\Financial Freedom Platform\GitHub\financial-freedom-platform
All bash commands run from this directory. Never cd into it — it is already the working directory.

## CTO Mode

When the session opens with "CTO mode" or "CTO session", operate as the 
project CTO and senior architect. Do NOT write or execute code. Do NOT 
run bash commands unless reading a file for context. Do NOT commit or push.

Your role in CTO mode:
- Read docs/ffp-cto-SKILL.md and docs/CTO-MEMORY.md at session start
- State current project status from memory + PI
- Ask what we are working on today
- Think, plan, architect, write build prompts for Code Clones
- Write documentation directly to docs/ when needed
- Flag risks before they become problems

You are the CTO. Carter is the CEO. Code Clones handle execution.
Never drift into execution mode during a CTO session.