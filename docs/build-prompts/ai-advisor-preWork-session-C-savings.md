# AI Advisor Pre-Work — Session C: SavingsModule
# File: modules/savings.jsx (ONE FILE ONLY — do not touch any other file)

Read CLAUDE.md, docs/project-instruction.md, docs/internal/ffp-cto-SKILL.md
before starting.

This is pre-work for the AI Advisor. SavingsModule needs to write a compact
summary object to shared storage on every save. The AI Advisor reads
sav_summary_ instead of parsing raw savings data.

---

## SESSION C — SavingsModule
**File:** `modules/savings.jsx`
**Key to write:** `sav_summary_{profileId}` (shared: true)

### Schema
```javascript
{
  totalBalance: number,       // sum of all fund balances
  goalCount: number,          // total goals
  fundedGoalCount: number,    // goals where currentAmount >= targetAmount
  emergencyMonths: number,    // totalBalance / ffp_baseline_.amount (0 if no baseline)
  monthlyCommitment: number,  // sum of all goal monthlyContrib values
  dueSoon: number,            // goals with dueDate within 30 days
  calculatedOn: string
}
```

### Where to write it
After every storeSet of sav_funds or sav_goals. Also on init.
Reads ffp_baseline_ to calculate emergencyMonths.

```javascript
async function writeSavSummary(funds, goals, profileId) {
  const totalBalance     = (funds||[]).reduce((s,f) => s + parseFloat(f.balance||0), 0);
  const fundedGoalCount  = (goals||[]).filter(g => g.currentAmount >= g.targetAmount).length;
  const monthlyCommitment= (goals||[]).reduce((s,g) => s + parseFloat(g.monthlyContrib||0), 0);

  const now = new Date();
  const in30 = new Date(now.getTime() + 30*24*60*60*1000);
  const dueSoon = (goals||[]).filter(g =>
    g.dueDate && new Date(g.dueDate) <= in30
  ).length;

  const baseline = await storeGet(`ffp_baseline_${profileId}`, true);
  const emergencyMonths = baseline?.amount > 0
    ? Math.round((totalBalance / baseline.amount) * 10) / 10
    : 0;

  const summary = {
    totalBalance:      Math.round(totalBalance * 100) / 100,
    goalCount:         (goals||[]).length,
    fundedGoalCount,
    emergencyMonths,
    monthlyCommitment: Math.round(monthlyCommitment * 100) / 100,
    dueSoon,
    calculatedOn:      new Date().toISOString()
  };
  await storeSet(`sav_summary_${profileId}`, summary, true);
}
```

Call `writeSavSummary(funds, goals, profileId)` after:
1. init() finishes loading
2. Any fund save/delete/deposit
3. Any goal save/delete/contribution

---

## VERIFICATION

After changes:
1. Add a temporary console.log after writeSavSummary call:
   `console.log('summary written:', await storeGet('sav_summary_' + profileId, true))`
   Verify the object shape matches the schema above.
   Remove the console.log before committing.

2. Confirm storeSet uses `shared: true` — the AI Advisor reads this
   cross-module and needs shared storage.

3. Confirm writeSavSummary is called on init AND on every save.

---

## COMMIT

`feat(savings): write sav_summary_ shared key for AI Advisor`

---

## REPORT BACK

1. File modified (confirm: modules/savings.jsx only)
2. Function names where writeSavSummary is called (list all call sites)
3. Sample output from console.log verification — paste the object
4. Commit hash
5. Any edge cases encountered (e.g. no funds yet, no baseline key present)
