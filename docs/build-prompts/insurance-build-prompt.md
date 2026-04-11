# Insurance Tracker — Build Prompt
# Target file: modules/insurance.jsx
# Deployment: docs/insurance/

Read CLAUDE.md, docs/project-instruction.md, and docs/internal/ffp-cto-SKILL.md
before starting. Read docs/design-system.md for all token values.
Read the Module 9: Insurance Tracker section of project-instruction.md carefully
before writing any code.

This is a NEW module. Do not modify any existing module files.
Build modules/insurance.jsx from scratch using the FFP module shell pattern.
Design standard: Dashboard UI (docs/dashboard/) — dark background,
collapsible sidebar pattern, DM Sans, FFP color tokens. This is the first module
built to the new design standard — future modules will migrate to match it.

---

## MODULE OVERVIEW

Insurance Tracker has two purposes:
1. Family emergency vault — all policies, contacts, beneficiaries in one place
2. Legacy ring feed — coverage completeness calculation for Wealth Rings

Storage prefix: ins_

---

## PIN LOCK (highest priority feature — build this first)

Insurance Tracker is the first module with a content-level PIN lock.
Build this as a reusable usePinLock hook other modules can adopt.

### Hook: usePinLock(modulePrefix)
```javascript
// Returns: { locked, unlock, setPin, clearPin, hasPin }
// PIN stored hashed (simple: btoa(pin + profileId) for v1 — not cryptographic,
// but sufficient for beta privacy)

function usePinLock(modulePrefix) {
  const storageKey = `${modulePrefix}_pin_`;  // + profileId appended at call site
  const lockKey    = `${modulePrefix}_locked_`; // localStorage + profileId

  const [locked, setLocked] = useState(true);
  const [hasPin, setHasPin] = useState(false);

  // On load: check if PIN exists and set locked state
  // unlock(enteredPin, profileId): hash enteredPin, compare to stored hash
  //   → if match: setLocked(false), localStorage.setItem(lockKey+profileId, 'false')
  // setPin(newPin, profileId): hash + store, setLocked(false)
  // clearPin(profileId): remove stored hash, setLocked(false)
  // Auto-lock on visibilitychange: document.addEventListener('visibilitychange', ...)
  //   → if document.hidden: localStorage.setItem(lockKey+profileId, 'true'), setLocked(true)
}
```

### PIN lock screen (shown when locked === true && hasPin === true)
```
Full-screen overlay (z-index 2000) over blurred content
Logo + "Insurance Tracker" title
"Enter your PIN to continue" subtitle
4-digit PIN input (individual boxes, auto-advance on digit entry)
"Forgot PIN?" link → shows recovery path
Submit button

Recovery path modal:
  "Enter your profile Recovery PIN to reset your module PIN"
  Recovery PIN input
  On match with cc_profiles[activeProfile].pin:
    clearPin() → setLocked(false) → show "PIN cleared, set a new one in Settings"
```

### PIN setup screen (shown when locked === false && hasPin === false)
```
Show after first load if no PIN set:
  Banner: "Protect your insurance data with a PIN"
  "Set PIN" button → opens SetPinModal
  "Skip for now" → dismisses for session

SetPinModal:
  4-digit PIN entry + confirm entry
  On match: setPin(pin, profileId)
  Cancel: dismiss
```

### Settings tab integration
PIN management lives in the Settings tab:
- "Change PIN" — enter current PIN → enter new PIN
- "Remove PIN" — enter current PIN → clearPin()
- "PIN is active" status indicator (green dot) or "No PIN set" (amber)

---

## DATA MODEL

### Policy schema (ins_policies_{profileId})
```javascript
{
  id: generateId(),
  type: "life",           // life|disability|health|auto|home|renters|umbrella|other
  name: "Term Life — Protective",
  carrier: "Protective Life",
  policyNumber: "TL-123456",
  agentName: "",
  agentPhone: "",
  agentEmail: "",
  source: "personal",     // personal|employer|government|other
  coverageAmount: 500000,
  isApproximate: false,   // true for employer estimates
  premium: 87.50,
  premiumFrequency: "monthly", // monthly|annual|quarterly
  startDate: "2022-01-15",
  endDate: "2042-01-15",  // null for permanent/no-expiry
  notes: "",
  color: "#06b6d4",
  // Life only
  beneficiaries: [
    { name: "", relationship: "", percentage: 100 }
  ],
  // Disability only
  monthlyBenefit: null,
  eliminationDays: null,        // 30|60|90|180
  benefitPeriod: null,          // short_term|long_term|to_age_65
  // Health only
  planType: null,               // HMO|PPO|HDHP|EPO|other
  deductible: null,
  outOfPocketMax: null,
  familyCoverage: null,         // boolean
  // Auto only
  vehicles: [],
  liabilityLimit: null,         // e.g. "100/300/100"
  // Home/Renters only
  dwellingCoverage: null,
  liabilityCoverage: null,
}
```

### Targets schema (ins_targets_{profileId})
```javascript
{
  life: null,         // null = use rule-based (10x annual income)
  disability: null,   // null = use rule-based (60% monthly income)
}
```

---

## LEGACY RING CALCULATION

This is the value this module provides to the Dashboard and Wealth Rings.
Write as a pure exported function so Dashboard can import it (or replicate
it since modules are standalone).

```javascript
function calcLegacyHealth(policies, targets, incomeMonthly) {
  if(!policies?.length || !incomeMonthly) return 0;
  const annualIncome = incomeMonthly * 12;
  const scores = [];

  // Life (40% weight)
  const lifeCoverage = policies
    .filter(p => p.type === 'life' && !p.isApproximate)
    .reduce((s, p) => s + (p.coverageAmount || 0), 0);
  const lifeApprox = policies
    .filter(p => p.type === 'life' && p.isApproximate)
    .reduce((s, p) => s + (p.coverageAmount || 0), 0);
  const lifeTotalEst = lifeCoverage + lifeApprox;
  const lifeTarget = targets?.life || annualIncome * 10;
  scores.push({ w: 40, v: Math.min((lifeTotalEst / lifeTarget) * 100, 100) });

  // Disability (30% weight)
  const disMonthly = policies
    .filter(p => p.type === 'disability')
    .reduce((s, p) => s + (p.monthlyBenefit || 0), 0);
  const disTarget = targets?.disability || incomeMonthly * 0.6;
  scores.push({ w: 30, v: disMonthly > 0 ? Math.min((disMonthly / disTarget) * 100, 100) : 0 });

  // Health — binary (20% weight)
  scores.push({ w: 20, v: policies.some(p => p.type === 'health') ? 100 : 0 });

  // Auto — binary (10% weight)
  scores.push({ w: 10, v: policies.some(p => p.type === 'auto') ? 100 : 0 });

  return Math.round(scores.reduce((s, x) => s + (x.v * x.w / 100), 0));
}
```

Store legacyHealth in `ins_legacy_health_{profileId}` (shared) on every
policy save/delete so the Dashboard can read it without recalculating.

---

## TABS

### Tab 1: Coverage

Policy cards grouped by type. Show type sections only if policies of that
type exist. Each card shows:
- Color swatch + policy name + carrier
- Coverage amount (with ~ prefix if isApproximate)
- Premium + frequency
- Source badge (Personal / Employer / Government)
- Expiry warning if endDate within 90 days (amber) or 30 days (red)
- Edit + Delete buttons

Above the card grid: Coverage Summary bar
- For Life: "$500K of $850K target · gap $350K" with progress bar
- For Disability: "$4,500/mo of $4,250/mo target ✓" in green
- For Health/Auto: "Covered ✓" or "Not covered ⚠" binary pill
- Targets sourced from ins_targets or rule-based calculation
  (requires reading inc_streams to get monthly income — load it in init)

Add policy button: opens AddPolicyModal
- Type selector first (determines which fields to show)
- Quick-select for employer estimates:
  - Life: "1x salary / 2x salary / 3x salary / Custom"
  - Disability: "50% of salary / 60% / 70% / Custom"
  - Selecting a multiplier: sets isApproximate=true, calculates from income

### Tab 2: Beneficiaries

Consolidated view — one card per person who appears as beneficiary
across any policy. Shows:
- Name + relationship
- List of policies they're named on + percentage
- Total coverage they'd receive

Empty state: "No beneficiaries added yet. Add life insurance policies to
see beneficiaries here."

No editing from this tab — edit happens in Coverage tab policy cards.

### Tab 3: Emergency Info

Clean print-friendly layout. A family member should be able to open this
tab and find everything they need if something happens.

For each policy:
- Policy name + type + policy number
- Carrier name + phone
- Agent name + phone + email
- Coverage amount + beneficiaries
- Notes

At top: "Print / Export PDF" button
- Use window.print() with print CSS that hides nav/tabs
- Or download as formatted text file using anchor pattern

Section header: "Share this page with a trusted family member or store
it somewhere they can find it."

### Tab 4: Analysis (AI)

Three AI features. Each has its own sub-section with a run button.

**Coverage Gap Analysis**
Button: "Analyze My Coverage"
Reads: policies + ins_targets + inc_streams (for income)
Prompt includes:
- All policy types and amounts
- Calculated gaps vs targets
- Annual income
- Number of dependents (ask user to input before running — simple input field)
Ask Claude to:
1. Summarize current coverage status
2. Identify the most critical gaps
3. Estimate monthly cost to close each gap (general ranges, not quotes)
4. Prioritize which gap to close first based on financial situation

**Term vs Permanent Analysis**
Button: "Should I Have Term or Permanent Life Insurance?"
Reads: policies + ins_targets_{profileId} + inc_streams_{profileId} + dt_debts_{profileId} + ret_accounts_{profileId}
Prompt includes:
- Current age (from profile if available, otherwise ask)
- Current life insurance type and amount
- Debt load
- Retirement balance and trajectory
Ask Claude to:
- Explain the tradeoffs given this specific situation
- Give a recommendation with reasoning
- Note when circumstances might change the answer

**Quote Comparison**
UI: Input up to 3 quotes manually
Each quote: carrier name, type, coverage amount, annual premium, term (years)
Button: "Compare These Quotes"
Ask Claude to:
- Calculate cost per $1K coverage for each
- Total premium over term
- Which aligns best with stated coverage needs
- Any red flags in the quotes

All AI results: 📋 Copy + ⬇ Download .txt buttons

Persist results: after each analysis runs, store to `ins_ai_results_{profileId}` as an object
keyed by analysis type: `{ gapAnalysis: "...", termVsPermanent: "...", quoteComparison: "..." }`.
Load on init and restore last results into each sub-section so they survive tab switches and
page refreshes. Show timestamp of last analysis below each result.

callClaude pattern: standard proxy URL with anthropic-version header. Non-streaming only —
use `await res.json()`. Never use streaming or ReadableStream in this platform.

---

## NAV BAR

Follow Dashboard UI standard:
- Logo (shield emoji or lock icon) + "Insurance" title
- Cloud sync badge (☁ Cloud Sync / 💾 Local Only)
- PIN status dot (green = PIN active, amber = no PIN set)
- API key button (🔑) with status dot
- Dark mode toggle (🌙/☀) — persists to `ins_dark_{profileId}`
- Backup (💾 floppy icon) — Export JSON only (no CSV for this module)
- Profile avatar dropdown

---

## INIT / DATA LOADING

```javascript
useEffect(() => {
  async function init() {
    // Standard profile load
    const profs  = await storeGet('cc_profiles', true) || [];
    const actId  = await storeGet('cc_active_profile', true);
    const key    = await storeGet('cc_apikey', true);
    if (key) { setApiKey(key); probeApiKey(key).then(setApiKeyStatus); }

    const id = actId || profs[0]?.id || null;
    setActiveProfileId(id);
    setProfiles(profs);
    if (!id) { setLoading(false); return; }

    const [policies, targets, incStreams, pin, aiResults, darkMode] = await Promise.all([
      storeGet(`ins_policies_${id}`, true),
      storeGet(`ins_targets_${id}`, true),
      storeGet(`inc_streams_${id}`, true),   // needed for coverage targets
      storeGet(`ins_pin_${id}`, true),
      storeGet(`ins_ai_results_${id}`, true),
      storeGet(`ins_dark_${id}`, true),
    ]);

    setPolicies(policies || []);
    setTargets(targets || {});
    setIncStreams(incStreams || []);
    setPinHash(pin || null);
    setHasPin(!!pin);
    setAiResults(aiResults || {});
    setDarkMode(darkMode ?? true);  // default dark

    // Recalculate and store legacy health
    const monthlyIncome = calcMonthlyIncome(incStreams || []);
    const legacyHealth = calcLegacyHealth(policies || [], targets || {}, monthlyIncome);
    await storeSet(`ins_legacy_health_${id}`, legacyHealth, true);

    // Check lock state
    const lockState = localStorage.getItem(`ins_locked_${id}`);
    setLocked(lockState !== 'false' && !!pin); // locked if PIN exists and not explicitly unlocked

    setLoading(false);
  }
  init();
}, []);
```

---

## GRACEFUL DEGRADATION

- No income data (IncomeTracker not used): use $0 income, show advisory
  "Add income streams in IncomeTracker for accurate coverage targets"
- No policies: empty state per tab with "Add your first policy" CTA
- PIN not set: show setup banner (dismissible for session)

---

## DEPLOYMENT

After build passes:

1. In preview/src/App.jsx:
   import App from "../modules/insurance.jsx";
   export default App;

2. In preview/vite.config.js:
   base: "/financial-freedom-platform/insurance/"
   build.outDir: "../docs/insurance"
   build.emptyOutDir: true

3. cd preview && npm run build
   Verify docs/insurance/index.html exists

4. git add modules/insurance.jsx docs/insurance/ preview/vite.config.js preview/src/App.jsx
   git commit -m "feat: Insurance Tracker v1.0 — PIN lock, policy vault, coverage gap analysis, Legacy ring feed"
   git push

---

## REPORT BACK

1. Build result (errors, warnings, bundle size)
2. docs/insurance/index.html confirmed
3. PIN lock working — can set PIN, lock, unlock, and recover via Recovery PIN
4. Legacy health calculation confirmed — what does it output with no policies (should be 0)?
5. Any JSX rule violations caught and fixed
6. Do NOT paste full JSX — will be read from repo via GitHub MCP
