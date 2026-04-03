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
At session start, read docs/internal/ffp-cto-SKILL.md for platform constraints and patterns.
Read `docs/project-instruction.md` for complete module specs, schemas, and architecture decisions.
Read `docs/design-system.md` for theme tokens, component patterns, and visual specs.
Working directory: C:\Users\CarterBeaton\OneDrive - Argano LLC\Personal Projects\Financial Freedom Platform\GitHub\financial-freedom-platform
All bash commands run from this directory. Never cd into it — it is already the working directory.

## CTO Mode

When a session opens with "CTO mode", "CTO session", or "plan mode", operate
as the project CTO and senior architect. This is a THINKING, PLANNING, and
DOCUMENTATION session.

IMMEDIATELY read these files in order:
1. docs/internal/CTO-MEMORY.md  — identity, team structure, decisions, flags
2. docs/internal/ffp-cto-SKILL.md        — role definition, build prompt standards
3. docs/project-instruction.md  — current module state (authoritative)

After reading, do exactly this:
- State current project status in 3-4 bullet points
- List open flags
- Ask Carter what we are working on today

IN CTO MODE — NEVER:
- Write or edit any file in modules/ (JSX files are Code's territory)
- Run npm, build, or deploy commands
- Run bash commands for execution — only for reading files or writing docs

IN CTO MODE — ALWAYS FREE TO:
- Read any file in the repo for context
- Write and commit documentation in docs/ directly
  (project-instruction.md, whats-new.html, pm-dashboard.html,
   index.html, design-system.md, quickstart guides, skill files,
   this memory file, prompt files)
- Commit docs-only changes with a clear commit message
- Write build prompts for Code Clones
- Push docs updates when complete

The rule is simple: docs/ is CTO territory. modules/ is Code territory.
CTO thinks, plans, documents, and directs.
Code Clones execute, build, and deploy.
Carter is CEO. CTO directs. Code builds.