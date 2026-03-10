# Financial Freedom Platform — Project Instruction

## Vision
Building a modular, AI-powered personal finance platform called the **Financial Freedom Platform**. The goal is a holistic tool that gives users a complete picture of their financial life and leverages AI to create personalized plans for debt elimination, spending control, savings growth, and retirement readiness.

The platform is built as a collection of standalone Claude artifacts (React .jsx) that share a common design system, data schema, and storage strategy. Eventually they will be unified into a single dashboard, but each module is independently useful and shippable.

---

## Platform Architecture

```
Financial Freedom Platform
├── 💳 CardTracker      (BUILT — v3.1 complete)
├── 🏦 LoanTracker      (BUILT — v1.2 complete)
├── 🏦 DebtTracker      (BUILT — v1.1 complete)
├── 💰 Income Module    (PLANNED — income streams, stability)
├── 📊 Spending Module  (PLANNED — budget, categories, trends)
├── 🏦 Savings Module   (PLANNED — emergency fund, goals)
├── 📈 Retirement Module(PLANNED — 401k, IRA, projections)
└── 🧠 AI Advisor       (PLANNED — holistic cross-module planning)
```

Each module is a self-contained React artifact. The AI Advisor is the capstone — it reads data from all modules and generates a unified financial freedom plan.

---

## Module 1: CardTracker (COMPLETE — v3.1)

### What it is
A credit card debt tracker and payoff planner. Users enter their credit cards, see utilization, track payment due dates on a calendar, and run avalanche/snowball payoff simulations with AI analysis.

### Key features built
- Multi-profile support with Recovery PIN for cross-device data recovery
- Credit card CRUD (add, edit, delete) with color coding
- Portfolio summary dashboard (total balance, credit, utilization bar)
- Payoff schedule modal with avalanche and snowball strategies
- Balance and comparison charts (SVG, no external chart library)
- Calendar view — payment due dates, statement close, payoff dates
- AI Analysis tab — non-streaming Anthropic API call, personalized payoff plan
- What-If AI chat — multi-turn conversation about the user's specific debt
- Strategy Builder — 5-question questionnaire → personalized AI strategy with auto-save
- Apply This Strategy button — applies AI recommendation directly to planner
- Quick Pay (✓ Pay) button — logs payment, updates balance, recalculates instantly
- Progress tracker — payment log per card with actual vs planned
- Export (JSON + CSV) and Import (JSON + CSV, replace or merge)
- Export AI results — copy or download .txt
- Dark/light mode
- Responsive layout (mobile/tablet/desktop) via useBreakpoint() hook
- Cloud storage (window.storage) with localStorage fallback
- Storage probe with 2.5s timeout — gracefully handles login modal dismissal
- API key management — stored in shared cloud storage, one setup for all family members
- ICS calendar export for payment reminders
- Planner settings persist across sessions (extra/mo, lump sums, distribution mode, recalc toggle)
- Lump sum distribution toggle — Priority debt (default) or Split evenly
- ℹ️ tooltip on Recalculate minimums monthly checkbox

### v3.1 bug fixes (March 2026)
- Extra/mo and lump sum values now persist across planner open/close
- Apply button added to Extra/mo field with "Saved ✓" confirmation
- PAID column now correctly shows regularPayment + lumpAmount on LUMP rows
- Individual card pmt sub-line now reflects lump sum in Priority and Split modes
- Recalculate minimums monthly checkbox persists across sessions
- InfoModal component added for ℹ️ tooltip — no window.alert()

### Storage keys (CardTracker)
```
cc_profiles                    (shared) — array of profile objects
cc_active_profile              (shared) — active profile id string
cc_cards_{profileId}           (shared) — array of card objects for that profile
cc_logs_{profileId}            (shared) — payment log entries for that profile
cc_strategy_answers_{profileId}(shared) — saved questionnaire answers
cc_ai_results_{profileId}      (shared) — saved AI analysis + strategy JSON
cc_apikey                      (shared) — Anthropic API key (shared with all modules)
cc_planner_extra_{profileId}   (shared) — saved Extra/mo amount
cc_planner_lumps_{profileId}   (shared) — saved lump sum entries array
cc_planner_lump_mode_{profileId}(shared)— lump distribution: "priority" or "split"
cc_planner_recalc_{profileId}  (shared) — recalculate minimums toggle boolean
cc_dark                        (local)  — dark mode boolean
```

### Card schema
```json
{
  "id": "m5fz3k2abc",
  "name": "Chase Sapphire",
  "last4": "1234",
  "color": "#6366f1",
  "balance": "2342",
  "limit": "5000",
  "apr": "23.99",
  "minPaymentMode": "auto",
  "minPaymentFixed": "",
  "monthlyPayment": "150",
  "payoffMonths": "",
  "payoffMode": "payment",
  "dueDay": "15",
  "statementDay": "8",
  "expiration": "12/27",
  "originalBalance": "2342"
}
```

### Key functions
- `calcMinPmt(balance, apr)` — auto minimum: interest + 1% principal, floor $25
- `calcPayoff(balance, apr, monthlyPmt)` — returns `{ months, totalInterest, totalPaid }`
- `computeSchedule(cards, method, opts)` — full avalanche or snowball schedule
- `generateId()` — `Date.now().toString(36) + Math.random().toString(36).slice(2)`
- `fmt$(n)` — formats number as USD currency string

**Artifact:** `modules/credit-card-tracker.jsx`

---

## Module 2: LoanTracker (COMPLETE — v1.2)

### What it is
An installment loan tracker and payoff planner. Users enter auto loans, mortgages, student loans, personal loans, and other installment debt. Features true amortization math, multi-loan payoff scheduling, AI-powered refinance analysis, and a full What-If chat.

### Key features built
- 5 loan types: Auto, Mortgage, Student, Personal, Other
- Loan CRUD with color coding and type icons
- Auto-calculates monthly payment from balance + rate + term
- Auto-calculates remaining months from payment + balance + rate
- Color-coded loan panels with progress bars and P&I breakdown
- Quick Pay (✓ Pay) — logs payment, updates balance, recalculates remaining months, auto-logs to Progress tab
- Expand/collapse all loans
- Summary dashboard — total debt, monthly payments, total paid down, progress bar
- Loan type breakdown badges
- Planner settings persist across sessions (extra/mo, lump sums, distribution mode, recalc toggle)
- Lump sum distribution toggle — Priority loan (default) or Split evenly
- ℹ️ tooltip on Recalculate minimums monthly checkbox
- Responsive Payoff Accelerator panel in Single Loan tab

### Payoff Planner (6 tabs)
- **Schedule** — Avalanche vs Snowball, payoff order, month-by-month table, extra budget + lump sum, AI analysis
- **Single Loan** — amortization schedule with CSV export, balance chart, independent extra/lump sum controls
- **Charts** — comparison chart + per-loan balance over time (SVG)
- **Refinance AI** — new rate/term/costs → instant preview + AI recommendation
- **What-If AI** — multi-turn chat with loan context
- **Progress** — milestone badges, actual vs planned payment log

### v1.1 bug fixes
- Profile ID now uses stable PIN-based format (`pin_smithfamily`) for cross-module recovery
- Single Loan tab derives live data from validLoans on every render (stale snapshot fixed)
- Charts tab no longer incorrectly applies lump sums to every individual loan chart
- Interest Saved label now dynamically shows which method actually wins
- Mobile backup button now visible on all screen sizes
- Quick Pay auto-logs to Progress tab
- Excluded loans warning banner in planner header

### v1.2 bug fixes (March 2026)
- Extra/mo and lump sum values now persist across planner open/close (Schedule + Single Loan tabs)
- Apply button added to Extra/mo field in both tabs with "Saved ✓" confirmation
- PAID column now correctly shows regularPayment + lumpAmount on LUMP rows in both tabs
- Individual loan pmt sub-line now reflects lump sum in Priority and Split modes
- Recalculate minimums monthly checkbox persists across sessions (Schedule tab)
- InfoModal component added for ℹ️ tooltip — no window.alert()
- Payoff Accelerator panel is fully responsive on small screens (Single Loan tab)

### Storage keys (LoanTracker)
```
lt_loans_{profileId}             (shared) — array of loan objects
lt_logs_{profileId}              (shared) — payment log entries
lt_ai_results_{profileId}        (shared) — saved AI payoff analysis
lt_planner_extra_{profileId}     (shared) — saved Extra/mo (Schedule tab)
lt_planner_lumps_{profileId}     (shared) — saved lump sum entries (Schedule tab)
lt_planner_lump_mode_{profileId} (shared) — lump distribution: "priority" or "split"
lt_planner_recalc_{profileId}    (shared) — recalculate minimums toggle boolean
lt_single_extra_{profileId}      (shared) — saved Extra/mo (Single Loan tab)
lt_single_lumps_{profileId}      (shared) — saved lump sum entries (Single Loan tab)
lt_single_lump_mode_{profileId}  (shared) — Single Loan lump distribution mode
cc_profiles                      (shared) — SHARED with CardTracker
cc_active_profile                (shared) — SHARED with CardTracker
cc_apikey                        (shared) — SHARED with CardTracker (one key for all modules)
lt_dark                          (local)  — dark mode boolean
```

### Loan schema
```json
{
  "id": "m5fz3k2abc",
  "name": "Toyota Camry",
  "lender": "Chase Auto",
  "type": "auto",
  "color": "#3b82f6",
  "originalBalance": "25000",
  "currentBalance": "18500.00",
  "interestRate": "6.900",
  "monthlyPayment": "485.00",
  "termMonths": 60,
  "remainingMonths": "42",
  "nextPaymentDay": "15",
  "notes": ""
}
```

### Key functions
- `calcMonthlyPayment(balance, annualRate, months)` — standard amortization formula
- `calcRemainingMonths(balance, annualRate, payment)` — remaining term from payment
- `amortizeLoan(loan, extraMonthly, lumpSums)` — single-loan full amortization schedule
- `computeMultiSchedule(loans, method, opts)` — multi-loan avalanche or snowball

### Pinned for future upgrade
- Mortgage equity panel (home value input → equity %, progress bar) — deferred, not in v1

**Artifact:** `modules/loan-tracker.jsx`

---

## Module 3: DebtTracker (IN PROGRESS)

Unified merge of CardTracker + LoanTracker. All debt types in one artifact with a unified avalanche/snowball planner across cards and loans.

### Architecture approved (March 2026)
- Card and loan schemas stay separate in storage — no migration of existing data
- Runtime normalizer function converts both types to `{ balance, rate, minPayment }` for the unified payoff engine — not persisted
- Unified schedule loop: revolving math for cards, amortization for loans, waterfall across both

### Approved tab structure
Schedule / Single Debt / Charts / Refinance AI / What-If AI (Strategy Builder folded in) / Progress

### Approved decisions
- **Q1 Strategy Builder:** Folded into What-If AI tab as collapsible "Build My Strategy" panel
- **Q2 Debt list ordering:** Grouped by default (cards then loans) with toggle to interleave by APR
- **Q3 ICS calendar:** Preserved and extended to cover loan nextPaymentDay
- **Q4 dt_ai_results structure:** `{ scheduleAnalysis, refinance: { [loanId]: "..." }, strategy }`
- **Q5 Migration timing:** Banner on first load if cc_cards_* or lt_loans_* detected — dismissible and non-blocking

### Unified log schema (new — dt_logs_{profileId})
```json
{
  "id": "...",
  "_type": "card|loan",
  "debtId": "...",
  "debtName": "...",
  "debtColor": "...",
  "loanType": "auto",
  "amount": 150,
  "planned": 150,
  "date": "2026-03-10T00:00:00.000Z"
}
```

### Log migration (on first load)
If `dt_logs_*` doesn't exist but `cc_logs_*` does, run one-time migration:
- Convert `month` → `date` (reconstruct from month field)
- Rename `cardId` → `debtId`, `cardName` → `debtName`, `cardColor` → `debtColor`
- Add `_type: "card"`
- Write to `dt_logs_{profileId}`, leave `cc_logs_*` untouched

### Storage keys (DebtTracker)
```
dt_cards_{profileId}             (shared) — card objects (same schema as CardTracker)
dt_loans_{profileId}             (shared) — loan objects (same schema as LoanTracker)
dt_logs_{profileId}              (shared) — unified payment log (new schema above)
dt_ai_results_{profileId}        (shared) — { scheduleAnalysis, refinance, strategy }
dt_planner_extra_{profileId}     (shared) — saved Extra/mo
dt_planner_lumps_{profileId}     (shared) — saved lump sum entries
dt_planner_lump_mode_{profileId} (shared) — "priority" or "split"
dt_planner_recalc_{profileId}    (shared) — recalculate minimums toggle
cc_profiles                      (shared) — SHARED across all modules
cc_active_profile                (shared) — SHARED across all modules
cc_apikey                        (shared) — SHARED across all modules
```

**Planned artifact:** `modules/debt-tracker.jsx`

---

## Module 4: Income Module (PLANNED)

Track all income streams by type, stability, and frequency. Foundation for cash flow analysis.

- Types: W2, self-employment, rental, dividends, side business, benefits, other
- Fields: name, type, amount, frequency, stability rating, after-tax flag, start/end date
- Storage prefix: `inc_`

---

## Module 5: Spending Module (PLANNED)

Budget tracking — category budgets vs actuals. Calculates money available for debt/savings.

- Storage prefix: `sp_`

---

## Module 6: Savings Module (PLANNED)

Emergency fund tracker and named savings goals with target dates and required monthly amounts.

- Storage prefix: `sav_`

---

## Module 7: Retirement Module (PLANNED)

Retirement readiness — balances, contribution rates, employer match, projections, "am I on track?"

- Storage prefix: `ret_`

---

## AI Advisor (PLANNED — capstone)

Reads all modules, generates a holistic financial freedom plan with priority ranking, month-by-month action plan, and scenario modeling.

---

## Shared Design System

```javascript
function useTheme(dm) {
  return {
    bg:     dm ? "#020617"  : "#f1f5f9",
    panelBg:dm ? "#0f172a"  : "#ffffff",
    surf:   dm ? "#1e293b"  : "#f1f5f9",
    deepBg: dm ? "#0a0f1e"  : "#ffffff",
    border: dm ? "#1e293b"  : "#e2e8f0",
    border2:dm ? "#334155"  : "#cbd5e1",
    tx1:    dm ? "#f1f5f9"  : "#0f172a",
    tx2:    dm ? "#94a3b8"  : "#64748b",
    tx3:    dm ? "#475569"  : "#94a3b8",
  };
}
```

**Accent colors:**
- Primary: `#6366f1` (indigo)
- Success: `#10b981` (emerald)
- Warning: `#f59e0b` (amber)
- Danger: `#ef4444` (red)
- Charts: `#ec4899` (pink), `#3b82f6` (blue), `#f97316` (orange)
- AI/strategy: `#8b5cf6` (purple)

**Typography:** `'DM Sans', 'Segoe UI', sans-serif` — monospace for all financial numbers

**Avatar colors:**
```javascript
const AVATAR_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];
```

---

## Shared Storage Strategy

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

async function storeGet(key, shared = false) {
  if (await probeCloudStorage()) {
    try { const r = await window.storage.get(key, shared); return r ? JSON.parse(r.value) : null; }
    catch { _cloudAvailable = false; }
  }
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}

async function storeSet(key, value, shared = false) {
  if (await probeCloudStorage()) {
    try { await window.storage.set(key, JSON.stringify(value), shared); return; }
    catch { _cloudAvailable = false; }
  }
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const hasCloudStorage = () => _cloudAvailable === true;
```

**Storage prefixes:**
- `cc_` — CardTracker
- `lt_` — LoanTracker
- `dt_` — DebtTracker
- `inc_` — Income Module
- `sp_` — Spending Module
- `sav_` — Savings Module
- `ret_` — Retirement Module
- `ffp_` — Shared/cross-module

**Keys shared across ALL modules:**
- `cc_profiles` — profile list
- `cc_active_profile` — active profile id
- `cc_apikey` — Anthropic API key (set once, used everywhere)

---

## AI Integration Pattern

```javascript
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL   = "claude-sonnet-4-20250514";

async function callClaude(apiKey, body) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey && apiKey.trim()) headers["x-api-key"] = apiKey.trim();
  const res = await fetch(API_URL, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res;
}

// Usage (non-streaming only):
const res = await callClaude(apiKey, { model: MODEL, max_tokens: 1000, messages: [...] });
const data = await res.json();
const text = data.content?.[0]?.text || "";
```

- API key stored in `cc_apikey` shared — one setup for all modules
- Never embed key in code — always user-supplied via the 🔑 UI
- Non-streaming only — `await res.json()`, no streaming loops

---

## Critical JSX Rules

These MUST be followed or the artifact crashes with `returnReact is not defined`:

1. **Never `return<` — always `return (` or `return <` with a space**
2. **Never define JSX-returning functions inside a component** — hoist all to top-level
3. **Never use `window.confirm()` or `window.alert()`** — use custom modal components
4. **Never stream AI responses** — use `await res.json()` only
5. **All components are top-level named functions** — no inline/nested definitions
6. **No external chart libraries** — SVG only
7. **No `<form>` tags** — use `onClick`/`onChange`
8. **No localStorage-only storage** — always use the probe/fallback pattern

---

## Development Principles

1. Each module ships independently — fully functional standalone before integration
2. Non-breaking updates — schema changes are additive only, never remove fields
3. Export/import in every module — JSON + CSV from day one
4. Mobile-first — all layouts work on phones via `useBreakpoint()` hook
5. No external dependencies — no npm, no CDN beyond React. SVG charts. Inline styles.
6. Shared profile system — `cc_profiles` / `cc_active_profile` across all modules
7. AI is enhancement, not requirement — everything works without an API key
8. Dark mode everywhere — `useTheme(darkMode)` in every component

---

## Local Development

- **Repo:** `carterspot/financial-freedom-platform` (GitHub)
- **Preview server:** `cd preview && npm run dev` → localhost:5173
- **Switch modules:** edit `preview/src/App.jsx` import line
- **CLAUDE.md:** root of repo — read automatically by Claude Code each session
- **Token limit:** set `CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000` before large builds

---

## Roadmap & Session Log

### Completed
- ✅ CardTracker v1 — core build
- ✅ CardTracker v2 — responsive, ICS calendar, payment tracking
- ✅ CardTracker v3 — Strategy Builder, AI persistence, Apply Strategy, Quick Pay
- ✅ LoanTracker v1 — amortization engine, 6-tab planner, refinance AI, what-if chat, shared profiles + API key
- ✅ LoanTracker v1.1 — PIN profile fix, stale data fix, charts fix, mobile backup, Quick Pay auto-log, excluded loans warning
- ✅ CardTracker v3.1 — planner persistence, lump sum display fixes, distribution toggle, recalc tooltip
- ✅ LoanTracker v1.2 — same planner fixes as CardTracker, responsive Payoff Accelerator
- ✅ CLAUDE.md — added to repo root for Claude Code context
- ✅ Vite preview server — localhost:5173 for local JSX testing
- ✅ DebtTracker architecture — approved, ready to build

### Up Next
- [ ] DebtTracker v1 — unified cards + loans module
- [ ] Agent prompts — parallel builds of Income, Spending, Savings, Retirement modules
- [ ] Platform dashboard — unified entry point linking all modules
- [ ] Graduation — Next.js + Supabase hosted app
- [ ] React Native / Expo — iOS + Android
- [ ] Monetization — freemium, Pro tier, family plan

---

## How to Use This Project

1. This file gives full context — no need to re-explain the vision in new chats
2. Reference the module you're working on by name
3. Attach or paste the current `.jsx` file when making changes
4. Always run the Critical JSX Rules checklist before finalizing any artifact
5. Export a backup before any significant rebuild session
6. `design-system.md` has full component patterns and visual specs
7. Update this file every time a module ships or architecture is approved
