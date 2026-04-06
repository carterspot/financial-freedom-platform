# Build Prompt: RetirementModule v1.0

Build `modules/retirement.jsx` — a brand new module. Self-contained React artifact,
no npm dependencies. Follow all FFP platform patterns exactly.

Read `docs/internal/ffp-cto-SKILL.md` for platform constraints before writing any code.

---

## What this module does

Answers one question: "Am I saving enough to retire at the age I want?"

Users enter their retirement accounts and Social Security estimate. The module projects
their balance at retirement, compares it against multiple withdrawal-rule benchmarks,
shows an on-track assessment, and provides AI analysis with recommendations.

---

## File

`modules/retirement.jsx` — version v1.0

---

## All components (top-level named functions only — never nested)

- `RetirementModule` — root component
- `useTheme(dm)` — theme tokens (copy exact pattern from ffp-cto-SKILL.md)
- `useBreakpoint()` — responsive hook (copy exact pattern)
- `probeCloudStorage / storeGet / storeSet / hasCloudStorage` — storage layer (copy exact pattern)
- `NavBar` — toolbar: Screen → Backup/Restore (floppy) → API (key) → Profile Initials
- `ProfileDropdown` — profile switcher with Edit + Add New Profile
- `ProfileModal` — edit/add profile (name, avatar color picker, optional PIN)
- `ApiKeyModal` — enter/update Anthropic API key
- `FirstRunSetup` — shown when no profile exists; creates first profile
- `AccountCard` — displays one retirement account with balance, contribution, match details
- `AddAccountModal` — create/edit any account type
- `AssumptionsPanel` — smart defaults with sliders and explanations
- `ProjectionChart` — SVG line chart: projected balance over time vs target line
- `PlanComparisonTable` — side-by-side table of all withdrawal rules
- `SocialSecurityPanel` — SS estimate input and monthly income display
- `AiAnalysisTab` — retirement readiness assessment + recommendations
- `BackupRestorePanel` — JSON + CSV export/import (replace or merge)
- `ConfirmModal` — for destructive actions (no window.confirm)

---

## Tab layout (3 tabs)

```
[Overview]  [Accounts]  [Plan & AI]
```

### Overview tab
- On-track gauge — large visual: Green (on track), Amber (close), Red (behind)
  Based on: projected balance at retirement ≥ required nest egg for locked plan
- 4-stat row: Projected Balance | Required Nest Egg | Monthly Gap/Surplus | Years to Retirement
- Social Security panel — guaranteed monthly income, reduces required nest egg
- Quick summary of accounts (count + total balance)
- "Set Up Your Plan" CTA if no locked plan selected yet

### Accounts tab
- List of AccountCards grouped by tax treatment:
  - Tax-Deferred (401k, Traditional IRA, 403b)
  - Tax-Free (Roth 401k, Roth IRA)
  - Other (HSA, Pension, Social Security)
- Each AccountCard shows: type badge, name, current balance, annual contribution,
  employer match (if applicable), projected contribution at retirement
- [+ Add Account] button
- Total balance across all accounts (monospace, large)

### Plan & AI tab
Two sections:

**Section 1 — Assumptions & Projections**
- AssumptionsPanel: sliders for return rate, inflation, salary growth + current age input
- ProjectionChart: SVG line chart, current age → retirement age
  - One line: projected balance (grows with contributions + returns)
  - One line (dashed): required nest egg for locked plan
  - Shaded area: gap or surplus
  - Click year on chart → shows balance and gap at that point

**Section 2 — Withdrawal Plan Comparison**
- PlanComparisonTable: 4 columns (4% Rule | 3.3% Rule | 5% Rule | Custom %)
  Each column shows:
  - Rule name + one-sentence explanation
  - Required nest egg
  - Monthly income it would generate from projected balance
  - On track? (✓ or ✗ with projected surplus/gap)
  - [Lock This Plan] button → saves to ret_profile_.lockedPlan
- Active/locked plan highlighted with accent border

**Section 3 — AI Analysis**
- [Analyze My Retirement] button → calls Claude
- Shows: overall assessment, top 3 actionable recommendations
- Recommendations focus on: contribution rate changes, employer match optimization,
  account type allocation, Social Security timing, plan selection
- Save AI results to ret_ai_results_{profileId}
- [Copy] + [Download .txt] buttons on results

---

## Account types and their fields

All accounts share base fields: id, type, name, color, currentBalance, notes

Type-specific fields shown in AddAccountModal:

**401k, Roth 401k, 403b:**
- contribType: "percent" | "fixed"
- contribRate: string (% of salary or annual $ amount)
- employerMatch: string (% employer matches)
- employerMatchLimit: string (% of salary up to which employer matches)

**Traditional IRA, Roth IRA:**
- contribType: "fixed" (annual contribution)
- contribRate: string (annual $ amount, max $7,000 for 2026)

**HSA:**
- contribType: "fixed"
- contribRate: string (annual $ amount)
- Note in UI: "HSA funds can be used tax-free for medical expenses in retirement"

**Pension:**
- monthlyBenefit: string (estimated monthly benefit at retirement age)
- Note: no projection math needed — treat as fixed monthly income like Social Security

**Social Security:**
- estimatedMonthlyBenefit: string (from SSA.gov estimate)
- ssBenefitAge: string (age they plan to claim: "62" | "67" | "70")
- Note in UI: "Get your estimate at ssa.gov/estimator"

---

## Projection math

```javascript
// Compound growth with annual contributions
function projectBalance(accounts, profile, assumptions) {
  const { currentAge, retirementAge, annualSalary } = profile;
  const { returnRate, salaryGrowthRate } = assumptions;
  const years = retirementAge - currentAge;
  const r = returnRate / 100;
  const g = salaryGrowthRate / 100;

  let balance = 0;
  // Sum current balances (exclude pension + SS — shown separately)
  accounts.filter(a => !["pension","socialsecurity"].includes(a.type))
    .forEach(a => balance += parseFloat(a.currentBalance || 0));

  const yearlyData = [{ age: currentAge, balance }];

  for (let y = 1; y <= years; y++) {
    // Annual contributions across all accounts
    let annualContrib = 0;
    accounts.filter(a => !["pension","socialsecurity"].includes(a.type)).forEach(a => {
      const rate = parseFloat(a.contribRate || 0);
      const salary = annualSalary * Math.pow(1 + g, y);
      if (a.contribType === "percent") {
        annualContrib += (rate / 100) * salary;
        // Add employer match (capped at matchLimit)
        const matchLimit = parseFloat(a.employerMatchLimit || 0);
        const matchRate = parseFloat(a.employerMatch || 0);
        const effectiveContrib = Math.min(rate, matchLimit);
        annualContrib += (matchRate / 100) * (effectiveContrib / 100) * salary;
      } else {
        annualContrib += rate;
      }
    });
    balance = balance * (1 + r) + annualContrib;
    yearlyData.push({ age: currentAge + y, balance });
  }
  return yearlyData;
}

// Required nest egg per plan
function requiredNestEgg(targetMonthlyIncome, monthlySSIncome, withdrawalRate) {
  const annualFromNestEgg = (parseFloat(targetMonthlyIncome) - monthlySSIncome) * 12;
  return Math.max(0, annualFromNestEgg / (withdrawalRate / 100));
}
```

Withdrawal rules:
```javascript
const PLANS = [
  { id:"4pct",   label:"4% Rule",      rate:4.0, desc:"Classic safe withdrawal rate. Proven to last 30 years in most market conditions." },
  { id:"3pct",   label:"3.3% Rule",    rate:3.3, desc:"Conservative choice for retirements of 35+ years or early retirees." },
  { id:"5pct",   label:"5% Rule",      rate:5.0, desc:"Aggressive — best for shorter retirements or higher risk tolerance." },
  { id:"custom", label:"Custom %",     rate:null, desc:"Set your own withdrawal rate." },
];
```

---

## Assumptions panel — sliders

```
Expected Annual Return  [──●────────────] 7%   "Historical US stock market average"
Inflation Rate          [──●────────────] 3%   "Long-term US average"
Salary Growth Rate      [──●────────────] 3%   "Average annual raises"
```

Slider ranges: return 1–15%, inflation 0–8%, salary growth 0–10%
Show explanation text under each slider. Changes to sliders immediately recalculate projections.

Current age: number input (required — used for projection math)
Retirement age: number input (default 65)

---

## Social Security panel (Overview tab)

```
📋 Social Security
Estimated monthly benefit: [$____]   Claim age: [62 / 67 / 70]
Get your estimate at ssa.gov/estimator

This amount reduces the nest egg you need to build.
Monthly income needed from savings: $X,XXX/mo
```

If pension accounts exist, add their monthlyBenefit to SS as additional guaranteed income.

---

## AI call

```javascript
const body = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{
    role: "user",
    content: `You are a retirement planning advisor. Analyze this person's retirement situation:

Current age: ${profile.currentAge}
Target retirement age: ${profile.retirementAge}
Annual salary: $${profile.annualSalary}
Target monthly income in retirement: $${profile.targetMonthlyIncome}
Locked plan: ${profile.lockedPlan}

Accounts: ${JSON.stringify(accounts.map(a => ({type:a.type, name:a.name, balance:a.currentBalance, contrib:a.contribRate, match:a.employerMatch})))}

Projected balance at retirement: $${projectedBalance.toLocaleString()}
Required nest egg (${lockedPlan.label}): $${requiredNestEgg.toLocaleString()}
Monthly surplus/gap: $${gap.toLocaleString()}
Social Security monthly estimate: $${ssIncome}

Provide:
1. A direct assessment: are they on track, ahead, or behind?
2. Three specific, actionable recommendations to improve their retirement outcome.
Keep it concise, plain language, no jargon. Be direct.`
  }]
};
```

---

## Storage keys

```
ret_accounts_{profileId}     (shared) — array of account objects
ret_profile_{profileId}      (shared) — { currentAge, retirementAge, annualSalary, targetMonthlyIncome, lockedPlan }
ret_assumptions_{profileId}  (shared) — { returnRate, inflationRate, salaryGrowthRate }
ret_ai_results_{profileId}   (shared) — saved AI analysis text
ret_dark                     (local)  — dark mode boolean
cc_profiles                  (shared) — SHARED across all modules
cc_active_profile            (shared) — SHARED across all modules
cc_apikey                    (shared) — SHARED across all modules
```

---

## Backup/Restore

- JSON: exports ret_accounts_ + ret_profile_ + ret_assumptions_ together
- CSV: two files — accounts CSV and profile/assumptions CSV
- Button labels: "Save Backup", "Restore Backup", "Export CSV", "Import CSV"
- Replace or Merge on import (dedup accounts by id)

---

## Design system tokens (copy exactly)

```javascript
function useTheme(dm) {
  return {
    bg: dm?"#020617":"#f1f5f9", panelBg: dm?"#0f172a":"#ffffff",
    surf: dm?"#1e293b":"#f1f5f9", deepBg: dm?"#0a0f1e":"#ffffff",
    border: dm?"#1e293b":"#e2e8f0", border2: dm?"#334155":"#cbd5e1",
    tx1: dm?"#f1f5f9":"#0f172a", tx2: dm?"#94a3b8":"#64748b", tx3: dm?"#475569":"#94a3b8",
  };
}
const COLOR = {
  primary:"#6366f1", success:"#10b981", warning:"#f59e0b", danger:"#ef4444",
  pink:"#ec4899", blue:"#3b82f6", orange:"#f97316", purple:"#8b5cf6", teal:"#06b6d4",
};
const AVATAR_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];
```

Module accent color: `#f59e0b` (amber) — use for on-track gauge, badges, and highlights.

---

## JSX rules (non-negotiable)

- Always `return (` or `return <` with a space — never `return<`
- ALL components listed above are top-level — never define JSX-returning functions inside a component
- No `window.confirm()` or `window.alert()` — use ConfirmModal
- No streaming AI — `await res.json()` only
- No `<form>` tags — use `onClick`/`onChange`
- SVG only — no external chart libraries
- Always use probe/fallback storage pattern
- No Unicode box-drawing chars in comments (use --- not ---─── )
- No `window.innerWidth` in useState initializer — use `() => typeof window !== 'undefined' ? window.innerWidth : 1280`
- No ES2023+ methods: no findLastIndex, toSorted, toReversed, at(-n)

---

## Pre-ship checklist

- [ ] `cd preview && npm run build` — 0 errors, 0 warnings
- [ ] grep -c "return<" modules/retirement.jsx → must be 0
- [ ] grep -c "─" modules/retirement.jsx → must be 0
- [ ] No nested JSX-returning component definitions
- [ ] All financial numbers use monospace font style
- [ ] Empty state renders when no accounts exist
- [ ] Projection chart renders correctly with at least one account
- [ ] All 4 withdrawal plans show in comparison table
- [ ] Lock Plan button saves to ret_profile_.lockedPlan
- [ ] AI analysis fires and displays result
- [ ] Version comment at top: `// RetirementModule v1.0`
- [ ] **Vite deploy:** set `base: "/financial-freedom-platform/retirement/"` and `build.outDir: "../docs/retirement"` in `preview/vite.config.js`, run build, commit `docs/retirement/`, push
