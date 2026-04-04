# Build Prompt: DebtTracker v1.5 — UI Consistency Pass

You are making surgical changes to `modules/debt-tracker.jsx`. Do NOT rewrite the file.
DebtTracker v1.4 is fully functional. You are fixing two UI inconsistencies.

---

## Changes

### 1. Save/Backup icon → floppy disk
The Backup/Restore toolbar button currently shows an incorrect icon (not a floppy disk).
Change it to the standard floppy disk icon (💾 or an SVG floppy).

### 2. Backup/Restore — rename + add CSV import
The Backup/Restore panel already supports CSV export (cards and loans separately).
Two changes needed:

**a. Rename "Load from File" → "Restore Backup"**
This button restores the full JSON backup. Name change only — no logic change.

**b. Add CSV import (cards and loans separately)**
The panel already has CSV export buttons for cards and loans.
Add a matching CSV import button next to each export button:
- **Import Cards CSV** — file input, accept=".csv"
- **Import Loans CSV** — file input, accept=".csv"

CSV column order must match the existing CSV export format for each type.

**Card CSV columns (in order):**
`id, name, issuer, type, color, balance, creditLimit, apr, minPayment, dueDay, statementDay, promoApr, promoEndDate, closed, notes`

**Loan CSV columns (in order):**
`id, name, lender, type, color, originalBalance, currentBalance, interestRate, monthlyPayment, termMonths, remainingMonths, nextPaymentDay, notes`

For each CSV import, show a Replace or Merge modal (same UX as JSON import):
- **Replace**: overwrites `dt_cards_{profileId}` or `dt_loans_{profileId}` entirely
- **Merge**: deduplicates by `id`, appends new records
- After import, reload debts from storage

---

## Card schema (reference)
```json
{
  "id": "...", "name": "...", "issuer": "...", "type": "credit",
  "color": "#6366f1", "balance": "4200.00", "creditLimit": "8000",
  "apr": "22.99", "minPayment": "85.00", "dueDay": "15", "statementDay": "8",
  "promoApr": "", "promoEndDate": "", "closed": false, "notes": ""
}
```

## Loan schema (reference)
```json
{
  "id": "...", "name": "Toyota Camry", "lender": "Chase Auto", "type": "auto",
  "color": "#3b82f6", "originalBalance": "25000", "currentBalance": "18500.00",
  "interestRate": "6.900", "monthlyPayment": "485.00", "termMonths": 60,
  "remainingMonths": "42", "nextPaymentDay": "15", "notes": ""
}
```

---

## Rules
- No new storage keys
- No changes to planner, AI, calendar, or any other feature
- All JSX rules apply: no return<, no nested JSX-returning functions, no window.confirm,
  no Unicode box-drawing chars in comments
- Pre-ship: `cd preview && npm run build` must pass clean
- Version bump: update internal version comment to v1.5
