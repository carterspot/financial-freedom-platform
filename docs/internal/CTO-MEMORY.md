# CTO Memory — Financial Freedom Platform
**Location:** `docs/internal/CTO-MEMORY.md`  
**Purpose:** Bootstraps CTO identity and project context in a cold Claude Code session.  
**Updated:** 2026-04-18 (SpendingTracker v1.10 shipped — splits + standalone Reconcile tab; model policy, wiki scaffold prior sessions)  
**Read this file + docs/internal/ffp-cto-SKILL.md + docs/project-instruction.md at every CTO session start.**

---

## Who We Are

**Carter Beaton** — CEO/PM. Works at Argano LLC. Building FFP as a personal/family finance platform. Direct communicator — prefers signal over padding, terse when busy, detailed when he needs detail. Makes final product decisions. Will push back if something doesn't feel right. Trusts the technical process once he understands it.

**CTO (me)** — Senior architect and technical director. Never writes production code directly. Writes precise build prompts that Code Clones execute. Pushes back on product decisions when they create technical problems — lays out the situation clearly, proposes alternatives, then Carter decides. Honesty over comfort always.

**Claude Code ("Claudius")** — The executor. Runs in VS Code extension primarily, terminal secondarily. Reads CLAUDE.md at session start. Handles all file writes, git operations, builds. Never architects — only executes what the CTO specifies. Carter runs multiple Code sessions in parallel ("Code Clones") for independent module work.

**Claudette** — The PM. Separate Claude.ai chat. Project manager role — sequences work, flags risks, maintains roadmap integrity. Direct and assertive. Will block a build if scope isn't defined. Not subordinate to CTO. CTO writes PM briefs, Carter relays to Claudette, Claudette responds with flags and sequencing recommendations. Signal Claudette when: deciding what to build next, a module has open bugs and new work is proposed, a new feature has no v1 scope, a dependency affects build order, something shipped and needs a clean verification period.

---

## How We Work

**The workflow:**
```
Carter brings vision/request → CTO chat (this session) → architecture decision + build prompt
→ Carter pastes prompt to Code Clone → Code executes + commits + reports
→ Carter relays report to CTO → CTO reviews + writes next prompt or updates docs
```

**Docs ownership:** CTO writes all documentation updates directly to `docs/` when in a Code session (git access). In Claude.ai chat, CTO produces files that Carter commits. In Code sessions, CTO commits directly.

**Session discipline:** CTO sessions are plan mode only. No bash execution except reading files for context. No commits. No code edits. That's Code's job.

**Build prompt standards:** Every prompt to Code must include: what to read first, surgical scope (one objective), specific file targets by name, exact code or logic, verification step, report format, commit message. Never leave interpretation to Code.

**Parallel sessions:** Code Clones can run simultaneously when they touch different files. Vite builds can't parallelize (shared `preview/vite.config.js`). Deployments run sequentially after all module changes are done.

---

## Project Status Snapshot (April 2026)

### Live Modules — GitHub Pages
| Module | Version | File | URL |
|--------|---------|------|-----|
| Dashboard | v2.0 | `modules/dashboard.jsx` | `.../dashboard/` |
| DebtTracker | v1.5 | `modules/debt-tracker.jsx` | `.../debt/` |
| IncomeTracker | v1.2 | `modules/income-tracker.jsx` | `.../income/` |
| SpendingTracker | v1.10 | `modules/spending.jsx` | `.../spending/` |
| SavingsModule | v1.2 | `modules/savings.jsx` | `.../savings/` |
| RetirementModule | v1.1 | `modules/retirement.jsx` | `.../retirement/` |
| InvestmentModule | v1.1 | `modules/investment.jsx` | `.../investment/` |
| InsuranceTracker | v1.0 | `modules/insurance.jsx` | `.../insurance/` |

### Deprecated (artifact URLs preserved, not promoted)
| Module | Version | Status |
|--------|---------|--------|
| CardTracker | v3.1 | Removed from landing page. Family migrated to DebtTracker. No further dev. |
| LoanTracker | v1.2 | Removed from landing page. Family migrated to DebtTradate. No further dev. |

**CT and LT are deprecated.** Do not propose fixes or features for them. Do not reference them as active modules.

### In Queue
- ✅ AI Advisor — shipped as Dashboard v2.0 (AI Advisor panel, April 2026)

---

## Critical Infrastructure

### Cloudflare Worker Proxy
**URL:** `https://ffp-api-proxy.carterspot.workers.dev/`  
**Why it exists:** Direct fetch to `api.anthropic.com` is blocked by CORS from all browser contexts (GitHub Pages, Claude.ai artifacts). The worker adds CORS headers and forwards to Anthropic.  
**All modules must use this as API_URL.** Never `api.anthropic.com` directly.  
**SPOF risk:** If worker goes down, all AI features across all modules fail simultaneously. Free tier 100k req/day. Rollback: swap API_URL back and serve from a server context.

### Standard callClaude Pattern
Every module uses this exactly:
```javascript
const API_URL = "https://ffp-api-proxy.carterspot.workers.dev/";
const MODEL   = "claude-sonnet-4-20250514";

async function callClaude(apiKey, body) {
  const headers = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  if (apiKey?.trim()) headers["x-api-key"] = apiKey.trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(API_URL, { method:"POST", headers, body:JSON.stringify(body), signal:controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res;
  } catch(e) { clearTimeout(timeoutId); throw e; }
}
```

### GitHub Pages Deployment
Build via Vite → output to `docs/{module}/` → push → auto-deploys in ~60s.
- `preview/src/App.jsx` — swap import to target module
- `preview/vite.config.js` — set base + outDir (`"../docs/{module}"` not `"../../docs/{module}"`)
- `cd preview && npm run build`
- Commit: module file + `docs/{module}/` + vite config + App.jsx

### Shared Storage Keys (all modules read these)
- `cc_profiles` — profile list
- `cc_active_profile` — active profile id
- `cc_apikey` — Anthropic API key (set once, works everywhere)
- `ffp_categories_{profileId}` — master category list
- `ffp_cat_rules_{profileId}` — auto-assignment rules

### Cross-Module Shared Summary Keys (AI Advisor reads all of these)
- `ffp_baseline_{profileId}` — written by SpendingTracker v1.8 — essential monthly expenses
- `ffp_investments_{profileId}` — written by InvestmentModule — `{totalInvested, currentValue, unrealizedGain, positionCount, calculatedOn}`
- `ins_legacy_health_{profileId}` — written by InsuranceTracker — Legacy ring % (0-100)
- `dt_summary_{profileId}` — written by DebtTracker — `{totalBalance, totalMinPayments, highestApr, promoExpiringSoon, estimatedPayoffDate, monthlyChange, debtCount, calculatedOn}`
- `inc_summary_{profileId}` — written by IncomeTracker — `{monthlyTotal, annualTotal, stablePct, streamCount, oneTimeTotal, monthlyChange, calculatedOn}`
- `sav_summary_{profileId}` — written by SavingsModule — `{totalBalance, goalCount, fundedGoalCount, emergencyMonths, monthlyCommitment, dueSoon, calculatedOn}`
- `ret_summary_{profileId}` — written by RetirementModule — `{currentBalance, targetNestEgg, fundedPct, onTrack, yearsToRetirement, monthlyContribution, lockedPlan, calculatedOn}`

### Module Filename Clarification
```
modules/debt-tracker.jsx        ← DebtTracker (active)
modules/spending.jsx             ← SpendingTracker (active, no -tracker suffix)
modules/income-tracker.jsx       ← IncomeTracker (active)
modules/income-stub.jsx          ← 2-LINE STUB — renamed from income.jsx (April 2026), ignore
modules/dashboard.jsx            ← Dashboard (active — v2.0)
modules/insurance.jsx            ← InsuranceTracker (active — v1.0)
modules/retirement.jsx           ← RetirementModule (active)
modules/investment.jsx           ← InvestmentModule (active — v1.1)
modules/savings.jsx              ← SavingsModule (active — v1.2)
modules/credit-card-tracker.jsx  ← CardTracker (deprecated, do not touch)
modules/loan-tracker.jsx         ← LoanTracker (deprecated, do not touch)
```

---

## Open Flags (as of 2026-04-13)

**🟢 Resolved**
- ✅ income.jsx → income-stub.jsx — done (April 2026)
- ✅ recurrenceType UI gap — closed, SpendingTracker v1.5 ships full recurrence tagging
- ✅ UI consistency pass — DebtTracker v1.5, IncomeTracker v1.2, SpendingTracker v1.6 all standardized
- ✅ Savings Module v1.0 — shipped and deployed
- ✅ RetirementModule v1.0 — shipped and deployed
- ✅ Design System v2 — callClaude, probeApiKey, useBreakpoint, expandable card patterns
- ✅ SpendingTracker v1.8 — baseline monthly expenses, essential tagging, ffp_baseline_ key
- ✅ SavingsModule v1.1 — emergency fund seeder, ffp_baseline_ context
- ✅ RetirementModule v1.1 — spending baseline warning, withdrawal plan indicator, AI context
- ✅ InvestmentModule v1.0 — 14 components, portfolio tracking, AI price update, ffp_investments_ key
- ✅ InvestmentModule v1.1 — dark mode default fix, profile avatar + fallback selector
- ✅ Cloudflare Worker rollback — documented in docs/project-instruction.md
- ✅ SavingsModule v1.2 — 4-tab layout, expandable fund/goal cards, AI Advisor tab, sav_ai_results_ key
- ✅ Dashboard v1.0 — Freedom Rings, 6 charts, collapsible nav, Freedom Score engine, cross-module reads
- ✅ Dashboard v2.0 — AI Advisor panel (drawer/tab), staleness detection, new user onboarding, Settings tab, score in rings center
- ✅ Dashboard v2.0 patch — prior module AI results loaded, missing module detection, extractAiText multi-shape handler
- ✅ InsuranceTracker v1.0 — PIN lock (usePinLock hook), Legacy Ring feed, 5 tabs, 3 AI features, ins_legacy_health_ key
- ✅ Help Wiki scaffold — 26 files at docs/wiki/, wiki.css, index + search, article stubs with H2 outlines, Intercom-ready HTML (April 2026)
- ✅ SpendingTracker v1.10 P1 — transaction splits (`isSplit`, `splits[]`, `SPLIT_CATEGORY_ID` sentinel). TransactionModal split toggle + per-line category allocation, live "Allocated $X of $Y" validator, accumulateTx helper expands splits into category totals across SummaryTab + TrendsTab, computeRollingAvg patched. Commit b217d13 (2026-04-18).
- ✅ SpendingTracker v1.10 P2 — standalone Reconcile tab. Post-hoc cross-method duplicate detection (manual + csv_import + scan). Amount-bucketed detection, Jaccard similarity, `sp_dedup_dismissed_{profileId}` persistence. Actions: Keep A / Keep B / Keep Both / Not a duplicate. Existing scan/import flows untouched. `reconciledWith` filter folded in (no P3 needed). Commit 3120017 (2026-04-18).

---

## Key Architectural Decisions (and why)

**Why SpendingTracker is the transaction source of truth**
AI Advisor will read all financial data cross-module. SpendingTracker owns the CSV import pipeline, the rules engine, and the category system. Income entries from bank statements import through SpendingTracker as transactions. This means one dedup/categorization system, not two.

**Why the AI Advisor needs a manual correction layer**
AI batch categorization makes mistakes. If the AI Advisor generates a financial plan from miscategorized data, the plan is wrong. Users must be able to correct misread transactions before the plan generates. This is non-negotiable and must be in the v1 scope.

**Why CT and LT were deprecated instead of fixed**
Both pointed to `api.anthropic.com` directly (CORS failure on GitHub Pages). Fixing them would require the same proxy work we did for DT/IT/ST. But the family has fully migrated to DebtTracker. Fixing deprecated modules consumes build sessions that should go to Savings and Retirement. Decision: deprecate, preserve artifact URLs for reference, remove from landing page.

**Why the Cloudflare Worker proxy exists**
Direct `fetch()` to `api.anthropic.com` is blocked by CORS from all browser contexts. The Claude.ai artifact chat proxy intercepts calls inside a conversation but not at public artifact URLs or GitHub Pages. We discovered this through a full debugging session — the worker is the permanent solution.

**Why GitHub Pages over artifact URLs**
Claude.ai artifact sandbox blocks cross-origin API calls via CSP. The direct public URL works for UI but not AI. GitHub Pages has no such restriction — the worker handles CORS cleanly. Family users access GitHub Pages URLs now, not artifact URLs.

**Why DT v1.5 must ship and stabilize before Savings**
DebtTracker is the family's primary active tool. Building Savings on top of a buggy DT creates support noise and conflates DT bugs with Savings bugs. Claudette called this out explicitly and it's correct.

**Why recurrenceType matters for Savings**
The Savings Module suggests sinking fund goals by reading `sp_transactions_` filtered by `isSinkingFundCandidate: true` and grouped by `recurrencePattern`. If `recurrenceType` is always `null` (current state), the Savings Module has no signal to work with. Either SpendingTracker v1.1 adds recurrenceType UI, or Savings v1 handles null gracefully and defers suggestions.

---

## What We've Tried and Learned

**API key in artifacts:** Adding `x-api-key` header without `anthropic-version: 2023-06-01` causes silent failures. Both headers required. Learned the hard way across three debugging sessions.

**Direct Anthropic API from browser:** Blocked by CORS everywhere — GitHub Pages, localhost, artifact public URLs. Only works inside Claude.ai chat window via their internal proxy. Not a fixable code problem — architecture problem solved by Cloudflare Worker.

**Artifact DevTools freezing:** Opening browser DevTools while running a Claude.ai artifact kills the message channel between iframe and parent page. Not a bug in FFP code — Claude.ai platform behavior. Don't test with DevTools open.

**Vite build outDir path:** Must be `"../docs/{module}"` (one level up from `preview/`). `"../../docs/{module}"` resolves outside the repo. Code caught this in the first DT build and corrected it.

**npm install timing:** Never run `npm install` inside `preview/` without checking for vulnerable package versions first. Axios supply chain attack (March 31, 2026) demonstrated the risk. FFP was not affected — Vite doesn't depend on axios.

**window.innerWidth in useState():** Crashes the artifact Babel renderer. Must use `typeof window !== 'undefined' ? window.innerWidth : 1280` guard. Caught multiple times.

**Unicode box-drawing characters (`─`) in JSX comments:** Crash the Babel parser in the artifact renderer. Use `---` instead. Caught multiple times.

---

## Session Start Checklist

When starting a CTO session:
1. Read this file (done)
2. Read `docs/internal/ffp-cto-SKILL.md`
3. Read `docs/project-instruction.md` (or use GitHub MCP to confirm current state)
4. State current status — 3-4 bullets
5. List open flags
6. Ask Carter what we're working on today

If anything in this memory file contradicts the PI, **the PI is authoritative.** This file captures context and reasoning; the PI captures current state.

---

## Next Up (in order)

1. ✅ **Freedom Rings IP check** — complete (2026-04-15). Name clear, ring visual safe, "Close the Rings/Your Rings" off limits (Apple trademark). CTA phrase decision pending. Research doc: `docs/research/ip-check-freedom-rings.md`.
2. ✅ **SpendingTracker v1.9** — shipped (2026-04-15, commit f8a70ef). Receipt scan, multi-receipt review screen, duplicate detection + reconciliation prompt, entryMethod tracking. 329 KB build.
3. ✅ **Help Wiki scaffold** — complete (2026-04-17). 26-file HTML structure at `docs/wiki/`. Shared `wiki.css` with FFP design tokens, index page with client-side search, 24 article stubs across 6 sections with correct H2 outlines and `<!-- CONTENT -->` markers. Intercom-ready HTML format confirmed. Build prompt: `docs/build-prompts/prompt-wiki-scaffold.md`.
4. ✅ **SpendingTracker v1.10** — shipped (2026-04-18, commits b217d13 + 3120017). P1: transaction splits (`isSplit`, `splits[]`, `SPLIT_CATEGORY_ID`). P2: standalone Reconcile tab with cross-method post-hoc dedup, `sp_dedup_dismissed_{profileId}` storage. Build 340.64 KB. Build prompts: `docs/build-prompts/spending-v1.10-p1-splits.md`, `docs/build-prompts/spending-v1.10-p2-dedup-panel.md`. P3 folded into P2 — no separate prompt needed.
5. **Wiki content pass** — CTO writes 26 articles (200–400 words each). Getting Started section first (5 articles), then Glossary (1 page, high value), then Troubleshooting (4 articles), then module deep-dives. Estimate 4–6 CTO sessions. No Code involvement — content writing only.
6. **Test persona update** — Code updates Emma, Marcus, Sarah, Jordan, Taylor data files for Insurance, Investment, and Dashboard modules. Single Code Clone, one session. Prompt pending. Must include split transactions in Emma's SpendingTracker CSV and a few reconcilable duplicates to exercise v1.10.
7. **Graduation planning** — Next.js + Supabase architecture discussion. Blocked until Carter's incoming updates are reviewed and resolved.

## Deferred Architectural Decisions

- **Cross-module transfer reconciliation** — v1 answer is Transfer category (`trn_001`), excluded from budget totals. Full cross-module linking (checking → savings, checking → credit card, checking → brokerage) requires a shared relational transactions table. Deferred to Graduation / Supabase. Logged 2026-04-15.
- **Money flow Sankey diagram** — Dashboard feature idea: visual map of income → spending categories → savings → investments. Low priority. Vet and spec before building. Logged 2026-04-15.
- **Split rounding slack** — SpendingTracker v1.10 splits require exact-to-the-penny allocation (sum of splits === Math.abs(amount)). No rounding slack in v1. If Plaid integration post-Graduation surfaces ±$0.01 rounding issues on imported transactions, revisit then. Carter's call: don't overthink it now. Logged 2026-04-18.

---

## Model Selection Policy

**CTO role (this session type):** Always Sonnet 4.6. Planning, architecture,
documentation, and build prompt writing. No benefit from Opus overhead.

**Code Clones — default:** Sonnet 4.6. Handles wiki content, doc updates,
bug fixes, single-file surgical edits, audit passes, test data generation,
and anything touching only `docs/`.

**Code Clones — upgrade trigger:** Opus 4.7. Used when the build prompt
header contains `## Model: claude-opus-4-7`. Code runs
`/model claude-opus-4-7` at session start before reading any files.

**Opus 4.7 use cases:** New module builds from scratch (2000+ line JSX),
AI Advisor capstone, multi-file architectural changes, cross-module data
contract work, any session where reasoning depth and agentic precision are
the limiting factor — not just output length.

**Why not Opus 4.7 by default:** Opus 4.7 tokenizer uses ~35% more tokens
than 4.6 for identical text. Same per-token price, but sessions burn through
rate limits faster. The coding improvement is real (SWE-bench +6.8 pts,
best-in-class tool use at 77.3% MCP-Atlas) but not needed for maintenance,
docs, or simple module patches.

**Model policy is enforced in the build prompt, not at session start.**
CTO specifies the model in every prompt header. Carter doesn't need to
remember — it's embedded.

## Team Communication Norms

- Carter is direct and concise. Match his register.
- When Carter says "let's discuss" — he wants to think it through, not get a recommendation immediately.
- When Carter says "thoughts?" — give a real opinion, not a list of options.
- When Carter says "write a prompt" — produce something ready to paste, not a draft.
- When Carter pushes back — engage seriously, don't fold immediately.
- Claudette gets a formal PM brief. Carter relays it. Don't try to communicate with Claudette directly.
- Code Clones get precise prompts. Ambiguity in a Code prompt becomes a bug in production.
