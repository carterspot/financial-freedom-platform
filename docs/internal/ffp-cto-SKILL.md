---
name: ffp-cto
description: >
  Use this skill whenever working on the Financial Freedom Platform (FFP).
  Triggers: any mention of FFP modules, debt-tracker, spending-tracker, income-tracker,
  card-tracker, loan-tracker, savings module, retirement module, investment module,
  AI advisor, artifact rendering, or any .jsx file in the FFP repo.
  Read this BEFORE writing any code, prompt, or documentation for FFP.
---

# FFP CTO Skill — Financial Freedom Platform

## What this is
A modular AI-powered personal finance platform. Standalone React JSX artifacts hosted on
GitHub Pages at `carterspot.github.io/financial-freedom-platform`. Each module is a single
self-contained `.jsx` file. No npm dependencies. No external chart libraries.

**Repo:** `carterspot/financial-freedom-platform`
**PI (full context):** `docs/project-instruction.md` — always read before major builds.

---

## Module Status (current)

| Module | Version | Status | Artifact |
|--------|---------|--------|----------|
| 📊 SpendingTracker | v1.3 | ✅ Live | d3a50010-65a2-4c63-99ef-6f2668c03660 |
| 💰 IncomeTracker | v1.0 | ✅ Live | 2f3c6e2f-6e59-4dd1-bde8-93b7af3dc04b |
| ⚡ DebtTracker | v1.3 | ✅ Live | 474012b1-a591-4f54-99d5-62a198569daf |
| 💳 CardTracker | v3.1 | 🔶 Legacy | 67fac319-a7d6-442b-bed6-c8b6c4579ac3 |
| 🏦 LoanTracker | v1.2 | 🔶 Legacy | b299eb32-cd52-4668-b3e9-f130d0fe5d27 |
| 🏦 Savings Module | planned | 📋 Next | — |
| 📈 Retirement Module | planned | 📋 Planned | — |
| 💹 Investment Module | planned | 📋 Planned | — |
| 🧠 AI Advisor | capstone | 📋 Capstone | — |

---

## Critical JSX Rules — Artifact Renderer Constraints

These crash the artifact renderer silently. Vite/build passes clean. Renderer does not.

### 1. Never `return<JSX>` — always `return (` or `return <` with a space
### 2. Never define JSX-returning functions inside a component — hoist ALL to top level
### 3. Never `window.confirm()` or `window.alert()` — use custom ConfirmModal component
### 4. Never stream AI responses — `await res.json()` only
### 5. No `<form>` tags — use `onClick`/`onChange` handlers
### 6. No external chart libraries — SVG only, hand-rolled
### 7. Always use probe/fallback storage pattern — never localStorage-only

### Known renderer-specific crashes (Vite passes, renderer fails):
```
❌  const [w, setW] = useState(window.innerWidth);
✅  const [w, setW] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1280);

❌  "{VARIABLE}"          // JSX expression inside quotes = string literal
✅  {VARIABLE}

❌  // ─── Section ───   // Unicode box-drawing chars in comments crash Babel parser
✅  // --- Section ---

❌  arr.findLastIndex?.()   // ES2023 + optional chaining = unsupported
✅  arr.filter(...).length - 1
```

**Pre-ship audit checklist — run before every artifact render:**
- [ ] No `return<` (search file)
- [ ] No `window.innerWidth` in `useState()` initializer
- [ ] No Unicode `─` box-drawing chars in comments (`grep -c "─" file.jsx`)
- [ ] No `findLastIndex`, `toSorted`, `toReversed`, `at(-n)` (ES2023+ methods)
- [ ] No JSX expressions wrapped in quotes `"{VAR}"`
- [ ] No nested JSX-returning component definitions
- [ ] `npm run build` in `preview/` passes clean

---

## Shared Platform Layer

All modules share these storage keys:
```
cc_profiles              — profile list (shared)
cc_active_profile        — active profile id (shared)
cc_apikey                — Anthropic API key (shared, one setup for all)
ffp_categories_{pid}     — 56 categories, 13 sections (shared)
ffp_cat_rules_{pid}      — auto-assignment rules (shared, SpendingTracker owns CRUD)
```

**Storage prefixes:** `cc_` CardTracker · `lt_` LoanTracker · `dt_` DebtTracker ·
`inc_` Income · `sp_` Spending · `sav_` Savings · `ret_` Retirement · `inv_` Investment · `ffp_` Shared

---

## Storage Pattern (every module)

```javascript
let _cloudAvailable = null;
async function probeCloudStorage() {
  if (_cloudAvailable !== null) return _cloudAvailable;
  if (!window?.storage?.get) { _cloudAvailable = false; return false; }
  try {
    await Promise.race([
      window.storage.get("__probe__", false),
      new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 2500))
    ]);
    _cloudAvailable = true;
  } catch { _cloudAvailable = false; }
  return _cloudAvailable;
}
async function storeGet(key, shared=false) {
  if (await probeCloudStorage()) {
    try { const r = await window.storage.get(key, shared); return r ? JSON.parse(r.value) : null; }
    catch { _cloudAvailable = false; }
  }
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function storeSet(key, value, shared=false) {
  if (await probeCloudStorage()) {
    try { await window.storage.set(key, JSON.stringify(value), shared); return; }
    catch { _cloudAvailable = false; }
  }
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
const hasCloudStorage = () => _cloudAvailable === true;
```

---

## AI Integration Pattern

```javascript
// PROXY — never call api.anthropic.com directly (CORS blocked in all browser contexts)
const API_URL = "https://ffp-api-proxy.carterspot.workers.dev/";
const MODEL   = "claude-sonnet-4-20250514";

async function callClaude(apiKey, body) {
  const headers = { "Content-Type":"application/json", "anthropic-version":"2023-06-01" };
  if (apiKey?.trim()) headers["x-api-key"] = apiKey.trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(API_URL, { method:"POST", headers, body:JSON.stringify(body), signal:controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res;
  } catch(e) { clearTimeout(timeoutId); throw e; }
}
```
- Non-streaming only — never stream
- API key in `cc_apikey` shared — never hardcode
- Cloudflare Worker `ffp-api-proxy.carterspot.workers.dev` handles CORS

---

## Design System (key tokens)

```javascript
function useTheme(dm) {
  return {
    bg: dm?"#020617":"#f1f5f9", panelBg: dm?"#0f172a":"#ffffff",
    surf: dm?"#1e293b":"#f1f5f9", deepBg: dm?"#0a0f1e":"#ffffff",
    border: dm?"#1e293b":"#e2e8f0", border2: dm?"#334155":"#cbd5e1",
    tx1: dm?"#f1f5f9":"#0f172a", tx2: dm?"#94a3b8":"#64748b", tx3: dm?"#475569":"#94a3b8",
  };
}
const COLOR = {
  primary:"#6366f1", success:"#10b981", warning:"#f59e0b", danger:"#ef4444",
  pink:"#ec4899", blue:"#3b82f6", orange:"#f97316", purple:"#8b5cf6", teal:"#06b6d4",
};
const AVATAR_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];
// Font: 'DM Sans','Segoe UI',sans-serif  |  Monospace for all financial numbers
```

---

## Export Anchor Pattern (all modules)

Detached anchors never trigger downloads. Always use:
```javascript
const a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = "filename.ext";
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
```

---

## Responsive Layout Pattern

```javascript
function useBreakpoint() {
  const [w, setW] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1280);
  useEffect(() => {
    const fn = () => setW(typeof window !== 'undefined' ? window.innerWidth : 1280);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 640, isTablet: w < 960, isDesktop: w >= 960 };
}
```

---

## Workflow

### Build cycle
1. CTO chat → architecture decisions + Code prompt written here
2. Code executes → builds `modules/{name}.jsx`
3. `cd preview && npm run build` — must pass 0 errors, 0 warnings
4. Run pre-ship audit checklist (above)
5. Paste JSX into module's dedicated artifact chat → re-render in place
6. URL stays stable — no `index.html` CONFIG update needed
7. Update `docs/project-instruction.md`, `docs/whats-new.html`, quickstart if needed

### Artifact URL strategy
Each module lives in a **dedicated Claude.ai chat**. Editing in-place = stable URL.
New artifact = new URL = must update `CONFIG` block in `docs/index.html`.

### Doc files to update after every ship
- `docs/project-instruction.md` — module version, features, schema, roadmap
- `docs/whats-new.html` — release notes entry
- `docs/{module}-quickstart.html` — if UX changed
- `docs/index.html` CONFIG block — only if artifact URL changed

---

## AI Advisor — Critical Note

SpendingTracker is the transaction source of truth. All spending flows through it,
including income imported from bank statements. The AI Advisor reads all modules but
**must include a manual correction layer** — users must be able to fix any misread or
incorrectly mapped transaction before the AI plan is generated.
Transaction accuracy = plan accuracy.

---

## Roadmap (next up)
1. Savings Module v1
2. Retirement Module v1
3. Investment Module v1
4. AI Advisor (capstone) — requires manual correction layer
5. Node graph v2 — draggable, Investment node, edge highlighting
6. Platform graduation — Next.js + Supabase
