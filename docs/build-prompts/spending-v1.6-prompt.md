# Build Prompt: SpendingTracker v1.6 — UI Consistency Pass

You are making surgical changes to `modules/spending.jsx`. Do NOT rewrite the file.
SpendingTracker v1.5 is fully functional. You are fixing UI inconsistencies to match
the platform standard established by DebtTracker.

---

## Changes

### 1. Toolbar reorder
The toolbar icon order must match all other modules:
**Screen (sun/moon) → Backup/Restore (floppy) → API (key) → Profile Initials**

Find the toolbar/header icon row and reorder the buttons to match this sequence.
Spending currently has Accounts first — remove it from the toolbar entirely (see #2).

### 2. Move Accounts button to Summary tab header
The Accounts button currently lives in the toolbar. Move it to the Summary tab header row,
right-justified (flex row, space-between: tab title on left, Accounts button on right).
Style: small secondary button, matches existing button styles in the module.
It should only appear when the Summary tab is active.

### 3. Fix Edit Pencil in Profile panel
The profile panel shows a Profile Icon, Name, and Edit Pencil icon. The pencil currently
does nothing. Wire it up to open the existing edit profile modal (rename/avatar/PIN change).
If no edit profile modal exists, create one inline: text input for name, avatar color picker
(from AVATAR_COLORS), save button. Store changes to cc_profiles (shared).

### 4. Backup/Restore panel — rename + Import Transactions button + close X
In the Backup/Restore panel:
- Rename the "Load from File" button to **"Restore Backup"**
- Add a second button next to it: **"Import Transactions"**
  - Clicking "Import Transactions" closes the Backup/Restore panel and opens the existing
    CSV import modal (the same flow triggered by the normal import path)
- Add a close X button (top-right of the panel) if one does not already exist

### 5. Add Account modal — Import Transactions button
In the Add Account modal (where the user sets nickname, type, color, sign-flip):
- Add an **"Import Transactions"** button below the Save button
- Clicking it: saves the account (if not already saved), closes the modal, and opens the
  CSV import modal pre-scoped to the newly created account if possible, or opens the
  standard import flow

---

## Rules
- No new storage keys
- No changes to import flow logic, rules engine, AI, or any other tab
- All JSX rules apply: no return<, no nested JSX-returning functions, no window.confirm,
  no Unicode box-drawing chars in comments
- Pre-ship: `cd preview && npm run build` must pass clean
- Version bump: update internal version comment to v1.6
