# AI Advisor Pre-Work — Session D: RetirementModule
# File: modules/retirement.jsx (ONE FILE ONLY — do not touch any other file)

Read CLAUDE.md, docs/project-instruction.md, docs/internal/ffp-cto-SKILL.md
before starting.

This is pre-work for the AI Advisor. RetirementModule needs to write a compact
summary object to shared storage on every save. The AI Advisor reads
ret_summary_ instead of parsing raw retirement data.

---

## SESSION D — RetirementModule
**File:** `modules/retirement.jsx`
**Key to write:** `ret_summary_{profileId}` (shared: true)

### Schema
```javascript
{
  currentBalance: number,      // sum of all account currentBalance
  targetNestEgg: number,       // calculated from locked plan + targetMonthlyIncome
  fundedPct: number,           // Math.min((current/target)*100, 100)
  onTrack: boolean,            // true if projection hits target by retirement age
  yearsToRetirement: number,   // retirementAge - currentAge
  monthlyContribution: number, // sum of all calculated monthly contributions
  lockedPlan: string,          // "four_percent"|"three_point_three"|"five_percent"|"custom"
  calculatedOn: string
}
```

### Where to write it
After every storeSet of ret_accounts, ret_profile, or ret_assumptions.
Also on init after loading all retirement data.

```javascript
async function writeRetSummary(accounts, profile, assumptions, profileId) {
  if (!profile) return;

  const currentBalance = (accounts||[]).reduce((s,a) =>
    s + parseFloat(a.currentBalance||0), 0
  );

  // Replicate locked plan nest egg calculation
  const planRates = {
    four_percent: 4, three_point_three: 3.3, five_percent: 5
  };
  const rate = planRates[profile.lockedPlan] || parseFloat(profile.customPlanRate||4);
  const targetNestEgg = profile.targetMonthlyIncome
    ? (parseFloat(profile.targetMonthlyIncome) * 12) / (rate / 100)
    : 0;

  const fundedPct = targetNestEgg > 0
    ? Math.min(Math.round((currentBalance/targetNestEgg)*100), 100)
    : 0;

  const yearsToRetirement = Math.max(
    (parseInt(profile.retirementAge||65) - parseInt(profile.currentAge||35)), 0
  );

  // CRITICAL — DO NOT use fundedPct >= 0 (always true, corrupts AI Advisor data).
  // Before writing this function, search retirement.jsx for the existing projection
  // result variable (likely named isOnTrack, projectionOnTrack, onTrack, or similar)
  // derived from the balance projection chart. Use that variable directly.
  // Move writeRetSummary to wherever that projection result is in scope if needed.
  // Only use the fallback below if the projection variable is truly unreachable,
  // and document exactly why in a comment:
  //   fallback: const onTrack = fundedPct >= Math.round((1 - yearsToRetirement/30) * 100);
  const onTrack = /* find and use existing projection result variable — do not guess */;

  const monthlyContribution = (accounts||[]).reduce((s,a) => {
    if (a.type === 'socialsecurity' || a.type === 'pension') return s;
    if (a.contribType === 'percent' && profile.annualSalary) {
      return s + (parseFloat(profile.annualSalary||0) * parseFloat(a.contribRate||0) / 100 / 12);
    }
    return s + parseFloat(a.contribRate||0); // fixed amount
  }, 0);

  const summary = {
    currentBalance:      Math.round(currentBalance),
    targetNestEgg:       Math.round(targetNestEgg),
    fundedPct,
    onTrack,
    yearsToRetirement,
    monthlyContribution: Math.round(monthlyContribution * 100) / 100,
    lockedPlan:          profile.lockedPlan || 'four_percent',
    calculatedOn:        new Date().toISOString()
  };
  await storeSet(`ret_summary_${profileId}`, summary, true);
}
```

Call `writeRetSummary(accounts, profile, assumptions, profileId)` after:
1. init() finishes loading
2. Any account save/delete
3. Any profile setting save
4. Any assumption slider change (debounced 500ms)

---

## VERIFICATION

After changes:
1. Add a temporary console.log after writeRetSummary call:
   `console.log('summary written:', await storeGet('ret_summary_' + profileId, true))`
   Verify the object shape matches the schema above.
   Remove the console.log before committing.

2. Confirm storeSet uses `shared: true` — the AI Advisor reads this
   cross-module and needs shared storage.

3. Confirm writeRetSummary is called on init AND on every save.

---

## COMMIT

`feat(retirement): write ret_summary_ shared key for AI Advisor`

---

## REPORT BACK

1. File modified (confirm: modules/retirement.jsx only)
2. Function names where writeRetSummary is called (list all call sites)
3. What projection variable was used for onTrack — name it explicitly
4. Sample output from console.log verification — paste the object
5. Commit hash
6. Any edge cases encountered (e.g. no accounts yet, missing profile, onTrack fallback used)
