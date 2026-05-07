# Financial Freedom Platform

> An AI-powered personal finance platform for debt elimination, spending control, savings growth, and retirement readiness.

A modular suite of standalone React (`.jsx`) artifacts that share a common design system, storage strategy, and AI integration. Each module ships independently to GitHub Pages and is independently useful. The **Dashboard** unifies them into a single Freedom Rings view; the planned **AI Advisor** capstone will produce a holistic cross-module financial plan.

**Live entry point:** [carterspot.github.io/financial-freedom-platform/dashboard/](https://carterspot.github.io/financial-freedom-platform/dashboard/)

---

## Modules

| Module | Status | URL | Description |
|---|---|---|---|
| 🏠 Dashboard | ✅ v2.0 | [/dashboard/](https://carterspot.github.io/financial-freedom-platform/dashboard/) | Freedom Rings, cross-module reads, AI Advisor panel |
| ⚡ DebtTracker | ✅ v1.5 | [/debt/](https://carterspot.github.io/financial-freedom-platform/debt/) | Unified cards + loans payoff planner |
| 💰 IncomeTracker | ✅ v1.2 | [/income/](https://carterspot.github.io/financial-freedom-platform/income/) | Streams, stability, cash flow |
| 📊 SpendingTracker | ✅ v1.10 | [/spending/](https://carterspot.github.io/financial-freedom-platform/spending/) | Transactions, splits, reconcile, budgets |
| 🏦 SavingsModule | ✅ v1.2 | [/savings/](https://carterspot.github.io/financial-freedom-platform/savings/) | Emergency fund + named goals |
| 📈 RetirementModule | ✅ v1.1 | [/retirement/](https://carterspot.github.io/financial-freedom-platform/retirement/) | 401k/IRA projections + contribution optimizer |
| 💹 InvestmentModule | ✅ v1.1 | [/investment/](https://carterspot.github.io/financial-freedom-platform/investment/) | Portfolio tracking, AI price update |
| 🛡️ InsuranceTracker | ✅ v1.0 | [/insurance/](https://carterspot.github.io/financial-freedom-platform/insurance/) | Policies, Legacy Ring, PIN lock |
| 🧠 AI Advisor | 📋 Planned | — | Capstone — holistic cross-module plan |

**Deprecated** (artifact URLs preserved, removed from landing page; do not extend):
- 💳 CardTracker v3.1 — superseded by DebtTracker
- 🏦 LoanTracker v1.2 — superseded by DebtTracker

---

## Recent Releases

- **2026-04-18** — SpendingTracker v1.10 — transaction splits + standalone Reconcile tab (cross-method post-hoc dedup)
- **2026-04-18** — Dashboard v2.0.1 — split-aware aggregation patch (ST v1.10 compat)
- **2026-04** — Help Wiki scaffold (26 articles at `docs/wiki/`)
- **2026-04** — Dashboard v2.0 — AI Advisor panel, staleness detection, Settings tab
- **2026-04** — InsuranceTracker v1.0, InvestmentModule v1.1, SavingsModule v1.2

See [`docs/whats-new.html`](docs/whats-new.html) for the full release log.

---

## Tech Stack

- **Framework:** React (single-file `.jsx` artifacts)
- **Build:** Vite → static output to `docs/{module}/` → GitHub Pages
- **Styling:** Inline styles with shared `useTheme()` / design tokens — no CSS files, no Tailwind
- **Charts:** SVG only — no external chart libraries
- **Storage:** `window.storage` (Claude artifact cloud) with `localStorage` fallback
- **AI:** Anthropic Messages API (`claude-sonnet-4-20250514`), non-streaming, routed through a Cloudflare Worker proxy
- **Dependencies:** Zero runtime deps beyond React; Vite is build-only

---

## Project Structure

```
financial-freedom-platform/
├── README.md
├── CLAUDE.md                       # Claude Code session context
├── docs/
│   ├── project-instruction.md      # Full architecture + module specs (authoritative)
│   ├── design-system.md            # Theme tokens, component patterns
│   ├── whats-new.html              # Release log
│   ├── pm-dashboard.html           # PM status board
│   ├── index.html                  # Landing page
│   ├── internal/
│   │   ├── CTO-MEMORY.md           # CTO session bootstrap
│   │   └── ffp-cto-SKILL.md        # CTO role definition
│   ├── wiki/                       # 26-article help wiki (Intercom-ready HTML)
│   ├── build-prompts/              # Build prompts authored for Code Clones
│   └── {module}/                   # Built static output served by GitHub Pages
├── modules/
│   ├── dashboard.jsx               # ✅ v2.0
│   ├── debt-tracker.jsx            # ✅ v1.5
│   ├── income-tracker.jsx          # ✅ v1.2
│   ├── spending.jsx                # ✅ v1.10  (no -tracker suffix)
│   ├── savings.jsx                 # ✅ v1.2
│   ├── retirement.jsx              # ✅ v1.1
│   ├── investment.jsx              # ✅ v1.1
│   ├── insurance.jsx               # ✅ v1.0
│   ├── credit-card-tracker.jsx     # 🟡 deprecated
│   ├── loan-tracker.jsx            # 🟡 deprecated
│   └── income-stub.jsx             # 2-line stub (renamed from income.jsx)
└── preview/                        # Vite host for builds
    ├── src/App.jsx                 # Swap import to target module
    └── vite.config.js              # base + outDir per module
```

---

## Deployment

```bash
# 1. preview/src/App.jsx — import the target module
# 2. preview/vite.config.js — set base + outDir to "../docs/{module}"
cd preview && npm run build
# 3. commit modules/{name}.jsx, docs/{module}/, vite.config.js, App.jsx
# 4. push — GitHub Pages auto-deploys in ~60s
```

`outDir` is always `"../docs/{module}"` (one level up from `preview/`), never `"../../docs/{module}"`.

---

## AI Integration

All modules call Anthropic via a Cloudflare Worker proxy. Direct browser calls to `api.anthropic.com` are CORS-blocked from GitHub Pages, localhost, and artifact public URLs — the worker is the permanent solution.

```javascript
const API_URL = "https://ffp-api-proxy.carterspot.workers.dev/";
const MODEL   = "claude-sonnet-4-20250514";
```

- **Headers required:** `Content-Type`, `anthropic-version: 2023-06-01`, and `x-api-key` (sourced from shared `cc_apikey` storage)
- **Non-streaming only** — `await res.json()`. Streaming is unreliable in the artifact sandbox
- **Timeout:** 30s `AbortController`
- **Free tier:** 100k req/day on the worker; SPOF — if the worker is down, all AI features fail. Rollback: restore worker or recreate (~10 min — it's a ~15-line CORS proxy)

---

## Storage Keys

Each module uses a unique prefix; cross-module keys use `ffp_`.

| Prefix | Owner | Notes |
|---|---|---|
| `cc_` | shared platform | profiles, active profile, API key |
| `dt_` | DebtTracker | debt records + `dt_summary_{profileId}` |
| `inc_` | IncomeTracker | streams + `inc_summary_{profileId}` |
| `sp_` | SpendingTracker | transactions, rules, dedup state |
| `sav_` | SavingsModule | goals + `sav_summary_{profileId}` |
| `ret_` | RetirementModule | accounts + `ret_summary_{profileId}` |
| `ins_` | InsuranceTracker | policies + `ins_legacy_health_{profileId}` |
| `ffp_` | shared / cross-module | `ffp_categories_`, `ffp_cat_rules_`, `ffp_baseline_`, `ffp_investments_` |

The Dashboard and AI Advisor read the per-module `*_summary_{profileId}` keys to compose a unified picture without coupling to internal module schemas.

---

## Profile & Identity

All modules share one profile system. A profile has an optional **Recovery PIN** — a memorable word or phrase that becomes the stable storage key, allowing full data recovery on any device without a cloud account.

```json
{
  "id": "pin_smithfamily",
  "name": "Carter",
  "pin": "smithfamily",
  "avatarColor": "#6366f1",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

`cc_apikey` is set once and works across every module.

---

## Critical JSX Rules

Violations crash the artifact renderer. See [`CLAUDE.md`](CLAUDE.md) for the full list.

1. Always `return (` or `return <` with a space — never `return<`
2. Never define JSX-returning functions inside a component — hoist all to top level
3. No `window.confirm()` / `window.alert()` — custom modal components only
4. No streaming AI — `await res.json()` only
5. No `<form>` tags — `onClick` / `onChange` only
6. SVG charts only — no external chart libraries
7. Always use the probe/fallback storage pattern
8. Guard `window.innerWidth` with `typeof window !== 'undefined'`

---

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — Claude Code session context and module map
- [`docs/project-instruction.md`](docs/project-instruction.md) — full architecture, schemas, and module specs (authoritative)
- [`docs/design-system.md`](docs/design-system.md) — theme tokens, component patterns
- [`docs/internal/CTO-MEMORY.md`](docs/internal/CTO-MEMORY.md) — CTO session bootstrap
- [`docs/wiki/`](docs/wiki/) — end-user help articles

---

## Roadmap

- [ ] Wiki content pass — 26 articles, ~4–6 CTO sessions
- [ ] Test persona refresh — exercise SpendingTracker v1.10 splits + reconcilable duplicates
- [ ] AI Advisor capstone — holistic cross-module plan with manual correction layer
- [ ] Graduation — Next.js + Supabase migration (parked)
