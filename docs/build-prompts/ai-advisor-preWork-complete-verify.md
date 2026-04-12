# AI Advisor Pre-Work — Completion Verification
# Single session — read-only audit, no code changes

Read CLAUDE.md, docs/project-instruction.md, docs/internal/ffp-cto-SKILL.md
before starting.

Four modules were updated in parallel sessions to write summary keys for the
AI Advisor. This session verifies all four are correctly in place before the
AI Advisor build begins. Do not modify any module files — this is audit only.

---

## VERIFY ALL FOUR MODULES

For each module below, open the file and confirm:

1. The write function exists (by name)
2. It is called on init (after loading data)
3. It is called on every save/delete operation
4. storeSet uses `shared: true`
5. The summary object shape matches the schema

---

### Module A — DebtTracker
**File:** `modules/debt-tracker.jsx`
**Function:** `writeDtSummary(cards, loans, profileId)`
**Key:** `dt_summary_{profileId}` (shared: true)

Expected schema:
```
totalBalance, totalMinPayments, highestApr, promoExpiringSoon,
estimatedPayoffDate, monthlyChange, debtCount, calculatedOn
```

---

### Module B — IncomeTracker
**File:** `modules/income-tracker.jsx`
**Function:** `writeIncSummary(streams, profileId)`
**Key:** `inc_summary_{profileId}` (shared: true)

Expected schema:
```
monthlyTotal, annualTotal, stablePct, streamCount,
oneTimeTotal, monthlyChange, calculatedOn
```

---

### Module C — SavingsModule
**File:** `modules/savings.jsx`
**Function:** `writeSavSummary(funds, goals, profileId)`
**Key:** `sav_summary_{profileId}` (shared: true)

Expected schema:
```
totalBalance, goalCount, fundedGoalCount, emergencyMonths,
monthlyCommitment, dueSoon, calculatedOn
```

---

### Module D — RetirementModule
**File:** `modules/retirement.jsx`
**Function:** `writeRetSummary(accounts, profile, assumptions, profileId)`
**Key:** `ret_summary_{profileId}` (shared: true)

Expected schema:
```
currentBalance, targetNestEgg, fundedPct, onTrack,
yearsToRetirement, monthlyContribution, lockedPlan, calculatedOn
```

**Special check for Session D:** Confirm `onTrack` is NOT `fundedPct >= 0`
(always-true placeholder). It must reference the module's actual projection
result variable. Report exactly what variable or expression was used.

---

## ALSO VERIFY — existing shared keys still present

These keys were already being written before the pre-work sessions.
Confirm none of the parallel sessions accidentally removed them:

- `ffp_baseline_{profileId}` — written by SpendingTracker (spending.jsx)
- `ffp_investments_{profileId}` — written by InvestmentModule (investment.jsx)
- `ins_legacy_health_{profileId}` — written by InsuranceTracker (insurance.jsx)

Just grep each file to confirm the storeSet for these keys is still present.
Do not open or modify any of these files beyond a quick grep.

---

## REPORT BACK

For each of the four modules, report:

1. **Function found:** yes/no — name
2. **Called on init:** yes/no — line or function name
3. **Called on every save:** yes/no — list all call sites
4. **shared: true confirmed:** yes/no
5. **Schema match:** yes/no — note any missing or extra fields
6. **onTrack (Session D only):** what variable/expression was used

For the three pre-existing keys:
7. **ffp_baseline_ still present in spending.jsx:** yes/no
8. **ffp_investments_ still present in investment.jsx:** yes/no
9. **ins_legacy_health_ still present in insurance.jsx:** yes/no

Final line: **PRE-WORK COMPLETE** or list what is missing/wrong.

Do not commit anything. This is a read-only audit.
