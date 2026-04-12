# AI Advisor Pre-Work — Session A: DebtTracker
# File: modules/debt-tracker.jsx (ONE FILE ONLY — do not touch any other file)

Read CLAUDE.md, docs/project-instruction.md, docs/internal/ffp-cto-SKILL.md
before starting.

This is pre-work for the AI Advisor. DebtTracker needs to write a compact
summary object to shared storage on every save. The AI Advisor reads
dt_summary_ instead of parsing raw debt data.

---

## SESSION A — DebtTracker
**File:** `modules/debt-tracker.jsx`
**Key to write:** `dt_summary_{profileId}` (shared: true)

### Schema
```javascript
{
  totalBalance: number,        // sum of all card balance + loan currentBalance
  totalMinPayments: number,    // sum of all card/loan minimum payments
  highestApr: number,          // highest APR across all active debts
  promoExpiringSoon: boolean,  // any promo APR with endDate within 90 days
  estimatedPayoffDate: string, // ISO date string from existing payoff engine
  monthlyChange: number,       // total balance change vs 30 days ago (negative = good)
  debtCount: number,           // total active debts (cards + loans, not closed)
  calculatedOn: string         // new Date().toISOString()
}
```

### Verify field names before writing
Before writing writeDtSummary, grep debt-tracker.jsx for the actual state
variable declarations for cards and loans. Confirm exact field names for:
  - card balance field (balance? currentBalance? amount?)
  - card minimum payment field (monthlyPayment? minPayment? minPmt?)
  - card APR field (apr? interestRate? rate?)
  - card promo end date field (promoEndDate? promoExpiry? promoEnd?)
  - loan current balance field (currentBalance? balance?)
  - loan monthly payment field (monthlyPayment? payment?)
  - loan interest rate field (interestRate? apr? rate?)
Do not assume PI spec names match JSX field names. Use what the code actually stores.

### Where to write it
Find the function that saves/updates a card or loan (likely `handleSaveCard`,
`handleSaveLoan`, `handleQuickPay`, or similar). After every successful
storeSet of card/loan data, recalculate and write dt_summary_.

Also write on init after loading all debts (so Dashboard gets fresh data
even if no saves happen this session).

```javascript
async function writeDtSummary(cards, loans, profileId) {
  const activeCards  = (cards  || []).filter(c => !c.closed);
  const activeLoans  = (loans  || []).filter(l => !l.closed);
  const allDebts     = [...activeCards, ...activeLoans];
  if (!allDebts.length) return;

  const totalBalance     = allDebts.reduce((s,d) => s + parseFloat(d.balance||d.currentBalance||0), 0);
  const totalMinPayments = allDebts.reduce((s,d) => s + parseFloat(d.monthlyPayment||d.minPayment||0), 0);
  const highestApr       = Math.max(...allDebts.map(d => parseFloat(d.apr||d.interestRate||0)));

  const now = new Date();
  const in90 = new Date(now.getTime() + 90*24*60*60*1000);
  const promoExpiringSoon = activeCards.some(c =>
    c.promoEndDate && new Date(c.promoEndDate) <= in90
  );

  // Use existing payoff calculation if available, else null
  // estimatedPayoffDate: pull from existing computeSchedule result if accessible
  // If not easily accessible, store null — AI Advisor handles gracefully

  const summary = {
    totalBalance:        Math.round(totalBalance * 100) / 100,
    totalMinPayments:    Math.round(totalMinPayments * 100) / 100,
    highestApr,
    promoExpiringSoon,
    estimatedPayoffDate: null, // populate if computeSchedule result is in scope
    debtCount:           allDebts.length,
    monthlyChange:       0,    // v1: 0 — requires prior month snapshot (future)
    calculatedOn:        new Date().toISOString()
  };
  await storeSet(`dt_summary_${profileId}`, summary, true);
}
```

Call `writeDtSummary(cards, loans, profileId)` after:
1. init() finishes loading
2. Any card save/delete
3. Any loan save/delete
4. Any Quick Pay

---

## VERIFICATION

After changes:
1. Add a temporary console.log after writeDtSummary call:
   `console.log('summary written:', await storeGet('dt_summary_' + profileId, true))`
   Verify the object shape matches the schema above.
   Remove the console.log before committing.

2. Confirm storeSet uses `shared: true` — the AI Advisor reads this
   cross-module and needs shared storage.

3. Confirm writeDtSummary is called on init AND on every save.

---

## COMMIT

`feat(debt): write dt_summary_ shared key for AI Advisor`

---

## REPORT BACK

1. File modified (confirm: modules/debt-tracker.jsx only)
2. Function names where writeDtSummary is called (list all call sites)
3. Actual field names used after verification (what did the code actually store?)
4. Sample output from console.log verification — paste the object
5. Commit hash
6. Any edge cases encountered (e.g. no debts yet, division by zero)
