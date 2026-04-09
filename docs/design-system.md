# Financial Freedom Platform — Design System

Every module uses this design system exactly. Consistency across modules is what makes the platform feel like one product rather than six separate tools.

---

## Theme System

All components receive a `darkMode` boolean prop and call `useTheme()` to get the current color set. **Never hardcode background or text colors** — always use theme tokens.

```javascript
function useTheme(dm) {
  return {
    bg:      dm ? "#020617" : "#f1f5f9",  // page background
    panelBg: dm ? "#0f172a" : "#ffffff",  // card/panel background
    surf:    dm ? "#1e293b" : "#f1f5f9",  // surface (inputs, secondary panels)
    deepBg:  dm ? "#0a0f1e" : "#ffffff",  // nav bar, deep backgrounds
    border:  dm ? "#1e293b" : "#e2e8f0",  // standard border
    border2: dm ? "#334155" : "#cbd5e1",  // stronger border
    tx1:     dm ? "#f1f5f9" : "#0f172a",  // primary text
    tx2:     dm ? "#94a3b8" : "#64748b",  // secondary text
    tx3:     dm ? "#475569" : "#94a3b8",  // tertiary/muted text
  };
}
```

---

## Accent Colors

These are global constants — use them directly, not via the theme object.

```javascript
const COLOR = {
  primary:   "#6366f1",  // indigo — buttons, highlights, active states
  success:   "#10b981",  // emerald — positive values, cloud sync, paid off
  warning:   "#f59e0b",  // amber — caution, warnings, missing setup
  danger:    "#ef4444",  // red — negative values, delete, overdue
  pink:      "#ec4899",  // secondary accent, charts
  blue:      "#3b82f6",  // tertiary accent, charts
  orange:    "#f97316",  // interest costs, charts
  purple:    "#8b5cf6",  // strategy, AI features
  teal:      "#06b6d4",  // savings, progress
};
```

**Semantic usage:**
- Positive dollar amounts / savings → `success` (#10b981)
- Negative dollar amounts / debt / interest cost → `danger` (#ef4444) or `orange` (#f97316)
- AI-powered features → `purple` (#8b5cf6)
- Primary actions → `primary` (#6366f1)
- Warnings / incomplete setup → `warning` (#f59e0b)

---

## Typography

```javascript
// Font stack — applied to root div of every module
fontFamily: "'DM Sans', 'Segoe UI', sans-serif"

// Monospace — for all financial numbers and amounts
fontFamily: "monospace"
```

**Type scale:**
| Use | Size | Weight |
|---|---|---|
| Page/modal title | 17–20px | 800 |
| Section heading | 14–15px | 700–800 |
| Body / card content | 13px | 400–600 |
| Labels / metadata | 11–12px | 400–600 |
| Badges / tiny text | 9–11px | 600 |

---

## Spacing & Layout

**Border radius:**
| Element | Radius |
|---|---|
| Modals | 20px |
| Cards / panels | 14–16px |
| Buttons (primary) | 10px |
| Buttons (small) | 8px |
| Inputs | 8px |
| Badges / pills | 6px |
| Avatar circles | 50% |

**Standard padding:**
- Modal container: `24px`
- Panel / card: `16–20px`
- Input fields: `8px 12px`
- Small buttons: `6px 11px`
- Primary buttons: `9–12px 0` (full width) or `9px 20px`

---

## Component Patterns

### Input fields
```javascript
const inputStyle = {
  width: "100%",
  background: t.surf,
  border: `1px solid ${t.border}`,
  borderRadius: 8,
  padding: "8px 12px",
  color: t.tx1,
  fontSize: 13,
  boxSizing: "border-box"
};
```

### Field labels
```javascript
const labelStyle = {
  fontSize: 11,
  color: t.tx2,
  display: "block",
  marginBottom: 4,
  fontWeight: 600
};
```

### Primary button
```javascript
{
  background: COLOR.primary,        // or relevant color
  border: "none",
  borderRadius: 10,
  padding: "9px 0",                 // full-width
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
  transition: "all .2s"
}
```

### Secondary / ghost button
```javascript
{
  background: t.surf,
  border: `1px solid ${t.border}`,
  borderRadius: 10,
  padding: "9px 0",
  color: t.tx1,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13
}
```

### Panel / card
```javascript
{
  background: t.panelBg,
  border: `1px solid ${t.border}`,
  borderRadius: 16,
  padding: "16px 20px"
}
```

### Modal overlay + container
```javascript
// Overlay
{
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,.72)",
  zIndex: 2000,
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 16, overflowY: "auto"
}
// Container
{
  background: t.panelBg,
  borderRadius: 20,
  width: "100%", maxWidth: 440,   // or 520, 640, 960 depending on content
  padding: 24,
  boxShadow: "0 20px 60px rgba(0,0,0,.5)",
  maxHeight: "90vh", overflowY: "auto"
}
```

### Badge / status pill
```javascript
{
  fontSize: 10,
  color: COLOR.success,
  background: COLOR.success + "18",
  border: `1px solid ${COLOR.success}33`,
  borderRadius: 6,
  padding: "2px 8px"
}
```

### Tab button (active/inactive)
```javascript
const tabStyle = (active) => ({
  background: active ? COLOR.primary : t.surf,
  color: active ? "#fff" : t.tx2,
  border: `1px solid ${active ? COLOR.primary : t.border}`,
  borderRadius: 8,
  padding: "7px 20px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
  transition: "all .15s"
});
```

---

## Avatar Colors

Used for profile avatars and color pickers across all modules.

```javascript
const AVATAR_COLORS = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f97316", // orange
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#f43f5e", // rose
  "#06b6d4", // cyan
];
```

---

## Nav Bar Pattern

Every module has a sticky top nav bar following this structure:

```
[Logo + Module Name] [item count badge] [sync status badge]    [dark mode] [backup] [api key] [profile avatar]
```

```javascript
// Nav container
{
  background: t.deepBg,
  borderBottom: `1px solid ${t.border}`,
  padding: "11px 20px",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  position: "sticky", top: 0, zIndex: 100
}
```

**Sync status badge:**
- Cloud: green `☁ Cloud Sync`
- Local: amber `💾 Local Only`

---

## Loading Screen Pattern

```javascript
// Full-page loading state
<div style={{
  minHeight: "100vh", background: t.bg,
  display: "flex", alignItems: "center", justifyContent: "center",
  flexDirection: "column", gap: 16, padding: 20
}}>
  <div style={{
    width: 40, height: 40,
    border: "3px solid #6366f1", borderTopColor: "transparent",
    borderRadius: "50%", animation: "spin .8s linear infinite"
  }}/>
  <div style={{ fontSize: 14, color: t.tx2, textAlign: "center" }}>
    Loading…
  </div>
  <div style={{ fontSize: 12, color: t.tx3, textAlign: "center", maxWidth: 280 }}>
    If a login prompt appeared, you can close it — the app will load in local mode automatically.
  </div>
  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
</div>
```

---

## Charts

All charts are hand-rolled SVG. No external libraries.

**Standard chart dimensions:**
```javascript
const W=600, H=260, PL=64, PR=16, PT=20, PB=48;
const cW = W - PL - PR;  // chart width
const cH = H - PT - PB;  // chart height
```

Charts are rendered in a `viewBox="0 0 600 260"` SVG with `preserveAspectRatio="none"` inside a responsive container.

---

## Critical JSX Rules

These apply to every artifact. Violating them causes `returnReact is not defined` crashes.

1. **Always `return (` or `return <` with a space** — never `return<`
2. **Never define JSX-returning functions inside a component** — hoist all to top level
3. **Never use `window.confirm()`** — use a custom `<ConfirmModal>` component
4. **Never stream AI responses** — use `await res.json()` only
5. **All components are top-level named functions** — no inline component definitions

---

## Module Shell Template

Every new module starts from this shell:

```jsx
import { useState, useEffect, useRef } from "react";

// --- Constants ---
const MODULE_PREFIX = "xxx_";  // change per module
const API_URL = "https://ffp-api-proxy.carterspot.workers.dev/";  // NEVER api.anthropic.com directly
const MODEL   = "claude-sonnet-4-20250514";
const AVATAR_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];

// --- Helpers ---
const generateId  = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const fmt$        = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);

// --- Theme ---
function useTheme(dm) {
  return {
    bg: dm?"#020617":"#f1f5f9", panelBg: dm?"#0f172a":"#ffffff",
    surf: dm?"#1e293b":"#f1f5f9", deepBg: dm?"#0a0f1e":"#ffffff",
    border: dm?"#1e293b":"#e2e8f0", border2: dm?"#334155":"#cbd5e1",
    tx1: dm?"#f1f5f9":"#0f172a", tx2: dm?"#94a3b8":"#64748b", tx3: dm?"#475569":"#94a3b8",
  };
}

// --- Storage ---
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

// --- AI ---
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

// --- Module-specific components go here ---


// --- Main App ---
export default function App() {
  const [loading, setLoading]   = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("ffp_dark") !== "false");
  const [apiKey, setApiKey]     = useState("");
  const t = useTheme(darkMode);

  useEffect(() => { localStorage.setItem("ffp_dark", darkMode); }, [darkMode]);

  useEffect(() => {
    async function init() {
      const key = await storeGet(`${MODULE_PREFIX}apikey`, true);
      if (key) setApiKey(key);
      // load module-specific data here
      setLoading(false);
    }
    init();
  }, []);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:t.bg, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16, padding:20 }}>
      <div style={{ width:40, height:40, border:"3px solid #6366f1", borderTopColor:"transparent", borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
      <div style={{ fontSize:14, color:t.tx2, textAlign:"center" }}>Loading…</div>
      <div style={{ fontSize:12, color:t.tx3, textAlign:"center", maxWidth:280 }}>If a login prompt appeared, close it — the app loads in local mode automatically.</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:t.bg, fontFamily:"'DM Sans','Segoe UI',sans-serif", color:t.tx1 }}>
      {/* Nav */}
      <div style={{ background:t.deepBg, borderBottom:`1px solid ${t.border}`, padding:"11px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:"linear-gradient(135deg,#6366f1,#ec4899)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>💳</div>
          <span style={{ fontWeight:800, fontSize:18, color:t.tx1 }}>Module Name</span>
          <span title={hasCloudStorage()?"Cloud sync active":"Saved locally"} style={{ fontSize:10, color:hasCloudStorage()?"#10b981":"#f59e0b", background:hasCloudStorage()?"#10b98118":"#f59e0b18", border:`1px solid ${hasCloudStorage()?"#10b98133":"#f59e0b33"}`, borderRadius:6, padding:"2px 8px" }}>
            {hasCloudStorage() ? "☁ Cloud Sync" : "💾 Local Only"}
          </span>
        </div>
        <button onClick={() => setDarkMode(d => !d)} style={{ background:t.surf, border:`1px solid ${t.border}`, borderRadius:8, padding:"6px 11px", color:t.tx1, cursor:"pointer", fontSize:14 }}>
          {darkMode ? "☀️" : "🌙"}
        </button>
      </div>

      {/* Main content */}
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"20px 16px" }}>
        {/* Module content goes here */}
      </div>
    </div>
  );
}
```

---

## Canonical Patterns

These patterns are mandatory in every module. Copy exactly — do not improvise.

### callClaude — AI API call

**Never call `api.anthropic.com` directly** — CORS is blocked in all browser contexts.
Always use the Cloudflare Worker proxy. Both headers are required; omitting `anthropic-version` causes silent failures.

```javascript
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

Usage:
```javascript
const res = await callClaude(apiKey, {
  model: MODEL, max_tokens: 1024,
  messages: [{ role:"user", content: "..." }]
});
const data = await res.json();  // NEVER stream — always res.json()
const text = data.content[0].text;
```

---

### useBreakpoint — responsive layout

**Never use `window.innerWidth` directly in `useState()`** — crashes the artifact renderer.
Always use the lazy initializer guard.

```javascript
function useBreakpoint() {
  const [w, setW] = useState(() => typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    const fn = () => setW(typeof window !== "undefined" ? window.innerWidth : 1280);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 640, isTablet: w < 960, isDesktop: w >= 960 };
}
```

---

### API key probe — show/hide + status indicator

```javascript
// In component state
const [apiKey, setApiKey] = useState("");
const [apiKeyStatus, setApiKeyStatus] = useState("unknown"); // "valid" | "invalid" | "unknown"

// Status dot in nav bar
const statusColor = { valid:"#10b981", invalid:"#ef4444", unknown:"#f59e0b" }[apiKeyStatus];
<span style={{ width:8, height:8, borderRadius:"50%", background:statusColor, display:"inline-block" }} />

// Validate on save (lightweight — just check format)
function saveApiKey(key) {
  const trimmed = key.trim();
  setApiKey(trimmed);
  setApiKeyStatus(trimmed.startsWith("sk-ant-") ? "valid" : trimmed ? "invalid" : "unknown");
  storeSet("cc_apikey", trimmed, true);
}
```

---

### File export — anchor pattern

**Never use a detached anchor** — `a.click()` without appending to the DOM silently fails on some browsers.

```javascript
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// JSON export
downloadFile(JSON.stringify(data, null, 2), "backup.json", "application/json");

// CSV export
const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
downloadFile(csv, "export.csv", "text/csv");
```

---

### Expandable card — the platform's primary list item pattern

Used in DebtTracker for debts, Savings for funds, Investment for accounts. All list items with collapsible detail use this pattern. **Do not invent alternatives.**

```javascript
// Each card is a top-level component: function DebtCard({ item, t, accentColor }) { ... }

// Card container
const cardStyle = (expanded) => ({
  background: t.panelBg,
  border: `1px solid ${t.border}`,
  borderLeft: `4px solid ${accentColor}`,
  borderRadius: 14,
  overflow: "hidden",
  marginBottom: 10,
  transition: "box-shadow .15s"
});

// Header row (always visible — clicking toggles expand)
const headerStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px",
  cursor: "pointer",
  userSelect: "none"
};

// Chevron (right side of header)
const chevronStyle = (expanded) => ({
  fontSize: 16,
  color: t.tx3,
  transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
  transition: "transform .2s",
  marginLeft: "auto",
  flexShrink: 0
});
// Render: <span style={chevronStyle(expanded)}>›</span>

// Expanded detail panel
const detailStyle = {
  padding: "0 16px 16px",
  borderTop: `1px solid ${t.border}`,
};
```

**Collapsed state shows:** accent color badge or icon · item name · primary metric (large, monospace) · secondary metric (small, t.tx2) · action buttons (edit/delete) · chevron

**Expanded state reveals:** full detail fields · progress section · action buttons · sub-lists (e.g. goals within a fund)

**Progress bar** (used inside expanded cards and on overview stat rows):
```javascript
// Track
{ height: 7, background: t.surf, borderRadius: 99, overflow: "hidden", margin: "8px 0" }
// Fill
{ height: "100%", width: `${Math.min(pct, 100)}%`, background: accentColor,
  borderRadius: 99, transition: "width .4s ease" }
// Always clamp pct to 0-100 for display. Show actual number separately if >100%.
```

**Stat card** (summary row above card list):
```javascript
{
  background: t.panelBg,
  border: `1px solid ${t.border}`,
  borderRadius: 14,
  padding: "16px 20px",
  display: "flex",
  flexDirection: "column",
  gap: 4
}
// Label:  fontSize 11, color t.tx2, fontWeight 600, textTransform "uppercase", letterSpacing ".5px"
// Value:  fontSize 24, fontWeight 800, fontFamily "monospace", color accentColor
// Sub:    fontSize 11, color t.tx3
```

---

### File import — CSV + JSON via file input

```javascript
// File input (hidden, triggered by button click)
const fileRef = useRef(null);

<input
  ref={fileRef}
  type="file"
  accept=".json,.csv"
  style={{ display:"none" }}
  onChange={e => handleFileImport(e.target.files[0])}
/>
<button onClick={() => fileRef.current?.click()}>Import</button>

// Handler
function handleFileImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      if (file.name.endsWith(".json")) {
        const data = JSON.parse(e.target.result);
        // show Replace or Merge modal
        setPendingImport(data);
        setShowImportModal(true);
      } else if (file.name.endsWith(".csv")) {
        const lines = e.target.result.split("\n").filter(l => l.trim());
        const headers = lines[0].split(",").map(h => h.replace(/"/g,"").trim());
        const rows = lines.slice(1).map(line => {
          const vals = line.split(",").map(v => v.replace(/"/g,"").trim());
          return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
        });
        setPendingImport(rows);
        setShowImportModal(true);
      }
    } catch { /* show error state */ }
    e.target.value = ""; // reset so same file can be re-selected
  };
  reader.readAsText(file);
}
```

**Replace or Merge modal pattern:**
- **Replace**: `storeSet(key, importedData, true)`
- **Merge**: dedup by `id`, append new records only:
  ```javascript
  const existing = await storeGet(key, true) || [];
  const existingIds = new Set(existing.map(r => r.id));
  const merged = [...existing, ...importedData.filter(r => !existingIds.has(r.id))];
  storeSet(key, merged, true);
  ```
