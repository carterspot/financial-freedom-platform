# Dashboard v2.0 — Build Prompt
# Target file: modules/dashboard.jsx
# Deployment: docs/dashboard/

Read CLAUDE.md, docs/project-instruction.md, docs/internal/ffp-cto-SKILL.md,
and docs/design-system.md before starting.

This is a full rebuild of modules/dashboard.jsx. Replace the existing file.
The Dashboard is now the platform home — it must handle new users gracefully,
provide the AI Advisor panel, and be the most polished module on the platform.

Do not touch any other module files.

---

## WHAT CHANGED FROM v1.0

1. Freedom Score always in center of rings — empty center if no data, score if data exists
2. AI Advisor panel — right drawer on desktop, tab on mobile
3. New user onboarding — profile creation + API key prompt on first load
4. Settings tab — legacy landing link + AI depth setting
5. Reads four new summary keys: dt_summary_, inc_summary_, sav_summary_, ret_summary_

---

## SECTION 1: FREEDOM RINGS — SCORE IN CENTER

Score is always rendered inside the rings. No above/below toggle.

```javascript
// In the FreedomRings component:
// Center of rings shows:
//   - If freedomScore > 0: the score number + "Freedom Score" label
//   - If freedomScore === 0: nothing (empty center, just the rings)

// Empty rings: all three render at 0% progress (grey tracks only)
// No "no data" message inside the rings — let empty rings speak for themselves
```

SVG center text:
```jsx
{freedomScore > 0 && (
  <>
    <text x="90" y="84" textAnchor="middle"
      fontSize="32" fontWeight="800" fontFamily="monospace"
      fill="#6366f1">{freedomScore}</text>
    <text x="90" y="100" textAnchor="middle"
      fontSize="10" fontWeight="700" fill="#475569"
      fontFamily="DM Sans,sans-serif"
      style={{textTransform:'uppercase',letterSpacing:'1px'}}>
      Freedom Score
    </text>
  </>
)}
```

---

## SECTION 2: AI ADVISOR PANEL

### Responsive behavior
```javascript
const { isMobile } = useBreakpoint(); // < 640px = mobile
// isMobile = true  → Tab mode (Overview tab / Advisor tab)
// isMobile = false → Drawer mode (right panel slides over charts)
```

### State
```javascript
const [advisorOpen, setAdvisorOpen]   = useState(false);
const [advisorDepth, setAdvisorDepth] = useState(() =>
  parseInt(localStorage.getItem('dash_advisor_depth') || '2')
); // 1=simple, 2=standard(default), 3=detailed
const [advisorResult, setAdvisorResult] = useState(null);
const [advisorRunning, setAdvisorRunning] = useState(false);
const [advisorStale, setAdvisorStale]   = useState(false);
// Load persisted result from dash_advisor_result_{profileId} on init
```

### Staleness detection
```javascript
// On init: load dash_advisor_snapshot_{profileId}
// Compare to current summary key fingerprint:
//   fingerprint = JSON.stringify({
//     dt: dtSummary?.calculatedOn,
//     inc: incSummary?.calculatedOn,
//     sav: savSummary?.calculatedOn,
//     ret: retSummary?.calculatedOn,
//   })
// If fingerprint differs from stored snapshot: setAdvisorStale(true)
```

### Drawer layout (desktop ≥ 640px)
```
Main content area shifts left when drawer open:
  Closed: main = full width
  Open:   main = ~60% width, advisor panel = ~40% width
  Transition: smooth 250ms ease

Drawer:
  position: fixed right side of dashboard content area (not full screen)
  background: #0a0f1e
  border-left: 1px solid #1e293b
  padding: 16px
  overflow-y: auto
  z-index: 50

Drawer header:
  "AI Advisor" title + depth indicator + close button (×)
  Stale badge: "New data available · Re-analyze" (amber, if advisorStale)
```

### Tab layout (mobile < 640px)
```
Two tabs below the Freedom Rings + stat tiles:
  [Overview] [AI Advisor]
  
Overview tab: alerts + 6 charts (existing)
Advisor tab: full advisor panel content
```

### Advisor panel content
```
STATE: no result yet + no API key
  → "Add an API key in Settings to enable AI analysis"
  → Button: "Open Settings"

STATE: no result yet + has API key
  → Data preview (see Data Review section below)
  → Button: "Analyze My Finances" (primary, indigo)

STATE: running
  → Spinner + "Analyzing your financial picture…"

STATE: result exists + not stale
  → Result rendered (see below)
  → Small text: "Analyzed [relative time] · Re-analyze"

STATE: result exists + stale
  → Result rendered (greyed slightly)
  → Amber banner: "Your data has changed · Re-analyze for updated advice"
  → Button: "Re-analyze"
```

### Data preview (shown before first run)
Brief summary of what the Advisor will read — builds trust:
```
What I'll analyze:
  Debt    $54,320 across 4 accounts
  Income  $7,083/mo · 3 streams
  Spending $4,180/mo essential floor
  Savings  4 of 5 goals funded
  Retirement 64% toward target
  Investments $71,200 portfolio
  Insurance  72% coverage score

[Analyze My Finances button]
```
Show "—" for any module with no data. Never show null or undefined.

### AI call
```javascript
async function runAdvisor() {
  setAdvisorRunning(true);

  const depthInstructions = {
    1: "Give a brief, simple response. Maximum 3 bullet points per section. Use plain language, no jargon.",
    2: "Give a standard response. Be specific with numbers. 4-6 points per section.",
    3: "Give a detailed, comprehensive response. Include reasoning, context, and specific action steps."
  };

  const prompt = `You are a personal financial advisor reviewing a complete financial profile.
Respond at depth level ${advisorDepth}: ${depthInstructions[advisorDepth]}

INCOME
Monthly: $${incSummary?.monthlyTotal || 0} | Stability: ${incSummary?.stablePct || 0}% stable | ${incSummary?.streamCount || 0} streams

DEBT
Total: $${dtSummary?.totalBalance || 0} | Monthly payments: $${dtSummary?.totalMinPayments || 0} | Highest APR: ${dtSummary?.highestApr || 0}%
Promo expiring soon: ${dtSummary?.promoExpiringSoon ? 'YES — action needed' : 'No'}

SPENDING
Essential floor: $${baseline?.amount || 0}/mo

SAVINGS
Total: $${savSummary?.totalBalance || 0} | Goals: ${savSummary?.fundedGoalCount || 0} of ${savSummary?.goalCount || 0} funded | Emergency: ${savSummary?.emergencyMonths || 0} months

RETIREMENT
Balance: $${retSummary?.currentBalance || 0} | Target: $${retSummary?.targetNestEgg || 0} | Funded: ${retSummary?.fundedPct || 0}% | On track: ${retSummary?.onTrack ? 'YES' : 'NO'}

INVESTMENTS
Total invested: $${investments?.totalInvested || 0} | Current value: $${investments?.currentValue || 0}

INSURANCE
Legacy health score: ${legacyHealth || 0}%

FREEDOM SCORE: ${freedomScore}/100

Please provide:
1. Top 3 immediate actions ranked by financial impact
2. Where my next $500/mo of discretionary income should go and why
3. My biggest financial risk right now
4. What would most improve my Freedom Score
5. One 12-month milestone I should aim for`;

  try {
    const res = await callClaude(apiKey, {
      model: MODEL,
      max_tokens: advisorDepth === 1 ? 600 : advisorDepth === 2 ? 1200 : 2000,
      messages: [{ role: 'user', content: prompt }]
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    const result = { text, generatedAt: new Date().toISOString() };
    setAdvisorResult(result);
    setAdvisorStale(false);

    // Persist result and snapshot
    await storeSet(`dash_advisor_result_${activeProfileId}`, result, true);
    await storeSet(`dash_advisor_snapshot_${activeProfileId}`, {
      dt: dtSummary?.calculatedOn,
      inc: incSummary?.calculatedOn,
      sav: savSummary?.calculatedOn,
      ret: retSummary?.calculatedOn,
    }, true);
  } catch(e) {
    // Show error state in panel
  } finally {
    setAdvisorRunning(false);
  }
}
```

### Result rendering
Use this exact renderer — do not invent your own markdown parser:

```javascript
function renderAdvisorResult(text) {
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} style={{height:8}} />;
    if (/^\d+\./.test(trimmed)) return (
      <div key={i} style={{fontWeight:700, color:'#6366f1',
        marginTop:12, marginBottom:4, fontSize:13}}>
        {trimmed.replace(/\*\*/g,'')}
      </div>
    );
    return (
      <div key={i} style={{fontSize:13, color:'#94a3b8',
        lineHeight:1.6, paddingLeft:8}}>
        {trimmed.replace(/\*\*/g,'')}
      </div>
    );
  });
}
```

Numbered lines → indigo section headers. Body text → `tx2`. Strips `**bold**` markers. No raw markdown visible to user.
📋 Copy button + ⬇ Download .txt button at bottom of result.

---

## SECTION 3: NEW USER ONBOARDING

### Detection
```javascript
// On init, after profile load:
const isNewUser = profiles.length === 0;
const hasNoApiKey = !apiKey || !apiKey.trim();
```

### First-run profile creation (isNewUser === true)
Full-screen overlay (not a modal — replace the loading screen):

```
Logo + "Welcome to Financial Freedom"
Subtitle: "Let's set up your profile to get started"

Name field (required)
Avatar color picker (8 colors — AVATAR_COLORS)
Recovery PIN field (required, min 4 chars)
  Helper: "Used to unlock module PINs (e.g. Insurance Tracker). Store it somewhere safe."

[Get Started button] → creates profile, saves to cc_profiles, sets cc_active_profile
```

### API key prompt (shown after profile creation OR on first load with no key)
Shown as a dismissible banner at the top of the dashboard (not a blocker):

```
"Add your Anthropic API key to enable AI features across all modules"
[Add Key] button → opens API key modal
[Maybe Later] → dismisses for session, stores dash_api_dismissed_date in localStorage
  (Re-shows after 7 days)
```

API key modal:
```
"Enter your Anthropic API key"
Input with show/hide toggle
Status dot (valid sk-ant- prefix = green, other = red, empty = grey)
[Save Key] → storeSet('cc_apikey', key, true)
[Cancel]
```

### Initial load instructions (first time seeing dashboard with a profile)
```
Detected by: dash_first_visit_{profileId} not set in localStorage

After profile creation, show a brief dismissible overlay:
  "Your Dashboard"
  Three bullet points:
    • "Start with any module — your data syncs across all of them"
    • "The Freedom Score updates as you add data to each module"  
    • "AI Advisor unlocks once you've added an API key"
  
  [Got it] → sets dash_first_visit_{profileId} = true in localStorage
```

---

## SECTION 4: DATA LOADING

Load all summary keys in parallel (in addition to v1.0 raw keys):

```javascript
const [
  // existing raw keys...
  dtCards, dtLoans, dtLogs,
  incStreams,
  spTransactions, baseline,
  savFunds, savGoals,
  retAccounts, retProfile, retAssumptions,
  investments, legacyHealth,
  // NEW summary keys
  dtSummary, incSummary, savSummary, retSummary,
  // NEW advisor state
  advisorResult, advisorSnapshot
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
  storeGet(`ins_legacy_health_${id}`, true),
  // summary keys
  storeGet(`dt_summary_${id}`, true),
  storeGet(`inc_summary_${id}`, true),
  storeGet(`sav_summary_${id}`, true),
  storeGet(`ret_summary_${id}`, true),
  // advisor
  storeGet(`dash_advisor_result_${id}`, true),
  storeGet(`dash_advisor_snapshot_${id}`, true),
]);

// Compute staleness immediately after load — do not skip this
if (advisorSnapshot) {
  const fingerprint = JSON.stringify({
    dt:  dtSummary?.calculatedOn,
    inc: incSummary?.calculatedOn,
    sav: savSummary?.calculatedOn,
    ret: retSummary?.calculatedOn,
  });
  setAdvisorStale(JSON.stringify(advisorSnapshot) !== fingerprint);
}
```

---

## SECTION 5: SETTINGS TAB

Add a Settings tab to the dashboard (gear icon in nav, or bottom of sidebar).

Settings panel contains:

**AI Advisor Depth**
```
Label: "AI Response Detail"
Three options (radio/pill select):
  [1 · Brief]  [2 · Standard ✓]  [3 · Detailed]
Description per level:
  1: "Short, simple answers. Best for quick checks."
  2: "Balanced detail with specific numbers. Recommended."
  3: "Comprehensive analysis with full reasoning."
Saves to localStorage key: dash_advisor_depth
```

**Legacy Landing Page**
```
Label: "Module Directory"
Description: "The original module index page"
Link: "/financial-freedom-platform/legacy-landing/"
Opens in new tab
```

**API Key**
```
Current key status (masked: sk-ant-...xxxx)
[Change Key] button → opens API key modal
```

**Profile**
```
Current profile name + avatar
[Edit Profile] → opens edit modal (name, avatar color, PIN)
[Add Profile] → opens new profile creation
```

---

## SECTION 6: STORAGE KEYS (Dashboard v2.0)

```
dash_advisor_result_{profileId}   (shared) — persisted AI Advisor output {text, generatedAt}
dash_advisor_snapshot_{profileId} (shared) — summary key timestamps at last run
dash_nav_collapsed                (local)  — sidebar collapsed state
dash_advisor_depth                (local)  — AI depth setting (1|2|3)
dash_api_dismissed_date           (local)  — date API key banner was dismissed
dash_first_visit_{profileId}      (local)  — first visit instructions shown
```

---

## SECTION 7: OPEN ADVISOR BUTTON

A persistent button that opens the advisor panel. Sits in the top nav bar:

```jsx
<button
  onClick={() => setAdvisorOpen(o => !o)}
  title="Open AI Advisor"
  style={{
    background: advisorStale ? '#f59e0b18' : '#6366f118',
    border: `1px solid ${advisorStale ? '#f59e0b44' : '#6366f144'}`,
    borderRadius: 8,
    padding: '6px 12px',
    color: advisorStale ? '#f59e0b' : '#6366f1',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 6
  }}
>
  <span style={{fontSize:14}}>✦</span>
  {advisorOpen ? 'Close Advisor' : 'AI Advisor'}
  {advisorStale && <span style={{
    width:6,height:6,borderRadius:'50%',
    background:'#f59e0b',flexShrink:0
  }}/>}
</button>
```

---

## DEPLOYMENT

1. preview/src/App.jsx — import from modules/dashboard.jsx
2. preview/vite.config.js:
   base: "/financial-freedom-platform/dashboard/"
   build.outDir: "../docs/dashboard"
   build.emptyOutDir: true
3. cd preview && npm run build
4. git add modules/dashboard.jsx docs/dashboard/ preview/vite.config.js preview/src/App.jsx
5. git commit -m "feat: Dashboard v2.0 — AI Advisor panel, onboarding, score in rings center, settings tab"
6. git push

---

## REPORT BACK

1. Build result (errors, warnings, bundle size — expect ~280KB)
2. All JSX rules pass — list any violations caught
3. New user flow tested — profile creation, API key prompt, first visit instructions
4. AI Advisor panel — confirm drawer opens/closes on desktop, tabs on mobile
5. Freedom Score center — confirm empty rings when no data, score in center when data exists
6. Settings tab — depth selector, legacy landing link, API key management
7. Commit hash
