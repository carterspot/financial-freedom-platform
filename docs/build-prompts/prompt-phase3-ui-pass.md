# Phase 3 UI Pass — Module Health Ring + Responsive Layout
## Model: claude-sonnet-4-6
## Scope: Pure UI pass — no business logic, no storage schema, no AI feature changes

---

## What this prompt does

Applies two changes to every active FFP module in a single Code session per module:

1. **Module health ring** — a ring indicator showing the module's health % in the nav bar (mobile/portrait) or as a strip below the nav (desktop/landscape).
2. **Responsive layout fixes** — 2×2 stat grid on mobile, 4-in-a-row on desktop, and (DebtTracker only) CC cards + loans side-by-side at ≥768px.

This is a surgical UI pass. **Do not touch**: storage keys, schemas, AI call logic, business calculation functions, payoff engines, CSV import, or any non-UI code.

---

## Breakpoint detection — add this hook to every module

Replace any existing `useBreakpoint` with this exact implementation:

```javascript
function useBreakpoint() {
  const [bp, setBp] = React.useState(() => getBreakpoint());
  function getBreakpoint() {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth;
    const portrait = window.matchMedia('(orientation: portrait)').matches;
    if (w < 768 || (w < 1024 && portrait)) return 'mobile';
    return 'desktop';
  }
  React.useEffect(() => {
    const handler = () => setBp(getBreakpoint());
    window.addEventListener('resize', handler);
    window.matchMedia('(orientation: portrait)').addEventListener('change', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.matchMedia('(orientation: portrait)').removeEventListener('change', handler);
    };
  }, []);
  return bp; // 'mobile' | 'desktop'
}
```

`'mobile'` = mobile phones + portrait tablets (<768px, or <1024px portrait)
`'desktop'` = desktop + landscape tablets (everything else)

---

## Shared components — add these to every module

### 1. Health ring SVG

```javascript
function HealthRingSvg({ pct, size, strokeWidth, color }) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const fs = size <= 42 ? 9 : 11;
  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', flexShrink: 0 }}
      role="img"
      aria-label={`${pct}% health score`}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
      {pct > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash.toFixed(1)} ${(circ - dash).toFixed(1)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
      <text x={cx} y={cy + fs * 0.38} textAnchor="middle"
        fill={color} fontSize={fs} fontWeight="700"
        fontFamily="monospace">
        {pct}%
      </text>
    </svg>
  );
}
```

### 2. Health ring color + label helpers

```javascript
function healthColor(pct) {
  if (pct >= 80) return '#10b981';
  if (pct >= 60) return '#6366f1';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
}
function healthLabel(pct) {
  if (pct >= 80) return 'Excellent';
  if (pct >= 60) return 'On track';
  if (pct >= 40) return 'Needs work';
  return 'Critical';
}
```

### 3. Health dialog (mobile only — slides down from nav)

Add `healthDialogOpen` to the module's top-level state: `const [healthDialogOpen, setHealthDialogOpen] = React.useState(false);`

```javascript
function HealthDialog({ pct, label, desc, onClose, t }) {
  const color = healthColor(pct);
  const SCALE = [
    { range: '80–100%', lbl: 'Excellent', col: '#10b981' },
    { range: '60–79%', lbl: 'On track',  col: '#6366f1' },
    { range: '40–59%', lbl: 'Needs work', col: '#f59e0b' },
    { range: '0–39%',  lbl: 'Critical',  col: '#ef4444' },
  ];
  return (
    <div style={{
      background: t.panelBg, borderBottom: `2px solid ${color}`,
      padding: '16px', animation: 'healthDialogSlide .2s ease'
    }}>
      <style>{`@keyframes healthDialogSlide{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <HealthRingSvg pct={pct} size={52} strokeWidth={4.5} color={color} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color }}>{pct}% — {healthLabel(pct)}</div>
          <div style={{ fontSize: 11, color: t.tx2, marginTop: 2 }}>{label}</div>
        </div>
        <button onClick={onClose} style={{
          marginLeft: 'auto', background: 'none', border: 'none',
          color: t.tx3, fontSize: 20, cursor: 'pointer', lineHeight: 1
        }}>×</button>
      </div>
      <div style={{ fontSize: 12, color: t.tx2, lineHeight: 1.6, marginBottom: 12 }}>{desc}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
        {SCALE.map(({ range, lbl, col }) => (
          <div key={lbl} style={{
            background: t.surf, borderRadius: '0 7px 7px 0',
            borderLeft: `2px solid ${col}`, padding: '6px 8px'
          }}>
            <div style={{ fontSize: 9, color: col, fontWeight: 700 }}>{range}</div>
            <div style={{ fontSize: 10, color: t.tx2, marginTop: 1 }}>{lbl}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, textAlign: 'center' }}>
        <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, cursor: 'pointer' }}>
          View full score breakdown in Dashboard
        </span>
      </div>
    </div>
  );
}
```

### 4. Health strip (desktop only — 42px below nav)

```javascript
function HealthStrip({ pct, label, desc, t }) {
  const color = healthColor(pct);
  const title = `${label}: ${pct}% — ${healthLabel(pct)}. ${desc}`;
  return (
    <div title={title} style={{
      height: 42, background: t.panelBg, borderBottom: `1px solid ${t.border}`,
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0
    }}>
      <HealthRingSvg pct={pct} size={28} strokeWidth={3} color={color} />
      <span style={{ fontSize: 12, color: t.tx2, fontWeight: 600, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'monospace' }}>{pct}%</span>
      <span style={{ fontSize: 11, color }}>{healthLabel(pct)}</span>
      <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 600 }}>Dashboard</span>
    </div>
  );
}
```

---

## Nav bar integration

### Mobile nav — ring button replaces nothing, inserts before backup/API icons

In the mobile nav bar, add the ring button as the first icon after the module title:

```jsx
{bp === 'mobile' && (
  <button
    onClick={() => setHealthDialogOpen(o => !o)}
    style={{ background: 'none', border: 'none', cursor: 'pointer',
             display: 'flex', alignItems: 'center', padding: 0 }}
    aria-label="View health score"
  >
    <HealthRingSvg pct={healthPct} size={40} strokeWidth={3.5} color={healthColor(healthPct)} />
  </button>
)}
```

### Desktop nav — no ring in nav bar (strip handles it)

On desktop the ring does NOT appear in the nav. The strip renders between nav and content.

### Dialog and strip rendering (inside the top-level return, after nav):

```jsx
{bp === 'mobile' && healthDialogOpen && (
  <HealthDialog
    pct={healthPct}
    label={HEALTH_LABEL}
    desc={HEALTH_DESC}
    onClose={() => setHealthDialogOpen(false)}
    t={t}
  />
)}
{bp === 'desktop' && (
  <HealthStrip pct={healthPct} label={HEALTH_LABEL} desc={HEALTH_DESC} t={t} />
)}
```

---

## Stat grid — responsive layout

Replace the existing stat card row/grid with this pattern in every module:

```jsx
<div style={{
  display: 'grid',
  gridTemplateColumns: bp === 'mobile' ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
  gap: 8,
  margin: '12px 16px 0'
}}>
  {/* stat cards */}
</div>
```

**Rule:** always exactly 4 stat cards per module. On mobile they render 2×2. On desktop they render 4-in-a-row. If a module currently shows 3 cards, add a fourth meaningful stat. If it shows more than 4, pick the 4 most important.

---

## Module-specific instructions

### DebtTracker (`modules/debt-tracker.jsx`)

**Health formula:**
```javascript
function calcDebtHealth(cards, loans) {
  const all = [...cards, ...loans].filter(d => !d.closed);
  if (all.length === 0) return 0;
  const totalOrig = all.reduce((s, d) => s + (parseFloat(d.originalBalance) || parseFloat(d.balance) || 0), 0);
  const totalCurr = all.reduce((s, d) => s + (parseFloat(d.balance) || parseFloat(d.currentBalance) || 0), 0);
  if (totalOrig === 0) return 100;
  const paidPct = Math.round(((totalOrig - totalCurr) / totalOrig) * 100);
  return Math.min(100, Math.max(0, paidPct));
}
```

**HEALTH_LABEL:** `'Debt health'`
**HEALTH_DESC:** `'Based on total payoff progress across all debts. Paying down balances raises this score.'`

**Stat cards (4):** Total Debt · Monthly Payments · Est. Interest · Payoff Date

**Two-column debt layout:** Wrap the credit cards section and loans section in a responsive grid:
```jsx
<div style={{
  display: 'grid',
  gridTemplateColumns: bp === 'mobile' ? '1fr' : '1fr 1fr',
  gap: bp === 'mobile' ? 0 : '0 16px',
  padding: bp === 'mobile' ? '0 14px' : '0 16px'
}}>
  <div>{/* credit cards section */}</div>
  <div>{/* loans section */}</div>
</div>
```
Threshold is `bp === 'mobile'` — side-by-side starts at 768px (desktop breakpoint per `useBreakpoint`).

---

### SpendingTracker (`modules/spending.jsx`)

**Health formula:**
```javascript
function calcSpendingHealth(transactions, categories, selectedMonth) {
  const monthTxs = transactions.filter(tx =>
    tx.date && tx.date.startsWith(selectedMonth) && tx.amount < 0
  );
  if (monthTxs.length === 0) return 0;
  const catMap = {};
  monthTxs.forEach(tx => {
    if (!catMap[tx.categoryId]) catMap[tx.categoryId] = 0;
    catMap[tx.categoryId] += Math.abs(tx.amount);
  });
  const threeMonthsAgo = (() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 4, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const histTxs = transactions.filter(tx =>
    tx.date && tx.date >= threeMonthsAgo && tx.date < selectedMonth && tx.amount < 0
  );
  if (histTxs.length === 0) return 50;
  const histMap = {};
  const histMonths = new Set(histTxs.map(tx => tx.date.slice(0, 7)));
  histTxs.forEach(tx => {
    if (!histMap[tx.categoryId]) histMap[tx.categoryId] = 0;
    histMap[tx.categoryId] += Math.abs(tx.amount);
  });
  const nMonths = histMonths.size || 1;
  let within = 0, total = 0;
  Object.keys(catMap).forEach(catId => {
    const avg = (histMap[catId] || 0) / nMonths;
    if (avg > 0) {
      total++;
      if (catMap[catId] <= avg * 1.1) within++;
    }
  });
  return total === 0 ? 50 : Math.round((within / total) * 100);
}
```

**HEALTH_LABEL:** `'Spending health'`
**HEALTH_DESC:** `'% of categories at or within 10% of your 3-month rolling average. Higher means spending is stable.'`

**Stat cards (4):** Income · Expenses · Net · Vs. Avg (current month total vs 3-month average, shown as + or − with color)

---

### IncomeTracker (`modules/income-tracker.jsx`)

**Health formula:**
```javascript
function calcIncomeHealth(streams) {
  const active = streams.filter(s => !s.endDate || new Date(s.endDate) > new Date());
  if (active.length === 0) return 0;
  const stable = active.filter(s => s.stabilityRating === 'Stable' || s.stabilityRating === 'Mostly Stable');
  return Math.round((stable.length / active.length) * 100);
}
```

**HEALTH_LABEL:** `'Income health'`
**HEALTH_DESC:** `'% of active income streams rated Stable or Mostly Stable. Diversified, stable income scores higher.'`

**Stat cards (4):** Monthly Total · Annual Total · Stable % · Stream Count

---

### SavingsModule (`modules/savings.jsx`)

**Health formula:**
```javascript
function calcSavingsHealth(goals) {
  if (goals.length === 0) return 0;
  const funded = goals.filter(g => parseFloat(g.currentAmount) >= parseFloat(g.targetAmount));
  const fundedPct = (funded.length / goals.length) * 100;
  const totalTarget = goals.reduce((s, g) => s + parseFloat(g.targetAmount), 0);
  const totalCurr = goals.reduce((s, g) => s + parseFloat(g.currentAmount || 0), 0);
  const progressPct = totalTarget > 0 ? (totalCurr / totalTarget) * 100 : 0;
  return Math.round((fundedPct * 0.4) + (progressPct * 0.6));
}
```

**HEALTH_LABEL:** `'Savings health'`
**HEALTH_DESC:** `'Based on funded goals and overall progress toward targets. Fully funded goals and strong progress score higher.'`

**Stat cards (4):** Total Saved · Goals Funded · Monthly Commitment · Coverage (emergency months)

---

### RetirementModule (`modules/retirement.jsx`)

**Health formula:**
```javascript
function calcRetirementHealth(accounts, retProfile, assumptions) {
  if (!retProfile || accounts.length === 0) return 0;
  const totalBalance = accounts.reduce((s, a) => s + parseFloat(a.currentBalance || 0), 0);
  const { currentAge = 35, retirementAge = 65, annualSalary = 0, targetMonthlyIncome = 0 } = retProfile;
  const { returnRate = 7 } = assumptions || {};
  const years = Math.max(retirementAge - currentAge, 1);
  const annualContrib = accounts.reduce((s, a) => {
    if (a.type === 'pension' || a.type === 'socialsecurity') return s;
    const rate = parseFloat(a.contribRate || 0) / 100;
    const sal = parseFloat(annualSalary) || 0;
    return s + (a.contribType === 'percent' ? sal * rate : parseFloat(a.contribRate || 0) * 12);
  }, 0);
  const r = returnRate / 100;
  const fv = totalBalance * Math.pow(1 + r, years) + annualContrib * ((Math.pow(1 + r, years) - 1) / r);
  const annualNeed = (parseFloat(targetMonthlyIncome) || 0) * 12;
  const targetNest = annualNeed / 0.04;
  if (targetNest === 0) return 50;
  return Math.min(100, Math.round((fv / targetNest) * 100));
}
```

**HEALTH_LABEL:** `'Retirement health'`
**HEALTH_DESC:** `'Projected nest egg vs. your 4% rule target at your chosen retirement age. On track = 100%.'`

**Stat cards (4):** Current Balance · Target Nest Egg · Funded % · Years to Retire

---

### InvestmentModule (`modules/investment.jsx`)

**Health formula:**
```javascript
function calcInvestmentHealth(positions) {
  if (positions.length === 0) return 0;
  const totalCost = positions.reduce((s, p) => s + (parseFloat(p.avgCostBasis) * parseFloat(p.shares || 0)), 0);
  const totalValue = positions.reduce((s, p) => s + (parseFloat(p.currentValue) || 0), 0);
  if (totalCost === 0) return 50;
  const gainPct = ((totalValue - totalCost) / totalCost) * 100;
  if (gainPct >= 20) return 100;
  if (gainPct >= 10) return 85;
  if (gainPct >= 0) return 70;
  if (gainPct >= -10) return 40;
  return 20;
}
```

**HEALTH_LABEL:** `'Portfolio health'`
**HEALTH_DESC:** `'Based on total unrealized gain/loss across all positions. Positive returns score higher.'`

**Stat cards (4):** Total Invested · Current Value · Unrealized Gain · Annual Dividends

---

### InsuranceTracker (`modules/insurance.jsx`)

**Health formula:**
```javascript
// Read ins_legacy_health_{profileId} from storage — already computed by calcLegacyHealth()
// In the init/load function, after loading policies:
const legacyHealth = await storeGet(`ins_legacy_health_${profileId}`, true) || 0;
setHealthPct(legacyHealth);
```

Do not recompute — `calcLegacyHealth()` already runs on every policy save and writes the key. Just read the stored value.

**HEALTH_LABEL:** `'Insurance health'`
**HEALTH_DESC:** `'Weighted score: Life coverage (40%), Disability (30%), Health (20%), Auto (10%). Based on coverage vs. income targets.'`

**Stat cards (4):** Active Policies · Life Coverage · Monthly Premiums · Legacy Score

---

### Dashboard (`modules/dashboard.jsx`)

**Skip the health ring entirely.** Dashboard already has the Freedom Score in the center of the rings — adding a separate ring indicator would be redundant. No changes to Dashboard for Phase 3.

---

## What NOT to change

- Any function that calculates payoff schedules, amortization, or financial projections
- Any storage read/write calls or storage key names
- Any AI call logic or prompts
- Any import/export functions
- Any modal components not listed in this prompt
- Tab labels, tab counts, or tab order
- The `useTheme()` function or any theme tokens
- The `probeCloudStorage()` / `storeGet()` / `storeSet()` pattern

---

## Per-module execution order

Run one Code Clone per module. Each session:
1. Read `docs/project-instruction.md`
2. Read `docs/design-system.md`
3. Read this prompt in full
4. Read the target module file
5. Apply changes — health ring components, useBreakpoint, stat grid, module-specific health formula
6. Build: `cd preview && npm run build` (after updating `preview/src/App.jsx` import and `preview/vite.config.js`)
7. Verify build passes clean — 0 errors, 0 warnings
8. Commit: `feat(ui): [ModuleName] health ring + responsive layout (Phase 3)`
9. Report: file changed, build size, any deviations from this spec

---

## Commit messages

```
feat(ui): DebtTracker health ring + responsive layout (Phase 3)
feat(ui): SpendingTracker health ring + responsive layout (Phase 3)
feat(ui): IncomeTracker health ring + responsive layout (Phase 3)
feat(ui): SavingsModule health ring + responsive layout (Phase 3)
feat(ui): RetirementModule health ring + responsive layout (Phase 3)
feat(ui): InvestmentModule health ring + responsive layout (Phase 3)
feat(ui): InsuranceTracker health ring + responsive layout (Phase 3)
```
