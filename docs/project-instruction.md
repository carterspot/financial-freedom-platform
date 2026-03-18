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
├── ⚡ DebtTracker      (BUILT — v1.1 complete)
├── 💰 IncomeTracker    (BUILT — v1.0 complete)
├── 📊 SpendingTracker  (BUILT — v1.0 complete)
├── 🏦 Savings Module   (PLANNED — emergency fund, goals)
├── 📈 Retirement Module(PLANNED — 401k, IRA, projections)
└── 🧠 AI Advisor       (PLANNED — holistic cross-module planning)
```

Each module is a self-contained React artifact. The AI Advisor is the capstone — it reads data from all modules and generates a unified financial freedom plan.

---

## Artifact URL Strategy

Each module lives in a **dedicated Claude.ai chat**. Editing the artifact in that same chat preserves the URL — no config update needed. Creating a new artifact (new chat) generates a new URL and requires updating the `CONFIG` block in `docs/index.html`.

**Workflow when Code ships an update:**
1. Code updates the `.jsx` in GitHub
2. Open the module's dedicated Claude.ai chat
3. Paste the updated `.jsx` and ask CTO to update the artifact in place
4. URL stays the same — no `index.html` change needed

**If a new artifact is unavoidable:**
1. Render in Claude.ai → share → copy URL
2. Update the one-line `CONFIG` block in `docs/index.html` on GitHub

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

**Artifact:** `modules/loan-tracker.jsx`

---

## Module 3: DebtTracker (COMPLETE — v1.1)

### What it is
Unified merge of CardTracker + LoanTracker. All debt types in one artifact with a unified avalanche/snowball planner across cards and loans.

### Key features built
- Credit card and loan CRUD in a single view
- Grouped by type (cards → loans) with toggle to interleave by APR
- Unified avalanche/snowball payoff engine — revolving math for cards, amortization for loans, waterfall across both
- Portfolio summary dashboard (total debt, monthly payments, estimated interest, payoff date)
- Quick Pay (✓ Pay) for both cards and loans
- Five-tab planner: Schedule / Single Debt / Charts / What-If AI / Progress
- Strategy Builder folded into What-If AI tab as collapsible "Build My Strategy" panel
- One-click import banner — detects existing cc_cards_* or lt_loans_* data on first load
- Backup & Restore — JSON (full) + CSV (cards and loans separately)
- Shared profile and API key system (cc_profiles, cc_apikey)
- Standalone first-run profile creation screen — works without CardTracker/LoanTracker
- Dark/light mode, cloud + localStorage fallback storage

### v1.1 bug fixes (March 2026)
- Added standalone profile creation screen (FirstRunSetup component) — DebtTracker no longer assumes cc_profiles exists from prior modules

### Architecture decisions
- Card and loan schemas stay separate in storage — no migration of existing data
- Runtime normalizer `normalizeDebt()` converts both types to `{ balance, rate, minPayment }` for the unified payoff engine — not persisted
- Unified schedule loop: revolving math for cards, amortization for loans, waterfall across both

### Storage keys (DebtTracker)
```
dt_cards_{profileId}             (shared) — card objects (same schema as CardTracker)
dt_loans_{profileId}             (shared) — loan objects (same schema as LoanTracker)
dt_logs_{profileId}              (shared) — unified payment log (new schema below)
dt_ai_results_{profileId}        (shared) — { scheduleAnalysis, strategy }
dt_planner_extra_{profileId}     (shared) — saved Extra/mo
dt_planner_lumps_{profileId}     (shared) — saved lump sum entries
dt_planner_lump_mode_{profileId} (shared) — "priority" or "split"
dt_planner_recalc_{profileId}    (shared) — recalculate minimums toggle
dt_import_dismissed_{profileId}  (shared) — import banner dismissed boolean
cc_profiles                      (shared) — SHARED across all modules
cc_active_profile                (shared) — SHARED across all modules
cc_apikey                        (shared) — SHARED across all modules
dt_dark                          (local)  — dark mode boolean
```

### Unified log schema
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

**Artifact:** `modules/debt-tracker.jsx`

---

## Module 4: IncomeTracker (COMPLETE — v1.0)

### What it is
Tracks all income streams by type, stability, and frequency. Data-entry only at v1 — no AI tab, no planner. Seeds the shared FFP category system on first run.

### Key features built
- Income stream CRUD (add, edit, delete) with color coding
- 7 income types: W2, Self-Employment, Rental, Dividends, Side Business, Benefits, Other
- 7 frequencies: Weekly, Bi-Weekly, Semi-Monthly, Monthly, Quarterly, Annual, One-Time
- 4 stability ratings: Stable, Mostly Stable, Variable, Irregular (color-coded pill badges)
- After-tax flag, start/end dates, notes, categoryId per stream
- Summary dashboard — total monthly income (normalized), annual total, breakdown by type, stream count
- Frequency → monthly normalization (One-Time excluded from recurring total, shown separately)
- Seeds `ffp_categories_{profileId}` on first run with `DEFAULT_CATEGORIES` constant (56 categories across 13 sections) if empty
- Category picker filtered to `type: "income"` or `type: "both"` from shared category list
- Export JSON + CSV, Import JSON (replace or merge)
- Shared profile + API key system (cc_profiles, cc_apikey)
- Dark/light mode, cloud + localStorage fallback storage

### Frequency multipliers
```
Weekly:       × 4.333
Bi-Weekly:    × 2.167
Semi-Monthly: × 2
Monthly:      × 1
Quarterly:    × 0.333
Annual:       × 0.0833
One-Time:     × 0 (shown separately)
```

### Storage keys (IncomeTracker)
```
inc_streams_{profileId}    (shared) — array of income stream objects
inc_dark                   (local)  — dark mode boolean
cc_profiles                (shared) — SHARED across all modules
cc_active_profile          (shared) — SHARED across all modules
cc_apikey                  (shared) — SHARED across all modules
ffp_categories_{profileId} (shared) — seeded on first run if empty
```

### Income stream schema
```json
{
  "id": "generated",
  "name": "Salary",
  "type": "W2",
  "amount": "5000",
  "frequency": "Monthly",
  "stabilityRating": "Stable",
  "afterTax": true,
  "startDate": "2024-01-01",
  "endDate": "",
  "notes": "",
  "categoryId": "inc_001",
  "color": "#6366f1"
}
```

**Artifact:** `modules/income.jsx`

---

## Module 5: SpendingTracker (COMPLETE — v1.0)

### What it is
Tracks spending transactions via CSV import from any bank or credit card statement. Owns the shared rules engine (`ffp_cat_rules_`) and is the first module to provide full category management UI. AI batch categorization on import, actuals view with 3-month rolling average, and a full rules CRUD interface.

### Key features built
- CSV import — bank statements + credit card statements (any format)
- Column mapper with memory per account — maps source columns to required fields, saved per account nickname
- Sign-flip toggle per account — CC statements flip positive→negative, remembered per account
- Deduplication on import — match by date + description + amount, user chooses skip or overwrite
- AI batch categorization — one API call per import; high-confidence auto-assigns silently, low-confidence → Needs Review queue
- Confirmed review items auto-create rules for next import
- Rules engine — full CRUD for `ffp_cat_rules_{profileId}` (Spending owns this UI)
- AI Suggest Rules — sends unruled transaction descriptions to AI, returns rule suggestions for one-click confirm
- Three-tab layout: Transactions / Summary / Rules
- Transactions tab — monthly view, search by description, filter by category, all on screen
- Summary tab — actuals by category with 3-month rolling average delta (green/amber/red)
- Month selector — prev/next arrows, all views respect selected month
- Category seeding fallback — seeds `ffp_categories_` if Income hasn't run yet
- Export JSON + CSV, Import JSON (replace or merge)
- Shared profile + API key system (cc_profiles, cc_apikey)
- Dark/light mode, cloud + localStorage fallback storage

### Architecture decisions
- Rules run before AI on every import — rule matches auto-assigned, skipped by AI
- Rolling 3-month average computed at display time from stored transactions — never pre-aggregated
- No budget targets at v1 — rolling average IS the implied budget
- Transaction objects carry `isSinkingFundCandidate` and `recurrencePattern` fields for future Savings Module handoff
- localStorage safe for alpha (1–2 accounts, 6–12 months); Supabase trigger at 3+ accounts or 6+ months

### Storage keys (SpendingTracker)
```
sp_transactions_{profileId}    (shared) — array of transaction objects
sp_accounts_{profileId}        (shared) — array of account objects
sp_selected_month_{profileId}  (shared) — currently selected month YYYY-MM
sp_dark                        (local)  — dark mode boolean
cc_profiles                    (shared) — SHARED across all modules
cc_active_profile              (shared) — SHARED across all modules
cc_apikey                      (shared) — SHARED across all modules
ffp_categories_{profileId}     (shared) — SHARED, seed if empty
ffp_cat_rules_{profileId}      (shared) — SHARED, Spending owns CRUD
ffp_import_maps_{profileId}    (shared) — column mapper settings per account
```

### Transaction schema
```json
{
  "id": "generated",
  "accountId": "acc_abc123",
  "date": "2026-03-15",
  "description": "WALMART SUPERCENTER",
  "amount": -84.32,
  "categoryId": "exp_012",
  "categoryLocked": false,
  "ruleId": "rule_abc123",
  "theirCategory": "GROCERIES",
  "notes": "",
  "isSinkingFundCandidate": false,
  "recurrencePattern": "",
  "importedAt": "2026-03-17T00:00:00.000Z"
}
```

### Account schema
```json
{
  "id": "acc_abc123",
  "nickname": "Chase Checking",
  "type": "checking",
  "color": "#3b82f6",
  "flipSign": false,
  "columnMap": {
    "date": "Transaction Date",
    "description": "Description",
    "amount": "Amount",
    "type": "Type",
    "theirCategory": "Category"
  }
}
```

**Artifact:** `modules/spending.jsx`

---

## Module 6: Savings Module (PLANNED)

Emergency fund tracker and named savings goals ("sinking funds") with target dates and required monthly amounts.

- Storage prefix: `sav_`

---

## Module 7: Retirement Module (PLANNED)

Retirement readiness — balances, contribution rates, employer match, projections, "am I on track?"

- Storage prefix: `ret_`

---

## AI Advisor (PLANNED — capstone)

Reads all modules, generates a holistic financial freedom plan with priority ranking, month-by-month action plan, and scenario modeling.

---

## Shared Platform Layer — Categories

Categories are a shared platform layer, not owned by any single module. Every module that tracks transactions reads from the same category list.

### Storage keys
```
ffp_categories_{profileId}   (shared) — master category list
ffp_cat_rules_{profileId}    (shared) — auto-assignment rules
```

### Category schema
```json
{
  "id": "cat_abc123",
  "name": "Groceries",
  "icon": "🛒",
  "color": "#10b981",
  "type": "income | expense | both",
  "parentId": null,
  "isDefault": true,
  "hidden": false,
  "alertEnabled": false,
  "alertConfig": { "pct": 0.10, "orgName": "Church", "orgUrl": "https://..." },
  "sortOrder": 3
}
```

### Auto-assign rule schema
```json
{
  "id": "rule_abc123",
  "pattern": "walmart",
  "matchType": "contains",
  "categoryId": "cat_groceries",
  "field": "name",
  "caseSensitive": false,
  "priority": 1,
  "createdBy": "user | ai"
}
```

### Auto-assign priority
1. User manually sets → locked (`categoryLocked: true`), never overridden
2. Rule match (merchant name pattern) → applied automatically
3. AI suggestion → proposed, user confirms → auto-creates rule
4. Fallback → "Uncategorized"

### AI categorization
- Batch on CSV import — one API call per file, not per item
- AI flags cryptic entries, renames them, categorizes
- User reviews "needs attention" list; confirmed assignments auto-create rules
- Next month's import skips already-ruled items

### Tithe / Charity
- Implemented as a category (`exp_037`) with `alertEnabled: true`
- `alertConfig` holds percentage threshold, org name, and donation URL
- When income is entered, fires notification showing calculated amount + link

### v1 constraints
- Flat categories only — `parentId` reserved for v2 subcategories
- Default category set ships standard (56 categories across 13 sections — hardcoded in `DEFAULT_CATEGORIES` constant in `income.jsx`, also in `docs/ffp-categories.xlsx`)
- AI-personalized taxonomy (Spender vs Saver archetype) is a v2/premium feature

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
- `ffp_` — Shared/cross-module (categories, rules)

**Keys shared across ALL modules:**
- `cc_profiles` — profile list
- `cc_active_profile` — active profile id
- `cc_apikey` — Anthropic API key (set once, used everywhere)
- `ffp_categories_{profileId}` — master category list
- `ffp_cat_rules_{profileId}` — auto-assignment rules

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
9. Category-aware from v1 — every module that handles transactions includes `categoryId` on line items

---

## Repository & Local Development

- **Repo:** `carterspot/financial-freedom-platform` (GitHub)
- **GitHub Pages:** `carterspot.github.io/financial-freedom-platform`
- **Preview server:** `cd preview && npm run dev` → localhost:5173
- **Switch modules:** edit `preview/src/App.jsx` import line
- **CLAUDE.md:** root of repo — read automatically by Claude Code each session
- **Token limit:** set `CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000` before large builds

### docs/ folder
```
docs/
├── index.html              — GitHub Pages landing page (CONFIG block for artifact URLs)
├── whats-new.html          — Release notes for all live modules
├── user-quickstart.html    — CardTracker quick start guide
├── loan-quickstart.html    — LoanTracker quick start guide (hosted as Claude artifact)
├── debt-quickstart.html    — DebtTracker quick start guide
├── income-quickstart.html  — IncomeTracker quick start guide
├── spending-quickstart.html— SpendingTracker quick start guide
├── ffp-categories.xlsx     — Default category set (56 categories, 13 sections)
└── design-system.md        — Full component patterns and visual specs
```

**Updating artifact URLs:** Edit the `CONFIG` block at the top of `docs/index.html` directly on GitHub (pencil icon). One line per module. Takes 30 seconds.

---

## Roadmap & Session Log

### Completed
- ✅ CardTracker v1 — core build
- ✅ CardTracker v2 — responsive, ICS calendar, payment tracking
- ✅ CardTracker v3 — Strategy Builder, AI persistence, Apply Strategy, Quick Pay
- ✅ CardTracker v3.1 — planner persistence, lump sum display fixes, distribution toggle, recalc tooltip
- ✅ LoanTracker v1 — amortization engine, 6-tab planner, refinance AI, what-if chat, shared profiles + API key
- ✅ LoanTracker v1.1 — PIN profile fix, stale data fix, charts fix, mobile backup, Quick Pay auto-log, excluded loans warning
- ✅ LoanTracker v1.2 — same planner fixes as CardTracker, responsive Payoff Accelerator
- ✅ DebtTracker v1 — unified cards + loans, 5-tab planner, strategy builder, import banner, shared profiles
- ✅ DebtTracker v1.1 — standalone profile creation screen (FirstRunSetup)
- ✅ IncomeTracker v1.0 — income stream CRUD, frequency normalization, stability ratings, category seeding
- ✅ SpendingTracker v1.0 — CSV import, column mapper, AI batch categorization, rules engine, actuals + rolling average
- ✅ CLAUDE.md — trimmed for token efficiency, added to repo root
- ✅ Vite preview server — localhost:5173 for local JSX testing
- ✅ GitHub Pages landing page — docs/index.html with module cards, artifact links, QS + What's New buttons
- ✅ What's New page — docs/whats-new.html covering all five live modules
- ✅ Quick start guides — all five live modules have quickstart guides in docs/
- ✅ Default category set — docs/ffp-categories.xlsx (56 categories, 13 sections); hardcoded in income.jsx DEFAULT_CATEGORIES constant
- ✅ Category system architecture — shared platform layer, schemas, auto-assign priority, AI batch categorization design
- ✅ context-mode installed — MCP context virtualization layer, ~98% context savings in Code sessions

### Up Next
- [ ] Family migration from CardTracker/LoanTracker → DebtTracker, then deprecate legacy modules from landing page
- [ ] Savings Module v1 — emergency fund + sinking fund goals
- [ ] Retirement Module v1 — balances, contributions, projections
- [ ] AI Advisor — holistic cross-module planning (capstone)
- [ ] Platform Dashboard — unified entry point linking all modules
- [ ] Graduation — Next.js + Supabase hosted app
- [ ] React Native / Expo — iOS + Android
- [ ] Monetization — freemium, Pro tier, family plan

### Backlog (logged, not scheduled)
- Spender vs Saver archetype — AI Advisor persona system, ties into category taxonomy
- Extra principal payment tracking for LoanTracker
- Mortgage equity panel (home value → equity %, progress bar)
- Plaid / bank import — Phase 4
- CC Rewards tracker
- AI-personalized category taxonomy (v2/premium)

---

## How to Use This Project

1. This file gives full context — no need to re-explain the vision in new chats
2. Reference the module you're working on by name
3. Attach or paste the current `.jsx` file when making changes
4. Always run the Critical JSX Rules checklist before finalizing any artifact
5. Export a backup before any significant rebuild session
6. `docs/design-system.md` has full component patterns and visual specs
7. Update this file every time a module ships or architecture is approved
