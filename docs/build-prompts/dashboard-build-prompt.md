# FFP Dashboard — Build Prompt
# Target file: modules/dashboard.jsx
# Deployment: docs/dashboard/

Read CLAUDE.md, docs/project-instruction.md, and docs/internal/ffp-cto-SKILL.md
before starting. Read docs/design-system.md for all token values.

This is a NEW module. Do not modify any existing module files.
Build modules/dashboard.jsx from scratch using the FFP module shell pattern.

---

## OVERVIEW

The Dashboard is a read-only cross-module summary view. It reads data from all
live module storage keys and displays a unified financial picture. It never
writes to any storage key. It is the home screen of the platform.

Storage prefix: `dash_` (dark mode only — everything else is read-only)

Live module URLs (for Launch buttons):
```
Debt:       https://carterspot.github.io/financial-freedom-platform/debt/
Income:     https://carterspot.github.io/financial-freedom-platform/income/
Spending:   https://carterspot.github.io/financial-freedom-platform/spending/
Savings:    https://carterspot.github.io/financial-freedom-platform/savings/
Retirement: https://carterspot.github.io/financial-freedom-platform/retirement/
```

---

## LAYOUT

Three-column grid layout:
```
[NAV SIDEBAR 52px collapsed / 200px expanded] [MAIN CONTENT area]
```

Top nav bar: logo + "Financial Freedom" title + profile pill + API dot

Main content (top to bottom):
1. Freedom Rings tile (center) flanked by 2 stat tiles on each side
2. Alert cards row (2x2 grid)
3. Charts grid (3 top + 3 bottom = 6 charts)

---

## SECTION 1: COLLAPSIBLE SIDEBAR NAV

### Behavior
- Default state: collapsed (52px wide)
- Hover or click toggle button: expanded (200px wide)
- Transition: smooth width animation 200ms ease
- Store collapsed/expanded in localStorage key `dash_nav_collapsed`

### Collapsed state (52px)
Show icon only, with a thin SVG arc ring around each icon representing
the module's health metric (see ring calculations below).
No text labels. No amounts. Just icon + ring.

### Expanded state (200px)  
Show icon + ring + module name + primary metric amount (right-justified).
Profile avatar at top. Settings at bottom.

### Module nav items with ring calculations

Each nav item has:
- Icon (use text emoji, font-size 16px explicitly set)
- SVG ring around the icon (thin, 2px stroke, 28px outer diameter)
- Ring fill = health % (0-100) rendered as arc, clockwise from top
- Module name (expanded only)
- Primary amount (expanded only, right-justified, monospace)

Ring health calculations:

**Debt** (color: #ef4444)
```
health = (originalTotalBalance - currentTotalBalance) / originalTotalBalance * 100
originalTotalBalance = sum of all dt_cards_{id} originalBalance fields +
                       sum of all dt_loans_{id} originalBalance fields  
currentTotalBalance  = sum of current balance/currentBalance fields
```

**Income** (color: #10b981)
```
stableStreams = streams where stabilityRating === "Stable" or "Mostly Stable"
health = (stableStreams.length / totalStreams.length) * 100
primaryAmount = sum of monthly normalized income
```

**Spending** (color: #f97316)
```
currentMonthSpend per category vs ffp_baseline_{id}.breakdown averages
categoriesWithinBudget = categories where currentMonth <= rollingAvg
health = (categoriesWithinBudget / totalCategories) * 100
primaryAmount = total spend this month
```

**Savings** (color: #6366f1)
```
fundedGoals = sav_goals where currentAmount >= targetAmount
health = (fundedGoals.length / totalGoals.length) * 100
primaryAmount = total across all sav_funds balances
```

**Retirement** (color: #8b5cf6)
```
targetNestEgg = ret_profile.targetMonthlyIncome * 12 / (lockedPlanRate/100)
  where lockedPlanRate: four_percent=4, three_point_three=3.3, five_percent=5
currentTotal = sum of ret_accounts currentBalance
health = Math.min((currentTotal / targetNestEgg) * 100, 100)
primaryAmount = currentTotal
```

**Insurance** (color: #06b6d4)
```
Not on current roadmap. Show greyed out, health = 0, no amount.
Label: "Coming soon"
Note: Do NOT add an Insurance module URL — no such module exists or is planned.
```

**Investments** (color: #3b82f6)
```
Module in build (Investment v1.0). Show greyed out for now, health = 0, no amount.
Label: "Coming soon"
When live: read ffp_investments_{id} for portfolio data.
Note: color is blue (#3b82f6) — not amber.
```

### Nav ring SVG pattern (per icon)
```jsx
// 28px container, icon centered, thin arc ring around it
// Use SVG circle with stroke-dasharray/dashoffset for arc
const ringCircumference = 2 * Math.PI * 13; // r=13 for 28px container
const ringOffset = ringCircumference - (health/100 * ringCircumference);

<div style={{position:'relative',width:28,height:28}}>
  <svg style={{position:'absolute',top:0,left:0}} width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="13" fill="none" stroke="#1e293b" strokeWidth="2"/>
    <circle cx="14" cy="14" r="13" fill="none" stroke={color} strokeWidth="2"
      strokeDasharray={ringCircumference} strokeDashoffset={ringOffset}
      strokeLinecap="round" transform="rotate(-90 14 14)"/>
  </svg>
  <div style={{position:'absolute',inset:0,display:'flex',
    alignItems:'center',justifyContent:'center',fontSize:14}}>
    {icon}
  </div>
</div>
```

---

## SECTION 2: FREEDOM RINGS TILE

### Freedom Score calculation (0-100)
```javascript
function calcFreedomScore(debtHealth, incomeHealth, spendingHealth, savingsHealth, retirementHealth) {
  // Weighted composite
  const weights = { debt:30, income:20, spending:20, savings:20, retirement:10 };
  return Math.round(
    (debtHealth * weights.debt +
     incomeHealth * weights.income +
     spendingHealth * weights.spending +
     savingsHealth * weights.savings +
     retirementHealth * weights.retirement) / 100
  );
}
```

When Freedom Score < 100: render **Freedom Rings**
When Freedom Score >= 100: render **Wealth Rings** (same component, different colors/metrics)

### Freedom Rings (Score < 100)

Three concentric rings, outermost to innermost:

**Score ring** (outer, r=82, color: #6366f1)
```
progress = freedomScore / 100
```

**Momentum ring** (middle, r=64, color: #10b981)
```
// Is money moving in the right direction this month?
netPositive = (monthlyIncome - monthlySpending - monthlyDebtPayments) > 0
progress = netPositive ? Math.min((netPositiveAmount / monthlyIncome) * 100 * 3, 100) : 0
```

**Horizon ring** (inner, r=46, color: #f59e0b)
```
// Monthly: did user make planned debt payments this month?
// Read dt_logs_{id} for current month payment entries
plannedPayments = sum of all debt minimums
actualPayments  = sum of dt_logs entries this calendar month
progress = Math.min((actualPayments / plannedPayments) * 100, 100)
```

### Wealth Rings (Score >= 100)

Same geometry, different colors and metrics:

**Growth ring** (outer, r=82, color: #10b981)
```
// Net worth change this month vs last month
// Approximate: sum all asset balances - sum all debt balances
progress = netWorthChangePercent (capped 0-100 for display)
```

**Legacy ring** (middle, r=64, color: #06b6d4)
```
// Insurance coverage completeness
// Not built yet — show at 0%, greyed
progress = 0
```

**Horizon ring** (inner, r=46, color: #8b5cf6)
```
// Retirement on-pace: did user contribute this month?
// Read ret_accounts for contribution rates
onPaceContrib = sum of expected monthly contributions
// Since we don't have transaction history for retirement,
// use: (currentBalance / targetNestEgg) * 100 as proxy
progress = retirementHealth
```

### Ring display
- Freedom Score displayed ABOVE the rings (not inside)
  - Font: 28px, 800 weight, monospace, color #6366f1 (or #10b981 for Wealth)
  - Label below score: "Freedom Score" or "Wealth Score"
- No legend below rings
- Ring stroke-width: 10px for all three rings
- Gap between rings: 18px (r values: 82, 64, 46)
- Hover on each ring → tooltip with ring name + metric detail + "Click for details"
- Click each ring → opens respective module URL in new tab
  - Score ring → debt module
  - Momentum ring → spending module  
  - Horizon ring → debt module (payoff scenarios)

### Flanking stat tiles (2 on each side of rings)

**Left column (top to bottom):**

Tile 1 — Net Position
```
primary: formatted net position (sum of savings + retirement - total debt)
secondary: change vs last month with arrow and color
color: #10b981 if positive, #ef4444 if negative
onClick: window.open(debtUrl)
alt: "Click to view Debt Tracker"
```

Tile 2 — Income
```
primary: monthly normalized income total
secondary: % change vs prior month + dollar delta
color: #10b981
onClick: window.open(incomeUrl)
alt: "Click to view Income Tracker"
```

**Right column (top to bottom):**

Tile 3 — Debt
```
primary: % change in total debt this month (e.g. "↓ 2.3%")
secondary: remaining balance
color: #10b981 if decreasing, #ef4444 if increasing
onClick: window.open(debtUrl)
alt: "Click to view Debt Tracker"
```

Tile 4 — Savings
```
primary: "X of Y" goals funded
secondary: emergency fund coverage in months
  emergencyMonths = totalSavingsBalance / ffp_baseline_.amount
color: #6366f1
onClick: window.open(savingsUrl)
alt: "Click to view Savings Module"
```

**Center — Baseline tile** (below rings, full width of rings column)
```
primary: ffp_baseline_.amount formatted as $/mo
secondary: "income covers baseline ×" + (monthlyIncome/baseline).toFixed(1)
color: #f59e0b
No click target (informational)
alt: "Essential monthly expenses floor from SpendingTracker"
```

---

## SECTION 3: ALERT CARDS

Four alert cards in a 2x2 grid. Read from module data and generate dynamically.

Alert priority logic (generate up to 4, highest priority first):

```javascript
const alerts = [];

// RED alerts (critical)
// Promo APR expiring within 30 days
dt_cards.filter(c => c.promoEndDate && daysUntil(c.promoEndDate) <= 30)
  .forEach(c => alerts.push({
    sev:'red', title:`Promo APR expires in ${daysUntil(c.promoEndDate)} days`,
    body:`${c.name} 0% ends ${c.promoEndDate} · $${c.balance} remaining`,
    href: debtUrl
  }));

// AMBER alerts (attention needed)
// Unreviewed transactions > 5
unreviewedCount = sp_transactions.filter(t => t.needsReview).length
if(unreviewedCount > 0) alerts.push({
  sev:'amber', title:`${unreviewedCount} transactions need review`,
  body:`SpendingTracker · categorization pending`,
  href: spendingUrl
});

// Savings goal due within 30 days
sav_goals.filter(g => g.dueDate && daysUntil(g.dueDate) <= 30)
  .forEach(g => {
    const funded = g.currentAmount >= g.targetAmount;
    alerts.push({
      sev: funded ? 'success' : 'amber',
      title: funded ? `${g.name} ready to pay` : `${g.name} due in ${daysUntil(g.dueDate)} days`,
      body: funded ? `$${g.targetAmount} funded ✓` : `$${g.targetAmount - g.currentAmount} short`,
      href: savingsUrl
    });
  });

// INFO alerts
// Retirement target below baseline
if(ret_profile.targetMonthlyIncome < ffp_baseline_.amount) {
  alerts.push({
    sev:'info',
    title:'Retirement target below spending baseline',
    body:`$${ret_profile.targetMonthlyIncome}/mo target · $${ffp_baseline_.amount}/mo essential floor`,
    href: retirementUrl
  });
}

// Income up/down
if(incomeChangePct > 5) alerts.push({sev:'success',...});
if(incomeChangePct < -5) alerts.push({sev:'red',...});

// Take top 4 by priority (red > amber > info > success)
```

Every alert card:
- `cursor: pointer`
- `onClick: window.open(alert.href)`
- `title` attribute (alt tag): `"Click to view ${moduleName}"`

---

## SECTION 4: CHARTS GRID (3 top + 3 bottom)

All charts are read-only. Every chart card:
- Has a `cursor: pointer` wrapper
- `onClick: window.open(sourceModuleUrl)`  
- `title` attribute identifying the destination module

### Top row

**Chart 1 — Over Budget (spending.jsx source)**
```
Read sp_transactions_{id}
IMPORTANT: Do NOT assume current calendar month. SpendingTracker v1.7+ defaults
to the latest month that contains transaction data. Mirror this behavior:
  const months = [...new Set(transactions.map(t => t.date.slice(0,7)))].sort();
  const activeMonth = months[months.length - 1] || new Date().toISOString().slice(0,7);
Filter transactions to activeMonth, group by categoryId, sum amounts
Compare to ffp_baseline_{id}.breakdown rolling averages
Show top 5 categories by % over average
Ranked by percentage overage descending
Bar color: danger if >40% over, warning if >20%, primary otherwise
onClick → spendingUrl
```

**Chart 2 — Income Trend (income-tracker.jsx source)**
```
Calculate monthly normalized income for Jan, Feb, Mar from inc_streams
(Use startDate/endDate to determine which streams were active each month)
Show 3-month sparkline + current month value + % change delta pill
onClick → incomeUrl
```

**Chart 3 — Debt-to-Income gauge (debt-tracker.jsx + income source)**
```
monthlyDebtPayments = sum of all card/loan minimum payments
monthlyIncome = normalized monthly income total
ratio = monthlyDebtPayments / monthlyIncome
Semicircle gauge, color: green <36%, amber <55%, red >=55%
onClick → debtUrl
```

### Bottom row

**Chart 4 — Savings Goals (savings.jsx source)**
```
Read sav_goals_{id}, show up to 5 goals
Per goal: name, progress bar (currentAmount/targetAmount), % label
Badge if due within 30 days (warn/success)
onClick → savingsUrl
```

**Chart 5 — Retirement Ring (retirement.jsx source)**
```
Semicircle ring showing retirementHealth %
4 stat tiles: current balance, target, years to retire, on-track status
onClick → retirementUrl
```

**Chart 6 — Monthly P&L Waterfall (spending.jsx source)**
```
Toggle: [Category] [Account]

Category mode:
  Income at top, expense categories step down, net at bottom
  Colors per category using FFP accent palette
  
Account mode:
  Income → Credit Cards → Debt Payments → Discretionary Spending
  → Savings (step UP, teal) → Retirement contrib (step UP, purple)
  → Net remaining
  Step-up bars for Savings and Retirement (asset transfers, not expenses)

SVG waterfall chart, dashed connector lines between steps
Net pill at bottom (green if positive, red if negative)
onClick → spendingUrl (category mode) or overview (account mode)
```

---

## SECTION 5: GRACEFUL DEGRADATION

If any module's data is missing from storage:
- Show the tile/chart in a greyed empty state
- Display: "No data yet · Launch [Module Name] to get started"
- Link to the module URL
- Never throw errors or show blank space

If ffp_baseline_ is missing (SpendingTracker v1.8 not run):
- Baseline tile shows "—" with note "Run SpendingTracker to calculate"
- Savings emergency months calculation skipped
- Retirement baseline warning suppressed

---

## SECTION 6: DATA LOADING PATTERN

```javascript
useEffect(() => {
  async function init() {
    // Load profile
    const profs = await storeGet('cc_profiles', true) || [];
    const actId = await storeGet('cc_active_profile', true);
    const key   = await storeGet('cc_apikey', true);
    // probeApiKey: use the canonical pattern from docs/design-system.md
    // (sends a minimal test message to the Cloudflare proxy and resolves "ok" | "invalid" | "error")
    if(key) { setApiKey(key); probeApiKey(key).then(setApiKeyStatus); }

    const id = actId || profs[0]?.id || null;
    setActiveProfileId(id);
    setProfiles(profs);

    if(!id) { setLoading(false); return; }

    // Load all module data in parallel
    const [
      dtCards, dtLoans, dtLogs,
      incStreams,
      spTransactions, baseline,
      savFunds, savGoals,
      retAccounts, retProfile, retAssumptions,
      investments
    ] = await Promise.all([
      storeGet(`dt_cards_${id}`, true),
      storeGet(`dt_loans_${id}`, true),
      storeGet(`dt_logs_${id}`, true),
      storeGet(`inc_streams_${id}`, true),
      storeGet(`sp_transactions_${id}`, true),
      storeGet(`ffp_baseline_${id}`, true),
      storeGet(`sav_funds_${id}`, true),
      storeGet(`sav_goals_${id}`, true),
      storeGet(`ret_accounts_${id}`, true),
      storeGet(`ret_profile_${id}`, true),
      storeGet(`ret_assumptions_${id}`, true),
      storeGet(`ffp_investments_${id}`, true),
    ]);

    // Set all state
    setDtCards(dtCards || []);
    setDtLoans(dtLoans || []);
    setDtLogs(dtLogs || []);
    setIncStreams(incStreams || []);
    setSpTransactions(spTransactions || []);
    setBaseline(baseline || null);
    setSavFunds(savFunds || []);
    setSavGoals(savGoals || []);
    setRetAccounts(retAccounts || []);
    setRetProfile(retProfile || null);
    setRetAssumptions(retAssumptions || null);
    setInvestments(investments || null);

    setLoading(false);
  }
  init();
}, []);
```

Profile switching: on profile change, re-run init() with new profileId.
All module data state resets to [] before re-loading.

---

## SECTION 7: CRITICAL JSX RULES

Follow all rules from docs/design-system.md Critical JSX Rules section:
- return ( with space — never return<
- No nested JSX-returning component definitions
- No window.confirm() or window.alert()
- No streaming AI
- No external chart libraries — SVG only
- No form tags
- useBreakpoint() for responsive layout
- window.innerWidth guard in useState

---

## SECTION 8: DEPLOYMENT

After build passes:

1. In preview/src/App.jsx:
   import App from "../../modules/dashboard.jsx";
   export default App;

2. In preview/vite.config.js:
   base: "/financial-freedom-platform/dashboard/"
   build.outDir: "../docs/dashboard"
   build.emptyOutDir: true

3. cd preview && npm run build
   Verify docs/dashboard/index.html exists

4. git add modules/dashboard.jsx docs/dashboard/ preview/vite.config.js preview/src/App.jsx
   git commit -m "feat: FFP Dashboard v1.0 — Freedom Rings, 6 charts, collapsible nav, cross-module reads"
   git push

---

## REPORT BACK

1. Build result (errors, warnings, bundle size)
2. docs/dashboard/index.html confirmed
3. List any storage keys that returned null during test load
   (indicates which modules haven't been used yet in test profile)
4. Any JSX rule violations caught and fixed
5. Freedom Score calculated from test data — what did it come out to?
6. Do NOT paste the full JSX — it will be read from repo via GitHub MCP

Do NOT modify any existing module files.
Do NOT touch docs/index.html — CTO handles landing page updates.
