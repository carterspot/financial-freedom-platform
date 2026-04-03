# FFP Cross-Module Design & Feature Audit
**Date:** 2026-04-03  
**Auditor:** Claude Code (read-only pass)  
**Modules:** CardTracker v3.1 (CT) · LoanTracker v1.2 (LT) · DebtTracker v1.3 (DT) · IncomeTracker v1.0 (IT) · SpendingTracker v1.3 (ST)

---

## Section 1: Standard UI Components

| Feature | CT | LT | DT | IT | ST | Notes |
|---------|----|----|----|----|----|----|
| Nav bar (sticky, deepBg, logo + module name + badges + dark toggle) | ✅ | ✅ | ✅ | ✅ | ✅ | All correct. CT/LT hide module name text on mobile via `isMobile` check. |
| Dark/light mode toggle (persists to localStorage) | ✅ | ✅ | ✅ | ✅ | ⚠️ | ST uses `ffp_dark` key; should be `sp_dark` per storage prefix convention. All others use module-prefixed key (cc_dark, lt_dark, dt_dark, inc_dark). |
| Cloud sync status badge (☁ Cloud Sync / 💾 Local Only) | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | CT renders `"☁ Sync"/"💾 Local"` (abbreviated). LT renders `"☁ Cloud"/"💾 Local"` (abbreviated). DT/IT/ST render the full design-system strings. CT also hides the badge entirely on mobile. |
| API key modal (🔑 button, password field, show/hide toggle, "API key active" indicator) | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | CT: has show/hide toggle (`type={show?"text":"password"}`), no `apiKeyStatus` indicator. LT: has show/hide, no `apiKeyStatus`. DT: NO show/hide toggle (always `type="password"`), has `apiKeyStatus` indicator (green dot, "Key invalid", "Rate limited"). IT: no show/hide, no `apiKeyStatus`. ST: no show/hide, no `apiKeyStatus`. No module has all four sub-features. |
| Profile switcher (nav dropdown, switch profiles, active checkmark) | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | CT/LT: profile switching opens a full `ProfileModal` (no inline dropdown); there is no `ProfileDropdown` component. DT/IT/ST have an inline avatar dropdown with profile list. Active profile shown via background tint in DT/IT/ST — no explicit checkmark in any module. |
| Profile avatar with color picker | ✅ | ✅ | ✅ | ✅ | ✅ | All 8 `AVATAR_COLORS` used consistently. |
| Recovery PIN field in profile creation | ✅ | ✅ | ✅ | ✅ | ❌ | ST's `FirstRunSetup` component collects only name + avatar color — no Recovery PIN field. |
| Loading screen (spinner + "Local mode" message) | ✅ | ✅ | ✅ | ✅ | ✅ | All use the spin animation + `t.tx2`/`t.tx3` text + local mode fallback note. DT's loading check is at the bottom of the App function (after schedule computation), slightly less efficient but functionally equivalent. |
| ConfirmModal (custom — no window.confirm()) | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | CT uses a `DeleteConfirm` component. LT uses a `DeleteConfirm` component. DT uses `deleteTarget` state + inline confirm modal (no `window.confirm`). IT/ST use a named `ConfirmModal` component. No `window.confirm()` anywhere — rule is upheld — but CT/LT use a different component name that is delete-specific and not reusable. |
| InfoModal / tooltip (no window.alert()) | ✅ | ✅ | ✅ | ❌ | ❌ | CT/LT/DT all have an `InfoModal` component and use it for ℹ️ tooltips. IT and ST have no `InfoModal` component and no equivalent tooltip pattern. No `window.alert()` found anywhere. |

---

## Section 2: Data Operations

| Feature | CT | LT | DT | IT | ST | Notes |
|---------|----|----|----|----|----|----|
| Add item (modal or inline form) | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Edit item (pre-populated modal) | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Delete item (with ConfirmModal) | ✅ | ✅ | ✅ | ✅ | ✅ | See Section 1 note about CT/LT DeleteConfirm naming. |
| Quick Pay / payment logging | ✅ | ✅ | ✅ | N/A | N/A | Not applicable to income/spending modules. |
| Export JSON (appendChild/removeChild anchor pattern) | ✅ | ✅ | ✅ | ✅ | ✅ | All modules use the correct `document.body.appendChild(a); a.click(); document.body.removeChild(a)` pattern. |
| Export CSV (appendChild/removeChild anchor pattern) | ✅ | ✅ | ✅ | ❌ | ✅ | IT has no CSV export at all. DT exports two CSVs (cards separately, loans separately). |
| Import JSON (FILE UPLOAD input, not paste-only) | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | CT/LT: `<input type="file">` + `FileReader`. DT: paste-only `<textarea>` with JSON text. IT: paste-only `<textarea>`. ST: `BackupModal` is "Backup & Export" only — no JSON import at all. |
| Import CSV (FILE UPLOAD input, not paste-only) | ✅ | ✅ | ❌ | ❌ | ✅ | DT and IT have no CSV import. ST has full multi-file CSV import with column mapper. |
| Backup & restore (JSON round-trip verified) | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | CT/LT: full round-trip (export + file-upload import). DT: export JSON works; import is paste-only (no file upload). IT: same as DT — paste-only import. ST: export-only (`BackupModal` title is even "Backup & Export" — no import UI at all). |
| One-click import banner (detect legacy data) | N/A | N/A | ✅ | N/A | N/A | Only DT logically needs this (pulls from `cc_cards_*` and `lt_loans_*`). Correctly implemented. |

---

## Section 3: AI Features

| Feature | CT | LT | DT | IT | ST | Notes |
|---------|----|----|----|----|----|----|
| AI analysis / strategy (callClaude present) | ✅ | ✅ | ✅ | ❌ | ✅ | IT has `API_URL` defined (proxy URL) but no `callClaude` function and no AI features. |
| API_URL pointing to proxy (https://ffp-api-proxy.carterspot.workers.dev/) | ❌ | ❌ | ✅ | ✅ | ✅ | **Critical.** CT uses `https://api.anthropic.com/v1/messages`. LT uses `https://api.anthropic.com/v1/messages`. Both will fail with CORS errors when deployed to GitHub Pages. The proxy was added in DT v1.4; CT/LT were never updated. |
| anthropic-version header (2023-06-01) present in callClaude | ❌ | ❌ | ✅ | N/A | ✅ | CT/LT `callClaude` has only `Content-Type` and `x-api-key` headers — `anthropic-version` is absent. The API may reject these calls or behave unexpectedly. |
| x-api-key header present in callClaude | ✅ | ✅ | ✅ | N/A | ✅ | |
| AbortController with 30s timeout | ❌ | ❌ | ✅ | N/A | ✅ | CT/LT `callClaude` is a bare `fetch()` with no abort or timeout. If the API hangs, the UI hangs forever. |
| aiErrorMsg() error handler | ❌ | ❌ | ✅ | N/A | ❌ | DT centralizes AI error formatting in `aiErrorMsg(e)`. CT, LT, and ST all use ad-hoc `catch(e){ setError(e.message||"...") }` inline. Inconsistent error messages across modules. |
| probeApiKey() on load with nav status indicator | ❌ | ❌ | ✅ | ❌ | ❌ | Only DT calls `probeApiKey(key)` on init and displays a green dot / "Key invalid" / "Rate limited" indicator next to the 🔑 button. CT/LT/IT/ST show no API key health status. |
| Non-streaming only (await res.json()) | ✅ | ✅ | ✅ | N/A | ✅ | No streaming loops anywhere. Rule upheld. |
| AI result copy button (📋) | ✅ | ✅ | ✅ | N/A | ❌ | CT/LT: inline copy button on analysis output. DT: reusable `CopyButton` component used on analysis, strategy, and per-message in What-If chat. ST: AI categorization results have no copy button. |
| AI result download button (⬇ .txt) | ✅ | ✅ | ✅ | N/A | ❌ | CT/LT/DT all have ⬇ .txt download on analysis output. ST has no download for AI results. |
| What-If chat (multi-turn) | ✅ | ✅ | ✅ | ❌ | ❌ | CT/LT/DT all have multi-turn What-If AI chat. IT has no AI. ST's AI is batch categorization — no conversational interface. |
| AI strategy questionnaire (5 questions) | ✅ | ❌ | ✅ | N/A | N/A | CT: 5 questions in inline `Qs` array inside `StrategyTab` ({goal, stress, income, extra, timeline}). DT: 5 questions in `STRATEGY_QUESTIONS` constant. LT has no questionnaire — its AI is refinance analysis and What-If only. |

---

## Section 4: Layout and Navigation

| Feature | CT | LT | DT | IT | ST | Notes |
|---------|----|----|----|----|----|----|
| Responsive layout (useBreakpoint() hook) | ✅ | ✅ | ✅ | ❌ | ❌ | IT and ST do not import or call `useBreakpoint()`. Their layouts do not adapt to screen size. |
| Mobile: 1 column | ✅ | ✅ | ✅ | ❌ | ❌ | IT/ST have fixed layouts regardless of viewport. |
| Tablet: 2 column | ✅ | ✅ | ✅ | ❌ | ❌ | |
| Desktop: multi-column | ✅ | ✅ | ✅ | ❌ | ❌ | |
| Tab navigation (tabBtn active/inactive pattern) | ✅ | ✅ | ✅ | ❌ | ✅ | IT has no tab navigation (single-view stream list by design). CT/LT/DT/ST all use `tabBtn(active, t)` helper or equivalent. |
| Modal overlay (fixed inset, rgba(0,0,0,.72), zIndex 2000) | ✅ | ✅ | ✅ | ✅ | ✅ | All modules use the correct overlay pattern. |
| Sticky nav (zIndex 100) | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Summary/stats row at top of main content | ✅ | ✅ | ✅ | ✅ | ✅ | All modules have a portfolio/summary dashboard above the item list. |

---

## Section 5: Design Token Compliance

| Feature | CT | LT | DT | IT | ST | Notes |
|---------|----|----|----|----|----|----|
| useTheme(darkMode) hook with correct color tokens | ✅ | ✅ | ✅ | ✅ | ✅ | All modules define identical `useTheme` with same token values. |
| COLOR constants (primary, success, warning, danger, etc.) | ✅ | ✅ | ✅ | ✅ | ✅ | DT adds `COLOR.purple` and `COLOR.teal` for debt-type visual coding — consistent with design system extension pattern. |
| AVATAR_COLORS array (8 colors, correct values) | ✅ | ✅ | ✅ | ✅ | ✅ | All 5 modules define identical `["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"]`. |
| Font: DM Sans for UI, monospace for financial numbers | ✅ | ✅ | ✅ | ✅ | ✅ | Root `fontFamily: "'DM Sans','Segoe UI',sans-serif"` on outermost div; `fontFamily:"monospace"` on all financial values. |
| Border radius: modals 20px | ✅ | ✅ | ✅ | ✅ | ✅ | `borderRadius:20` on all modal containers. |
| Border radius: cards/panels 16px | ✅ | ✅ | ✅ | ✅ | ✅ | `panelSt()` helper / `borderRadius:16` on panels across all modules. |
| Border radius: buttons 10px | ✅ | ✅ | ✅ | ✅ | ✅ | `btnPrimary()` and `btnGhost()` use `borderRadius:10` universally. |
| Border radius: inputs 8px | ✅ | ✅ | ✅ | ✅ | ✅ | `inputStyle(t)` helper uses `borderRadius:8` across all modules. |
| Input style: surf background, border, 8px radius, 8px 12px padding | ✅ | ✅ | ✅ | ✅ | ✅ | Consistent across all modules. ST has one inline input in `FirstRunSetup` that replicates the style manually rather than via `inputStyle(t)` — functionally correct. |
| Button primary: primary color, 10px radius, 700 weight | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Button ghost: surf background, border, correct hover | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Panel/card: panelBg, border, 16px radius, 16-20px padding | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Badge/pill: color+"18" bg, color+"33" border | ✅ | ✅ | ✅ | ✅ | ✅ | Pattern consistent across all modules. |
| Tab button: active = primary bg + white text, inactive = surf + tx2 | ✅ | ✅ | ✅ | N/A | ✅ | `tabBtn(active, t)` helper consistent. IT has no tabs. |

---

## Section 6: Dark Mode Compliance

| Feature | CT | LT | DT | IT | ST | Notes |
|---------|----|----|----|----|----|----|
| tx1 used for primary text (never hardcoded) | ✅ | ✅ | ✅ | ✅ | ✅ | All modules use `t.tx1` for primary text. DT had a B1 fix in v1.3 that addressed hardcoded colors in the nav and profile dropdown — now correct. |
| tx2 used for secondary text | ✅ | ✅ | ✅ | ✅ | ✅ | |
| tx3 used for tertiary/muted text | ✅ | ✅ | ✅ | ✅ | ⚠️ | ST uses `t.tx3` for some label text (e.g., "Uncategorized" in `CategoryPill` as `color:"#94a3b8"` hardcoded) in one place — should be `t.tx3`. Minor. |
| No hardcoded background colors in components | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ | CT: loading screen border color hardcoded `"#6366f1"` (should be `COLOR.primary`). LT: same. ST: spinner color hardcoded inline as `#10b981`. These are minor but represent small light-mode drift risks. |
| Nav bar uses deepBg | ✅ | ✅ | ✅ | ✅ | ✅ | All use `t.deepBg` on nav container. |
| Panels use panelBg | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Inputs use surf | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Borders use border or border2 | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Financial negative values use danger, positive use success | ✅ | ✅ | ✅ | ✅ | ✅ | ST `TransactionRow`: `color: transaction.amount<0 ? COLOR.danger : COLOR.success` — correct. |

---

## Section 7: Feature Gap Analysis

| Feature | Missing In | Priority | Notes |
|---------|-----------|----------|-------|
| API_URL → Cloudflare proxy | CT, LT | **High** | Both point directly to `api.anthropic.com` — CORS failure in production/GitHub Pages. DT v1.4 fixed this; CT/LT were never backported. |
| AbortController / 30s timeout in callClaude | CT, LT | **High** | No timeout means a hung API call blocks the UI indefinitely. Added in DT/ST, missing in CT/LT. |
| anthropic-version: 2023-06-01 header | CT, LT | **High** | API version header absent. May cause unpredictable failures or rejection by future API versions. |
| probeApiKey on load + nav status indicator | CT, LT, IT, ST | **High** | Only DT shows API key health (valid/invalid/rate-limited) in the nav. All other modules show no feedback after a key is saved. |
| show/hide toggle on API key field | DT, IT, ST | **High** | CT/LT have it (`type={show?"text":"password"}`). DT/IT/ST always use `type="password"` with no toggle. Users cannot verify their key before saving. |
| Import JSON via file upload (not paste-only) | DT, IT | **High** | CT/LT/ST import via `<input type="file">` + `FileReader`. DT/IT require the user to paste raw JSON into a textarea — error-prone on mobile, not usable for large backups. |
| JSON import exists at all | ST | **High** | ST's `BackupModal` is export-only. No restore path exists in the UI. |
| Responsive layout via useBreakpoint() | IT, ST | **High** | IT and ST have fixed layouts. On a 320px mobile screen, nav items will overflow, forms may be unusable, and lists won't reflow. |
| Export CSV | IT | **High** | CT/LT/DT/ST all have CSV export. IT has JSON export only. |
| aiErrorMsg() standardized error handler | CT, LT, ST | **Medium** | DT centralizes AI error formatting. CT/LT/ST use ad-hoc inline error messages. Error text presented to users is inconsistent across modules. |
| Strategy questionnaire (5 questions) | LT | **Medium** | CT/DT have it. LT's AI is refinance analysis only — no guided questionnaire to build a personalized strategy. Consistent with LT's current feature set but a notable parity gap. |
| InfoModal / ℹ️ tooltip | IT, ST | **Medium** | CT/LT/DT use `InfoModal` for complex tooltip explanations (e.g. "Recalculate Minimums"). IT/ST have no equivalent; `window.alert()` is forbidden and there's currently no substitute. |
| Recovery PIN in profile creation (FirstRunSetup) | ST | **Medium** | CT/LT/DT/IT all include a Recovery PIN field. ST's `FirstRunSetup` collects name + avatar only. Users who create profiles in ST cannot recover them on a new device. |
| Cloud sync badge full text (☁ Cloud Sync / 💾 Local Only) | CT, LT | **Medium** | CT shows "☁ Sync"/"💾 Local". LT shows "☁ Cloud"/"💾 Local". Design spec requires full text. |
| ProfileDropdown inline in nav | CT, LT | **Medium** | DT/IT/ST have an inline avatar dropdown for switching profiles. CT/LT open a full-screen `ProfileModal` on avatar click — there is no lightweight switcher. |
| What-If multi-turn chat | IT, ST | **Medium** | CT/LT/DT all have it. IT has no AI. ST's AI is categorization-only; What-If chat is not applicable to spending but may be desired for "what if I reduce spending in X category." |
| AI result copy + download | ST | **Medium** | CT/LT/DT all provide 📋 Copy and ⬇ .txt on AI output. ST's AI categorization results have no export mechanism. |
| Import CSV | DT, IT | **Medium** | CT/LT/ST all import CSV. DT/IT have no CSV import path. |
| Dark mode storage key (sp_dark not ffp_dark) | ST | **Low** | ST uses `ffp_dark` instead of `sp_dark`. Using a shared `ffp_` key could conflict with a future platform-wide dark mode setting. |
| ConfirmModal consistent naming | CT, LT | **Low** | CT/LT use `DeleteConfirm`. DT/IT/ST use `ConfirmModal`. The CT/LT component is delete-specific and not reusable for other confirmation scenarios. |

**Total ❌ count across Sections 1–6:** 31  
**High priority gaps from Section 7:** 9

---

## Section 8: Remediation Notes (High Priority)

**Gap 1 — CT/LT: API_URL points to api.anthropic.com**  
In `modules/credit-card-tracker.jsx` line 8 and `modules/loan-tracker.jsx` line 14, change `const API_URL = "https://api.anthropic.com/v1/messages"` to `const API_URL = "https://ffp-api-proxy.carterspot.workers.dev/"`. Then update the `callClaude` function in both files to add the `"anthropic-version": "2023-06-01"` header alongside `x-api-key`. Both modules will fail silently or with CORS errors in the deployed GitHub Pages environment without this fix.

**Gap 2 — CT/LT: No AbortController/timeout in callClaude**  
In both `credit-card-tracker.jsx` and `loan-tracker.jsx`, the `callClaude` function is a bare `fetch()` with no timeout protection. Wrap the fetch with an `AbortController` and `setTimeout(() => controller.abort(), 30000)`, matching the pattern in `debt-tracker.jsx` lines 145–161. Pass `signal: controller.signal` to the fetch options and clear the timeout in both the success and catch paths.

**Gap 3 — CT/LT/IT/ST: No probeApiKey on load**  
CT, LT, IT, and ST load the API key from storage on init but never validate it. Add a `probeApiKey(key)` function (matching `debt-tracker.jsx` lines 171–184) that makes a minimal API call and returns `"valid"` / `"invalid"` / `"limited"`. Call it during `init()` if a key is stored and save the result to `apiKeyStatus` state. Update the 🔑 nav button to show a green dot when `apiKeyStatus === "valid"`, matching DT's nav indicator pattern.

**Gap 4 — DT/IT/ST: No show/hide toggle on API key field**  
In `debt-tracker.jsx` `ApiKeyModal`, `income-tracker.jsx` `ApiKeyModal`, and `spending.jsx` `ApiKeyModal`, add a `useState(false)` for `show` and a toggle button (👁 icon) next to the input. Set `type={show ? "text" : "password"}` on the input. CT's implementation at line 744 is the reference pattern.

**Gap 5 — DT/IT: JSON import is paste-only (no file upload)**  
In `debt-tracker.jsx` `BackupModal` and `income-tracker.jsx` `BackupModal`, add a hidden `<input ref={fileRef} type="file" accept=".json">` alongside the existing textarea. Add a "📂 Load from file" button that triggers `fileRef.current.click()`. On `onChange`, use `FileReader` to read the file and populate `importText`. CT's implementation at `modules/credit-card-tracker.jsx` lines 492/576 is the reference.

**Gap 6 — ST: No JSON import**  
`spending.jsx` `BackupModal` (lines 404–455) currently has only `exportJSON` and `exportCSV` functions. Rename the modal title from "Backup & Export" to "Backup & Restore". Add an import tab with a `<input type="file" accept=".json">` + `FileReader` that reads the file, validates the JSON structure (`if (!data.transactions) throw new Error(...)`), and calls a passed-in `onImport(data)` handler. Wire `onImport` in the main App to replace `transactions`, `accounts`, and `categories` state and persist to storage.

**Gap 7 — IT/ST: No responsive layout**  
`income-tracker.jsx` and `spending.jsx` do not call `useBreakpoint()` anywhere. Add the `useBreakpoint` hook (copy from `debt-tracker.jsx` lines 97–106) to each module. In `NavBar` components, use `bp.isMobile` to hide verbose text labels on small screens (module name, badge text). In main content areas, switch grid layouts from fixed columns to `gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)"` for card lists and stat rows.

**Gap 8 — IT: No CSV export**  
`income-tracker.jsx` `BackupModal` has only JSON export. Add an `exportCSV` function that builds a header row (`Name,Type,Frequency,Amount,MonthlyEquivalent,Category,StartDate,Notes`) and maps `streams` array to CSV rows. Use the `document.body.appendChild(a); a.click(); document.body.removeChild(a)` anchor pattern. Add an "⬇ Export CSV" ghost button below the existing JSON export button.

**Gap 9 — ST: No Recovery PIN in FirstRunSetup**  
`spending.jsx` `FirstRunSetup` (lines 1442–1488) collects only `name` and `color`. Add a `pin` state and a Recovery PIN input field with the same label/hint pattern as `income-tracker.jsx` lines 425–434. Include the PIN in the profile object passed to `onComplete`. Store it in the profile record so users who create their first profile in ST can recover their data on a new device.

---

## Section 9: Open-Ended Discrepancy Discovery

### 9.1 Implementation Divergence

**ID-1: callClaude — 3 distinct implementations exist**  
- CT/LT: bare `fetch()`, no timeout, no `anthropic-version`, direct Anthropic URL, no error utility  
- DT: `fetch()` + `AbortController` + `aiErrorMsg()` + proxy URL + version header — the reference implementation  
- ST: same as DT but `aiErrorMsg()` is absent (inline error handling only)  
Severity: **High** — CT/LT will fail in production. ST is incomplete.

**ID-2: Strategy questionnaire — two storage patterns**  
CT uses an inline `Qs` array inside `StrategyTab` and stores answers under `cc_strategy_answers_{profileId}`. DT defines `STRATEGY_QUESTIONS` as a module-level constant and also uses a profile-keyed storage key. The CT pattern hardcodes the questionnaire's answers object as `{goal:"",stress:"",income:"",extra:"",timeline:""}` — if a question is ever added, the storage shape must be manually updated. The DT pattern using a constant is more maintainable.  
Severity: **Low**

**ID-3: Delete confirmation — three component names for the same pattern**  
CT has `DeleteConfirm({cardName, onConfirm, onCancel, darkMode})`. LT has `DeleteConfirm({loanName, onConfirm, onCancel, darkMode})`. DT/IT/ST use `ConfirmModal` with a generic `title/body/confirmLabel` API. CT/LT's components are delete-specific, take a `darkMode` boolean instead of a `t` theme object, and cannot be reused for other confirmation flows.  
Severity: **Medium**

**ID-4: Profile dropdown vs. ProfileModal — two UX patterns**  
CT/LT open a full-screen `ProfileModal` for profile actions (including switching). DT/IT/ST have a lightweight inline `ProfileDropdown` in the nav that lists profiles for quick switching. CT/LT's approach is disruptive for the common case of switching between family member profiles.  
Severity: **Medium**

**ID-5: Dark mode storage key divergence**  
All modules use a module-prefixed key — `cc_dark`, `lt_dark`, `dt_dark`, `inc_dark` — except ST which uses `ffp_dark`. This is inconsistent with the `sp_` storage prefix convention for SpendingTracker. No functional impact today, but `ffp_dark` would conflict if a platform-level dark mode setting is introduced using the `ffp_` shared namespace.  
Severity: **Low**

**ID-6: Cloud sync badge text — three different strings**  
CT: `"☁ Sync"` / `"💾 Local"`. LT: `"☁ Cloud"` / `"💾 Local"`. DT/IT/ST: `"☁ Cloud Sync"` / `"💾 Local Only"`. The design system specifies the full strings. The abbreviated versions in CT/LT are de-facto divergences from the spec, not intentional responsive optimizations (CT further hides the badge entirely on mobile).  
Severity: **Medium**

---

### 9.2 Internal Inconsistencies Within a Module

**IC-1: CT — one CSV export missing removeChild**  
CT has two CSV export paths. The cards CSV export (line 358) uses the correct `appendChild/click/removeChild` pattern. A second export path (line 406) splits `appendChild` and `removeChild` across lines but is functionally correct. However, a separate export at line 992 (strategy download) omits `URL.revokeObjectURL(url)` after removal — a minor memory leak compared to the other exports which do revoke.  
Severity: **Low**

**IC-2: DT — loading screen placement inefficiency**  
DT's `if (loading) return (...)` guard is placed at the bottom of the App function, after `computeUnifiedSchedule()` has already been called. This means the expensive schedule computation runs on every render during the loading state. CT/LT/IT/ST place the loading guard before any heavy computation.  
Severity: **Low**

**IC-3: IT — ApiKeyModal receives `apiKey` and passes it to `onSave` but never validates or calls probeApiKey**  
The IT `saveApiKey(key)` handler sets state, closes the modal, and writes to storage, but does not call `probeApiKey`. The 🔑 button in the nav changes color when `apiKey` is truthy (color shifts to purple), which gives a false signal that the key is working when it may be invalid.  
Severity: **Medium**

**IC-4: ST — FirstRunSetup stores `color` but no `avatarColor`**  
The ST `FirstRunSetup` component builds `{ id, name, color, avatar }`. All other modules store the field as `avatarColor` (CT: `profile.avatarColor`, LT: `profile.avatarColor`, DT: `profile.avatarColor`, IT: `profile.avatarColor`). ST stores `color`. The nav avatar renderer in IT/DT uses `p.avatarColor||COLOR.primary`. If a profile created in ST is loaded by another module, the avatar color will fall back to indigo regardless of the user's selection.  
Severity: **High** — Cross-module profile schema incompatibility.

**IC-5: DT — `ConfirmModal` not found as a standalone component**  
DT uses `deleteTarget` state for delete confirmation but there is no `function ConfirmModal(...)` component in debt-tracker.jsx. The delete confirmation UI appears to be rendered inline in the main App JSX. This works but means DT cannot reuse a named ConfirmModal elsewhere in the module without duplicating the inline pattern. This is an inconsistency with its own codebase where `CopyButton` and `InfoModal` are reusable components.  
Severity: **Low**

---

### 9.3 Drift From Design System

**DS-1: CT/LT callClaude never received the DT/ST upgrades**  
The design system's `callClaude` pattern (proxy URL + AbortController + anthropic-version + aiErrorMsg) was established with DT v1.4. CT and LT were not backported. This represents the largest functional drift — early modules diverged from a pattern that was correct when they were written and was never retroactively applied.  
Severity: **High**

**DS-2: tabBtn borderRadius — DT uses 8px, design system specifies buttons at 10px**  
The `tabBtn()` helper in `debt-tracker.jsx` uses `borderRadius:8`. CT/LT/ST all use `borderRadius:8` in their tab helpers too. The design system specifies buttons at 10px radius. Tab buttons may have intentionally been 8px (slightly differentiated from primary action buttons) — but it is an undocumented exception. Design system should be clarified.  
Severity: **Low**

**DS-3: IT NavBar — no mobile adaptations despite being the most recently deployed module**  
IT was deployed after DT which has full `useBreakpoint()` responsive behavior. IT's NavBar does not use `isMobile` at all — labels are always visible at full width. On a 375px screen the nav will show "Income Tracker" + two badges + 4 buttons simultaneously, likely overflowing.  
Severity: **High**

---

### 9.4 Dead Code or Stale Patterns

**DC-1: IT — API_URL constant is defined but never used**  
`income-tracker.jsx` line 4 defines `const API_URL = "https://ffp-api-proxy.carterspot.workers.dev/"`. There is no `callClaude` function and no AI feature in IT. The constant is dead code.  
Severity: **Low** — Benign placeholder, may be intentional for future AI addition.

**DC-2: CT/LT — callClaude pattern predates aiErrorMsg; error handling is duplicated inline**  
Each AI-calling function in CT and LT has its own `catch(e){ setError(e.message||"Failed") }` block. This was the correct pattern before `aiErrorMsg()` was introduced in DT. These inline patterns are not wrong but represent stale code that should be unified when CT/LT are updated for the proxy fix.  
Severity: **Low**

---

### 9.5 Other Findings

**OT-1: ST BackupModal has no restore path — data loss risk**  
The ST `BackupModal` is titled internally as "Backup & Export" and contains only export functions. A user who exports a JSON backup of their spending data cannot restore it within ST. If a user clears their browser or switches devices, all spending data is permanently inaccessible. This is the most user-facing consequence gap in the platform.  
Severity: **High**

**OT-2: Cross-module profile schema mismatch (color vs avatarColor)**  
Elaboration of IC-4: All modules share `cc_profiles` and `cc_active_profile` storage keys. The profile object shape written by different modules differs: ST writes `{id, name, color, avatar}` while CT/LT/DT/IT write `{id, name, avatarColor, pin}` (with some variation on `pin` vs no pin). If a user creates their profile in ST first (which has its own `FirstRunSetup`), that profile object will be missing `avatarColor` and `pin`, causing avatar fallback to the default color in all other modules and an inability to use Recovery PIN.  
Severity: **High**

**OT-3: LT backup button hidden on desktop in one branch but shown in both mobile branches**  
LT nav has two backup button renders: `{!isMobile&&<button onClick={()=>setShowBackup(true)}...>📦</button>}` AND `{isMobile&&<button onClick={()=>setShowBackup(true)}...>📦</button>}`. This covers both cases but is redundant. Both blocks render the same button with slightly different padding — this should be a single conditional with padding controlled by `isMobile`. Not a bug but is unnecessary duplication.  
Severity: **Low**

**OT-4: DT loads `dt_cards_*` and `dt_loans_*` per-profile storage, not `cc_cards_*` and `lt_loans_*`**  
DT has its own storage keys (`dt_cards_{profileId}`, `dt_loans_{profileId}`) separate from `cc_cards_{profileId}` and `lt_loans_{profileId}`. The one-click import banner bridges these at first load. However, after import, DT and CT diverge on card data — edits in one module are not reflected in the other. This is by design per the PI but worth noting: users who run both CT and DT will have two independent copies of their card data.  
Severity: **Low** (by design — but worth flagging for user-facing documentation)

**OT-5: ST hasCloudStorage() is a function call, not a stored value**  
ST calls `hasCloudStorage()` inline inside JSX (in the nav badge and elsewhere). This is a function that returns `_cloudAvailable === true` — a module-level let variable. CT/LT/DT/IT all use the same pattern. The pattern is fine, but calling it inside render is slightly wasteful compared to reading a state variable. Minor.  
Severity: **Low**
