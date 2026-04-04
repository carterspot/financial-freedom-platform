# Build Prompt: IncomeTracker v1.2 — UI Consistency Pass

You are making surgical changes to `modules/income-tracker.jsx`. Do NOT rewrite the file.
IncomeTracker v1.1 is fully functional. You are fixing UI inconsistencies to match
the platform standard established by DebtTracker.

---

## Changes

### 1. Save/Backup icon → floppy disk
The Backup/Restore toolbar button currently shows an incorrect icon (not a floppy disk).
Change it to the standard floppy disk icon (💾 or an SVG floppy). Must match Spending and Debt.

### 2. Toolbar reorder
The toolbar icon order must match the platform standard:
**Screen (sun/moon) → Backup/Restore (floppy) → API (key) → Profile Initials**

Reorder existing toolbar buttons to match this sequence exactly.

### 3. Profile panel — add Edit + Add New Profile
The profile panel currently shows only Profile Icon and Name.
Add the following to match the platform standard (DebtTracker reference):
- **Edit Pencil** — opens an edit modal: name input, avatar color picker (AVATAR_COLORS constant),
  optional PIN field. Saves changes to cc_profiles (shared, storeSet).
- **Add New Profile** — opens a new profile modal: name input, avatar color picker, optional PIN.
  Appends to cc_profiles (shared). Switches active profile to the new one.

Both modals must be top-level named components (not defined inside another component).
No window.confirm or window.alert — use ConfirmModal for destructive actions.

### 4. Backup/Restore — rename + CSV export/import
In the Backup/Restore panel:
- Rename "Load from File" → **"Restore Backup"**
- The existing JSON export/import stays exactly as-is (Replace or Merge pattern)
- Add **CSV export** button: exports `inc_streams_{profileId}` as a flat CSV
  CSV columns (in order):
  `id, name, type, amount, frequency, stabilityRating, afterTax, startDate, endDate, notes, categoryId, color`
  Use the `document.body.appendChild(a) / a.click() / document.body.removeChild(a)` pattern.
  Filename: `income-streams-{profileId}-{YYYY-MM-DD}.csv`
- Add **CSV import** button (file input, accept=".csv"):
  - Parse CSV rows back into income stream objects using the same column order above
  - Show Replace or Merge modal (same UX as JSON import):
    - **Replace**: overwrites `inc_streams_{profileId}` entirely
    - **Merge**: deduplicates by `id`, appends new records
  - After import, reload streams from storage

---

## Income stream schema (reference)
```json
{
  "id": "generated",
  "name": "Salary",
  "type": "W2",
  "amount": "5000",
  "frequency": "Monthly",
  "stabilityRating": "Stable",
  "afterTax": true,
  "startDate": "2024-01-01",
  "endDate": "",
  "notes": "",
  "categoryId": "inc_001",
  "color": "#6366f1"
}
```

---

## Rules
- No new storage keys
- All JSX rules apply: no return<, no nested JSX-returning functions, no window.confirm,
  no Unicode box-drawing chars in comments
- Pre-ship: `cd preview && npm run build` must pass clean
- Version bump: update internal version comment to v1.2
