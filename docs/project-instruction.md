# Financial Freedom Platform — Project Instruction

## Vision
Building a modular, AI-powered personal finance platform called the **Financial Freedom Platform**. The goal is a holistic tool that gives users a complete picture of their financial life and leverages AI to create personalized plans for debt elimination, spending control, savings growth, and retirement readiness.

The platform is built as a collection of standalone Claude artifacts (React .jsx) that share a common design system, data schema, and storage strategy. Eventually they will be unified into a single dashboard, but each module is independently useful and shippable.

---

## Platform Architecture

```
Financial Freedom Platform
├── 💳 CardTracker      (BUILT — v1 complete)
├── 🏦 DebtTracker      (PLANNED — cards + loans unified)
├── 💰 Income Module    (PLANNED — income streams, stability)
├── 📊 Spending Module  (PLANNED — budget, categories, trends)
├── 🏦 Savings Module   (PLANNED — emergency fund, goals)
├── 📈 Retirement Module(PLANNED — 401k, IRA, projections)
└── 🧠 AI Advisor       (PLANNED — holistic cross-module planning)
```

Each module is a self-contained React artifact. The AI Advisor is the capstone — it reads data from all modules and generates a unified financial freedom plan.

---

## Module 1: CardTracker (COMPLETE)

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
- Strategy Builder — 5-question questionnaire → personalized AI strategy
- Progress tracker — payment log per card
- Export (JSON + CSV) and Import (JSON + CSV, replace or merge)
- Dark/light mode
- Cloud storage (window.storage) with localStorage fallback
- Storage probe with 2.5s timeout — gracefully handles login modal dismissal
- API key management — stored in shared cloud storage, one setup for all family members

### Storage keys (CardTracker)
```
cc_profiles          (shared) — array of profile objects
cc_active_profile    (shared) — active profile id string
cc_cards_{profileId} (shared) — array of card objects for that profile
cc_logs_{profileId}  (shared) — payment log entries for that profile
cc_apikey            (shared) — Anthropic API key
cc_dark              (local)  — dark mode boolean
```

### Profile schema
```json
{
  "id": "pin_smithfamily",
  "name": "Carter",
  "email": "optional@email.com",
  "avatarColor": "#6366f1",
  "pin": "smithfamily",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```
Note: if a PIN is set, id = `"pin_" + pin.toLowerCase().replace(/\s+/g,"_")`. This makes the storage key stable and recoverable on any device without cloud sync.

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
- `minPaymentMode`: `"auto"` (interest + 1% balance, floor $25) or `"fixed"`
- `payoffMode`: `"payment"` (user sets monthly amount) or `"months"` (back-calculates required payment)

### Key functions
- `calcMinPmt(balance, apr)` — auto minimum: interest + 1% principal, floor $25
- `calcPayoff(balance, apr, monthlyPmt)` — returns `{ months, totalInterest, totalPaid }`
- `computeSchedule(cards, method, opts)` — full avalanche or snowball schedule
- `generateId()` — `Date.now().toString(36) + Math.random().toString(36).slice(2)`
- `fmt$(n)` — formats number as USD currency string

### Design system (shared across all modules — see below)
Uses `useTheme(darkMode)` hook returning theme object.

### Critical JSX rules (artifact sandbox constraints)
These rules MUST be followed in every artifact or it will crash with `returnReact is not defined`:
1. **Never write `return<` — always `return (`  or `return <` with a space**
2. **Never define a function inside a component that returns JSX** — even a one-liner. Hoist all JSX-returning functions to top-level named components
3. **Never use `window.confirm()`** — blocked in sandboxed iframes. Use a custom modal component instead
4. **Never use `while(true)` streaming loops** — they freeze in the artifact sandbox. Use non-streaming API calls (`await res.json()`) instead
5. **All components must be top-level named functions** — no nested component definitions

### AI integration
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
- API key stored in `window.storage` shared — one setup for all users of the artifact
- When no key set: features show warning but app still fully functional
- Non-logged-in users: app falls back to localStorage, must enter API key locally

---

## Shared Design System

All modules use this exact theme system for visual consistency:

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

**Accent colors (consistent across all modules):**
- Primary: `#6366f1` (indigo)
- Success/positive: `#10b981` (emerald)
- Warning: `#f59e0b` (amber)
- Danger/negative: `#ef4444` (red)
- Charts/secondary: `#ec4899` (pink), `#3b82f6` (blue), `#f97316` (orange)

**Typography:**
- Font family: `'DM Sans', 'Segoe UI', sans-serif`
- Monospace (numbers/amounts): `monospace`

**Border radius conventions:**
- Cards/panels: `16px`
- Modals: `20px`
- Buttons: `8–10px`
- Badges/pills: `6px`
- Inputs: `8px`

**Avatar/profile colors:**
```javascript
const AVATAR_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];
```

---

## Shared Storage Strategy

All modules use the same storage helper pattern:

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

**Storage key naming convention:** `{modulePrefix}_{dataType}_{profileId}`
- CardTracker prefix: `cc_`
- DebtTracker prefix: `dt_`
- Income Module prefix: `inc_`
- Spending Module prefix: `sp_`
- Savings Module prefix: `sav_`
- Retirement Module prefix: `ret_`
- Shared/cross-module prefix: `ffp_` (Financial Freedom Platform)

---

## Module 2: DebtTracker (PLANNED)

### What it adds over CardTracker
Supports both **credit cards** and **loans** (auto, mortgage, personal, student, HELOC) in a unified debt elimination planner.

### Key differences for loans vs credit cards
| | Credit Card | Loan |
|---|---|---|
| Payment | Variable | Fixed installment |
| Interest | Revolving, daily/monthly | Amortizing (front-loaded) |
| Extra payment | Reduces balance | Reduces principal, shortens term |
| Utilization | Yes | No |
| Progress | Balance vs limit | % of original loan paid off |

### Loan-specific features planned
- Amortization schedule (month-by-month interest/principal split)
- Extra monthly principal payment field
- Side-by-side comparison: with vs without extra payments
- Refinance "what if" calculator
- Unified avalanche/snowball across cards AND loans

### Add Debt entry point
```
+ Add Debt
   ├── 💳 Credit Card  (existing form)
   └── 🏦 Loan         (new form: Auto / Mortgage / Personal / Student / HELOC / Other)
```

### Loan schema (draft)
```json
{
  "id": "loan_abc123",
  "type": "loan",
  "loanType": "auto",
  "name": "Toyota Camry",
  "balance": "18500",
  "originalAmount": "25000",
  "apr": "6.9",
  "fixedPayment": "485",
  "extraPayment": "100",
  "remainingMonths": "48",
  "dueDay": "15",
  "originationDate": "2023-06-01",
  "color": "#3b82f6"
}
```

---

## Module 3: Income Module (PLANNED)

### Purpose
Track all income streams. Categorize by type, stability, and frequency. Foundation for cash flow analysis and "how much can I put toward debt?" calculations.

### Income stream types
- W2 Employment (salary/hourly)
- Self-employment / freelance
- Rental income
- Investment dividends
- Side business
- Government benefits
- Other passive income

### Key fields per stream
- Name, type, amount, frequency (weekly/biweekly/monthly/annual)
- Stability rating (very stable / mostly stable / variable)
- After-tax flag
- Start date, end date (optional — for temporary income)

### Connections to other modules
- Feeds "available extra payment" in DebtTracker
- Feeds "monthly savings capacity" in Savings Module
- Feeds "contribution capacity" in Retirement Module
- AI Advisor uses income stability when recommending strategies

---

## Module 4: Spending Module (PLANNED)

### Purpose
Budget tracking and spending pattern analysis. Not a full transaction importer — focused on category budgets vs actuals.

### Core features planned
- Monthly category budgets (Housing, Food, Transport, etc.)
- Actual vs budgeted tracking
- "Money available for debt/savings" calculation after fixed expenses
- Spending trend charts

---

## Module 5: Savings Module (PLANNED)

### Purpose
Emergency fund tracker and savings goal manager.

### Core features planned
- Emergency fund goal (3mo / 6mo / 12mo expenses — calculated from spending module)
- Named savings goals with target amounts and target dates
- Required monthly savings to hit each goal
- Priority ranking (emergency fund first, then goals)

---

## Module 6: Retirement Module (PLANNED)

### Purpose
Retirement readiness projections and contribution optimization.

### Core features planned
- Current balances (401k, IRA, Roth IRA, pension)
- Contribution rates and employer match
- Projected value at retirement (with inflation adjustment)
- "Am I on track?" assessment
- Contribution optimization vs debt payoff tradeoff analysis

---

## AI Advisor (PLANNED — capstone module)

### Purpose
Holistic AI-powered financial planning that reads across all modules and generates a personalized financial freedom plan.

### What it sees
- Total debt picture (all cards + loans)
- Income streams and stability
- Monthly spending and available cash flow
- Savings status and gaps
- Retirement trajectory

### What it produces
- Priority ranking: "Here's the order to attack your finances"
- Month-by-month action plan
- Scenario modeling: "If you put $X extra toward debt vs savings, here's the 5-year outcome"
- Plain-language explanation of tradeoffs

### AI integration approach
- Non-streaming API calls (streaming is unreliable in artifact sandbox)
- Model: `claude-sonnet-4-20250514`
- Each module sends a structured JSON summary to the advisor
- Advisor prompt includes full cross-module context

---

## Development Principles

1. **Each module ships independently** — fully functional standalone before integration
2. **Non-breaking updates** — storage keys are stable, schema changes are additive (new fields with defaults, never removing fields)
3. **Export/import in every module** — JSON (full backup) + CSV (spreadsheet-friendly) in every module from day one
4. **Mobile-first** — all layouts work on phone screens, touch-friendly tap targets
5. **No external dependencies** — no npm packages, no CDN libraries beyond React. All charts are SVG. All UI is inline styles.
6. **Profile/PIN system** — every module uses the same profile identity so users only set up once
7. **AI is enhancement, not requirement** — every feature works without an API key. AI adds insight, doesn't gate functionality
8. **Dark mode everywhere** — `useTheme(darkMode)` in every component

---

## What NOT to do

- No `while(true)` streaming loops — use `await res.json()` for all AI calls
- No `window.confirm()` — use custom modal components
- No `return<JSX>` without a space — always `return <JSX>` or `return (`
- No JSX-returning functions defined inside other components — always hoist to top level
- No localStorage-only storage — always use the probe/fallback pattern
- No external chart libraries — SVG only
- No form tags — use `onClick`/`onChange` handlers

---

## Session Log

### Session 1 (CardTracker v1)
Built the complete CardTracker application including all core features, AI integration, export/import, profile system with Recovery PIN, and cloud/local storage with graceful fallback.

**Current artifact:** `credit-card-tracker.jsx`
**Status:** Complete and stable. Ready for minor tweaks only.

**Known remaining tweaks (low priority):**
- UI polish pass
- Mobile layout review

### Future Sessions
- [ ] CardTracker minor tweaks (current chat)
- [ ] DebtTracker planning and architecture
- [ ] DebtTracker build — loan form and amortization engine
- [ ] Income Module
- [ ] Spending Module
- [ ] Savings Module
- [ ] Retirement Module
- [ ] AI Advisor (capstone)
- [ ] Platform unification

---

## How to Use This Project

When starting a new chat in this project:
1. This instruction gives full context — no need to re-explain the vision
2. Reference the module you're working on by name
3. Copy the current artifact code into the chat when making changes
4. Always run the Critical JSX Rules checklist before finalizing any artifact
5. Export a backup before any significant rebuild session
