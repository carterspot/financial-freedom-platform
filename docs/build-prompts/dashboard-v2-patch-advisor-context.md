# Dashboard v2.0 — Surgical Addition: AI Advisor Context
# Target file: modules/dashboard.jsx only
# Apply AFTER the main v2.0 build completes — do not interrupt current build

Read CLAUDE.md before starting. Single file, two surgical additions only.

---

## ADDITION 1 — Load prior module AI results

Add five new useState declarations at the top of the component alongside existing state:
```javascript
const [dtAiResults,  setDtAiResults]  = useState(null);
const [savAiResults, setSavAiResults] = useState(null);
const [retAiResults, setRetAiResults] = useState(null);
const [invAiResults, setInvAiResults] = useState(null);
const [insAiResults, setInsAiResults] = useState(null);
```

In the main Promise.all data load, add these five keys alongside the existing loads:

```javascript
storeGet(`dt_ai_results_${id}`, true),
storeGet(`sav_ai_results_${id}`, true),
storeGet(`ret_ai_results_${id}`, true),
storeGet(`inv_ai_results_${id}`, true),
storeGet(`ins_ai_results_${id}`, true),
```

Add corresponding destructured variables and state setters after the Promise.all resolves:
```javascript
setDtAiResults(dtAiResults || null);
setSavAiResults(savAiResults || null);
setRetAiResults(retAiResults || null);
setInvAiResults(invAiResults || null);
setInsAiResults(insAiResults || null);
```

---

## ADDITION 2 — Enhance runAdvisor() prompt

Find the `runAdvisor` function and locate the prompt string. Make two additions:

### A — Missing module detection (add before the prompt string)

```javascript
const missingModules = [
  !incSummary          && 'Income',
  !dtSummary           && 'Debt',
  !savSummary          && 'Savings',
  !retSummary          && 'Retirement',
  !investments         && 'Investments',
  legacyHealth == null && 'Insurance',  // == null catches null AND undefined; 0 is valid (module used, no coverage)
].filter(Boolean);

const missingNote = missingModules.length > 0
  ? `\nNOTE: The following modules have no data yet: ${missingModules.join(', ')}. ` +
    `Provide recommendations based on available data only. ` +
    `For each missing module, briefly note what completing it would add to this analysis.`
  : '';
```

### B — Prior advice section (add to end of prompt string, before the closing backtick)

```javascript
// Helper to extract text from various result shapes
function extractAiText(result) {
  if (!result) return null;
  if (typeof result === 'string') return result;
  if (result.content) return result.content;
  if (result.scheduleAnalysis) return result.scheduleAnalysis;
  if (result.text) return result.text;
  return null;
}

function truncate(text, max = 300) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + '...';
}

const priorAdviceLines = [
  dtAiResults  && `Debt strategy: ${truncate(extractAiText(dtAiResults))}`,
  savAiResults && `Savings advice: ${truncate(extractAiText(savAiResults))}`,
  retAiResults && `Retirement analysis: ${truncate(extractAiText(retAiResults))}`,
  invAiResults && `Investment analysis: ${truncate(extractAiText(invAiResults))}`,
  insAiResults && `Insurance analysis: ${truncate(extractAiText(insAiResults))}`,
].filter(Boolean);

const priorAdviceSection = priorAdviceLines.length > 0
  ? `\n\nPRIOR ADVICE FROM MODULE ADVISORS\n` +
    `(Cross-reference these with current data. Note conflicts or reinforcements. ` +
    `Treat advice older than 30 days as potentially outdated.)\n` +
    priorAdviceLines.join('\n')
  : '';
```

Then append both variables to the prompt:
```javascript
// At the end of the prompt template literal, before the closing backtick:
${missingNote}${priorAdviceSection}
```

Note: `extractAiText` and `truncate` are pure helper functions — hoist them to top level
outside the component, not nested inside runAdvisor.

---

## VERIFICATION

1. Load dashboard with a profile that has never run any module advisor
   - missingNote should be non-empty and appear in the prompt
   - priorAdviceSection should be empty string
   - Advisor should still run and return useful output

2. Load dashboard with a profile that has run at least one module advisor
   - priorAdviceSection should contain that module's prior advice truncated to ~300 chars
   - Full prompt should not exceed ~3000 tokens total

3. Edge case: Insurance Tracker used but legacyHealth === 0 (no policies/income)
   - Insurance should NOT appear in missingModules — module is present, just no coverage

4. No new storage writes — these are reads only

---

## COMMIT

```
git add modules/dashboard.jsx docs/dashboard/
git commit -m "feat(dashboard): AI Advisor reads prior module results, surfaces missing module gaps"
git push
```

## REPORT BACK

1. Confirm both additions in place
2. Sample prompt logged (console.log the full prompt string before the API call,
   check it, then remove the log before committing)
3. Missing module detection working — list which modules returned null on test profile
4. Prior advice section working — confirm truncation at 300 chars
5. Confirm extractAiText and truncate are hoisted to top level
6. Commit hash
