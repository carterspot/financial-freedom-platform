# Financial Freedom Platform — CLAUDE.md
> This file is read automatically by Claude Code at the start of every session.
> Full context: see `project-instruction.md` and `design-system.md` in this repo.

---

## What This Project Is

A modular AI-powered personal finance platform built as standalone React JSX artifacts (Claude artifacts). Each module is independently functional. They share a common design system, profile system, and storage strategy.

**Repo:** `carterspot/financial-freedom-platform`
**Dev preview:** `cd preview && npm run dev` → localhost:5173

---

## Current Module Status

| Module | File | Status |
|--------|------|--------|
| 💳 CardTracker | `modules/credit-card-tracker.jsx` | ✅ Complete — v3 |
| 🏦 LoanTracker | `modules/loan-tracker.jsx` | ✅ Complete — v1.1 |
| 🏦 DebtTracker | `modules/debt-tracker.jsx` | 🔲 Next to build |
| 💰 Income Module | `modules/income-tracker.jsx` | 🔲 Planned |
| 📊 Spending Module | `modules/spending-tracker.jsx` | 🔲 Planned |
| 🏦 Savings Module | `modules/savings-tracker.jsx` | 🔲 Planned |
| 📈 Retirement Module | `modules/retirement-tracker.jsx` | 🔲 Planned |
| 🧠 AI Advisor | — | 🔲 Capstone |

---

## ⚠️ CRITICAL JSX RULES — READ BEFORE WRITING ANY CODE

Violating these crashes the artifact with `returnReact is not defined`. No exceptions.

1. **Never `return<JSX>` — always `return (` or `return <` with a space**
2. **Never define JSX-returning functions inside a component** — hoist ALL to top-level named functions
3. **Never use `window.confirm()`** — use a custom `<ConfirmModal>` component
4. **Never use streaming AI** — use `await res.json()` only, no streaming loops
5. **All components must be top-level named functions** — no nested component definitions
6. **No external chart libraries** — SVG only
7. **No `<form>` tags** — use `onClick`/`onChange` handlers
8. **No localStorage-only storage** — always use the probe/fallback pattern below

---

## Shared Storage Pattern

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

---

## Storage Keys

### Shared across ALL modules (never recreate these)
```
cc_profiles          (shared) — profile array
cc_active_profile    (shared) — active profile id string
cc_apikey            (shared) — Anthropic API key
```

### Per-module prefixes
```
cc_   CardTracker     cc_cards_{id}, cc_logs_{id}, cc_strategy_answers_{id}, cc_ai_results_{id}
lt_   LoanTracker     lt_loans_{id}, lt_logs_{id}, lt_ai_results_{id}
dt_   DebtTracker     dt_cards_{id}, dt_loans_{id}, dt_logs_{id}, dt_ai_results_{id}
inc_  Income          inc_streams_{id}
sp_   Spending        sp_budgets_{id}, sp_actuals_{id}
sav_  Savings         sav_goals_{id}, sav_logs_{id}
ret_  Retirement      ret_accounts_{id}, ret_settings_{id}
ffp_  Cross-module    ffp_dark
```

### Profile ID convention
If user sets a PIN: `id = "pin_" + pin.toLowerCase().replace(/\s+/g, "_")`
This makes IDs stable and recoverable across devices without cloud sync.

---

## AI Integration

```javascript
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL   = "claude-sonnet-4-20250514";

async function callClaude(apiKey, body) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey?.trim()) headers["x-api-key"] = apiKey.trim();
  const res = await fetch(API_URL, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res;
}

// Always non-streaming:
const res  = await callClaude(apiKey, { model: MODEL, max_tokens: 1000, messages: [...] });
const data = await res.json();
const text = data.content?.[0]?.text || "";
```

---

## Design System (Summary)

Full spec in `design-system.md`. Key tokens:

```javascript
function useTheme(dm) {
  return {
    bg:      dm ? "#020617" : "#f1f5f9",
    panelBg: dm ? "#0f172a" : "#ffffff",
    surf:    dm ? "#1e293b" : "#f1f5f9",
    deepBg:  dm ? "#0a0f1e" : "#ffffff",
    border:  dm ? "#1e293b" : "#e2e8f0",
    border2: dm ? "#334155" : "#cbd5e1",
    tx1:     dm ? "#f1f5f9" : "#0f172a",
    tx2:     dm ? "#94a3b8" : "#64748b",
    tx3:     dm ? "#475569" : "#94a3b8",
  };
}

const COLOR = {
  primary: "#6366f1",  // indigo — buttons, highlights
  success: "#10b981",  // emerald — positive, paid off
  warning: "#f59e0b",  // amber — caution
  danger:  "#ef4444",  // red — negative, delete
  pink:    "#ec4899",  // charts
  blue:    "#3b82f6",  // charts
  orange:  "#f97316",  // interest costs
  purple:  "#8b5cf6",  // AI features
  teal:    "#06b6d4",  // savings
};

const AVATAR_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];

// Font: 'DM Sans', 'Segoe UI', sans-serif
// Monospace (all $ amounts): monospace
// Border radius: modals 20px, cards 16px, buttons 10px, inputs 8px, badges 6px
```

---

## Module Shell (start every new module from this)

```jsx
import { useState, useEffect, useRef } from "react";

const MODULE_PREFIX = "xxx_";  // change per module
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL   = "claude-sonnet-4-20250514";
const AVATAR_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const fmt$       = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);

// [paste useTheme, storeGet, storeSet, hasCloudStorage, callClaude from above]

export default function App() {
  const [loading, setLoading]   = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("ffp_dark") !== "false");
  const [apiKey, setApiKey]     = useState("");
  const t = useTheme(darkMode);

  useEffect(() => { localStorage.setItem("ffp_dark", darkMode); }, [darkMode]);

  useEffect(() => {
    async function init() {
      const key = await storeGet(`${MODULE_PREFIX}apikey`, true);
      if (key) setApiKey(key);
      setLoading(false);
    }
    init();
  }, []);

  if (loading) return (/* loading spinner */);

  return (
    <div style={{ minHeight:"100vh", background:t.bg, fontFamily:"'DM Sans','Segoe UI',sans-serif", color:t.tx1 }}>
      {/* Nav, then content */}
    </div>
  );
}
```

---

## Key Schemas

### Profile
```json
{ "id": "pin_smithfamily", "name": "Carter", "avatarColor": "#6366f1", "pin": "smithfamily", "createdAt": "..." }
```

### Card (CardTracker)
```json
{ "id": "...", "name": "Chase Sapphire", "last4": "1234", "color": "#6366f1",
  "balance": "2342", "limit": "5000", "apr": "23.99",
  "minPaymentMode": "auto", "monthlyPayment": "150", "payoffMode": "payment",
  "dueDay": "15", "statementDay": "8", "originalBalance": "2342" }
```

### Loan (LoanTracker)
```json
{ "id": "...", "name": "Toyota Camry", "lender": "Chase Auto", "type": "auto",
  "color": "#3b82f6", "originalBalance": "25000", "currentBalance": "18500",
  "interestRate": "6.900", "monthlyPayment": "485.00", "termMonths": 60,
  "remainingMonths": "42", "nextPaymentDay": "15" }
```

---

## What NOT to Do

```
✗  return<JSX>              → always return (<JSX>) or return <JSX>
✗  window.confirm()         → custom ConfirmModal component
✗  streaming AI             → await res.json() only
✗  JSX function inside component → hoist to top-level
✗  external chart library   → SVG only
✗  <form> tags              → onClick/onChange
✗  localStorage only        → probe/fallback pattern
✗  create own profile system → always use cc_profiles / cc_active_profile
✗  embed API key in code    → always user-supplied via 🔑 UI
```

---

## Before Declaring Any Module Done

Run this checklist:
- [ ] No `return<` anywhere (search: `return<`)
- [ ] No JSX functions defined inside components
- [ ] No `window.confirm()` calls
- [ ] No streaming AI (`while`, `getReader`, `ReadableStream`)
- [ ] All components are top-level named functions
- [ ] Uses `cc_profiles` / `cc_active_profile` (not its own profile system)
- [ ] Export (JSON + CSV) and Import implemented
- [ ] Dark mode via `useTheme(darkMode)` everywhere
- [ ] Mobile layout works (test at 375px width)

---

*Last updated: March 2026 — CardTracker v3 + LoanTracker v1.1 complete*
*Full details: project-instruction.md | Visual spec: design-system.md*
