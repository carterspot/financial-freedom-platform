# AI Advisor Pre-Work — Session B: IncomeTracker
# File: modules/income-tracker.jsx (ONE FILE ONLY — do not touch any other file)

Read CLAUDE.md, docs/project-instruction.md, docs/internal/ffp-cto-SKILL.md
before starting.

This is pre-work for the AI Advisor. IncomeTracker needs to write a compact
summary object to shared storage on every save. The AI Advisor reads
inc_summary_ instead of parsing raw income data.

---

## SESSION B — IncomeTracker
**File:** `modules/income-tracker.jsx`
**Key to write:** `inc_summary_{profileId}` (shared: true)

### Schema
```javascript
{
  monthlyTotal: number,     // sum of all active stream monthly normalized amounts
  annualTotal: number,      // monthlyTotal * 12
  stablePct: number,        // % of monthly income from Stable or Mostly Stable streams
  streamCount: number,      // total active streams
  oneTimeTotal: number,     // sum of one-time streams (excluded from monthlyTotal)
  monthlyChange: number,    // vs prior month — 0 for v1
  calculatedOn: string
}
```

### Verify field names before writing
Before writing writeIncSummary, grep income-tracker.jsx for the actual state
variable declarations. Confirm exact field names and values for:
  - stream frequency field name and exact string values stored
    (must match FREQ_MULT keys exactly: 'Weekly','Bi-Weekly','Semi-Monthly',
    'Monthly','Quarterly','Annual','One-Time' — verify these match what the
    module actually stores, not what the PI spec says)
  - stability rating field name and exact string values
    (must match: 'Stable','Mostly Stable','Variable','Irregular')
  - stream end date field name (endDate? end? expiryDate?)
  - stream amount field name (amount? value? income?)
Do not assume PI spec names match JSX field names. Use what the code actually stores.

### Where to write it
After every storeSet of inc_streams. Also on init after loading streams.

```javascript
async function writeIncSummary(streams, profileId) {
  if (!streams?.length) return;

  const FREQ_MULT = {
    'Weekly': 4.333, 'Bi-Weekly': 2.167, 'Semi-Monthly': 2,
    'Monthly': 1, 'Quarterly': 0.333, 'Annual': 0.0833, 'One-Time': 0
  };

  const active = streams.filter(s => !s.endDate || new Date(s.endDate) > new Date());
  const recurring = active.filter(s => s.frequency !== 'One-Time');
  const oneTime   = active.filter(s => s.frequency === 'One-Time');

  const monthlyTotal = recurring.reduce((s, st) =>
    s + (parseFloat(st.amount||0) * (FREQ_MULT[st.frequency]||1)), 0
  );
  const stableStreams = recurring.filter(s =>
    s.stabilityRating === 'Stable' || s.stabilityRating === 'Mostly Stable'
  );
  const stableMonthly = stableStreams.reduce((s, st) =>
    s + (parseFloat(st.amount||0) * (FREQ_MULT[st.frequency]||1)), 0
  );
  const oneTimeTotal = oneTime.reduce((s, st) => s + parseFloat(st.amount||0), 0);

  const summary = {
    monthlyTotal:  Math.round(monthlyTotal * 100) / 100,
    annualTotal:   Math.round(monthlyTotal * 12 * 100) / 100,
    stablePct:     monthlyTotal > 0 ? Math.round((stableMonthly/monthlyTotal)*100) : 0,
    streamCount:   active.length,
    oneTimeTotal:  Math.round(oneTimeTotal * 100) / 100,
    monthlyChange: 0,
    calculatedOn:  new Date().toISOString()
  };
  await storeSet(`inc_summary_${profileId}`, summary, true);
}
```

Call `writeIncSummary(streams, profileId)` after:
1. init() finishes loading
2. Any stream save/delete

---

## VERIFICATION

After changes:
1. Add a temporary console.log after writeIncSummary call:
   `console.log('summary written:', await storeGet('inc_summary_' + profileId, true))`
   Verify the object shape matches the schema above.
   Remove the console.log before committing.

2. Confirm storeSet uses `shared: true` — the AI Advisor reads this
   cross-module and needs shared storage.

3. Confirm writeIncSummary is called on init AND on every save.

---

## COMMIT

`feat(income): write inc_summary_ shared key for AI Advisor`

---

## REPORT BACK

1. File modified (confirm: modules/income-tracker.jsx only)
2. Function names where writeIncSummary is called (list all call sites)
3. Actual field names used after verification (frequency strings, stability strings — what did the code actually store?)
4. Sample output from console.log verification — paste the object
5. Commit hash
6. Any edge cases encountered (e.g. no streams yet, unknown frequency value)
