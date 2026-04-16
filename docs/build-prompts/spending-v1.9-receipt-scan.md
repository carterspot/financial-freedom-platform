# Build Prompt — SpendingTracker v1.9: Receipt Scan

## Before Starting
Read in order:
1. `CLAUDE.md` — JSX rules, storage pattern, module list
2. `docs/project-instruction.md` — SpendingTracker v1.8 section (storage keys, transaction schema, architecture)
3. `modules/spending.jsx` — read the full file before making any changes

---

## Objective
Add receipt scanning to SpendingTracker. One feature, no other changes. Do not refactor, reorganize, or touch anything outside the scope defined below.

**Feature summary:**
- User selects one or more receipt images (camera or file picker)
- Each image is sent to Claude via the existing Cloudflare Worker proxy
- Claude extracts merchant, date, total, and line items from each image (multiple receipts per image supported)
- User sees a review screen: all extracted receipts displayed, AI-suggested categories shown, editable before confirm
- On confirm, SpendingTracker checks for duplicates against existing transactions
- Confirmed transactions are logged as flat transactions (same schema as existing — no splits in this version)

---

## New Top-Level Components and Helpers

Hoist all of the following to top level. Never define JSX-returning functions inside another component.

### 1. `readFileAsBase64(file)` — helper function (not a component)
```javascript
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve({ base64, mediaType: file.type || 'image/jpeg' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

### 2. `extractReceiptsFromImage(apiKey, base64, mediaType)` — helper function (not a component)
Calls Claude with a vision prompt. Returns a parsed array of receipt objects.

```javascript
async function extractReceiptsFromImage(apiKey, base64, mediaType) {
  const body = {
    model: MODEL,
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64 }
        },
        {
          type: "text",
          text: `Extract all receipts visible in this image. For each receipt found return:
- merchant: store or restaurant name (string)
- date: purchase date in YYYY-MM-DD format (string; use today's date if unclear)
- total: final charged total as a number (include tax, exclude tip if tip is handwritten separately)
- items: array of line items, each with:
  - description: item name (string)
  - amount: item price as a number
  - suggestedCategory: best match from this list only — Groceries, Dining Out, Gas, Shopping, Electronics, Household, Health & Medical, Personal Care, Entertainment, Clothing, Baby & Kids, Pet Care, Subscriptions, Other

Return ONLY a JSON object in this exact shape: {"receipts": [...]}
If no receipt is found, return: {"receipts": []}
No explanation. No markdown. JSON only.`
        }
      ]
    }]
  };

  const res = await callClaude(apiKey, body);
  const data = await res.json();
  const raw = data.content?.[0]?.text || '{"receipts":[]}';

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.receipts) ? parsed.receipts : [];
  } catch {
    return [];
  }
}
```

### 3. `ReceiptScanModal` — top-level component
Full review screen. Props: `{ open, onClose, onConfirm, apiKey, profileId, existingTransactions, t, isMobile }`

**Behavior:**
- When `open` is true, renders a full-screen modal overlay (same pattern as other modals in spending.jsx)
- Contains a hidden file input: `accept="image/*"` with no `capture` attribute (lets browser decide — camera on mobile, file picker on desktop). Allow `multiple` to select multiple image files at once.
- On mount (when `open` becomes true), immediately trigger the file input click to open the picker
- After files selected: show a loading state ("Scanning receipts…") and call `extractReceiptsFromImage` for each file in parallel via `Promise.all`
- Consolidate all results into a single flat array of receipt objects
- Display each receipt as a card (see layout below)
- Show "Confirm All" button at bottom and individual "Discard" per receipt card

**Receipt card layout (per extracted receipt):**
- Header row: editable merchant name input + editable date input (type="date")
- Total row: editable total amount input (type="number")
- Line items section (collapsed by default, expandable with chevron):
  - Each item: description (read-only) + amount (read-only) + category dropdown (editable)
  - Category dropdown options: match the `suggestedCategory` list from the AI prompt above
  - Low-confidence items (amount is 0 or description is blank) get an amber left border + "Review" badge
- If AI returned no items for a receipt: show a single category dropdown for the overall transaction
- Card accent: `#6366f1` (indigo) header bar — thin, 3px top border only

**Error state:**
- If API key is missing: show "Add your API key first (🔑 in the toolbar)" — no loading, no file prompt
- If extraction returns 0 receipts: show "No receipts found in this image. Try a clearer photo."
- If API call fails: show error message with a "Try Again" button that re-triggers the file input

**After user edits and clicks "Confirm All":**
- Call `onConfirm(confirmedReceipts)` — pass back the array of edited receipt objects
- Each receipt in the array: `{ merchant, date, total, categoryId, items[] }`
- `categoryId` should be resolved from the edited category dropdown value to a matching category in `ffp_categories_{profileId}` (match by name, case-insensitive). If no match found, use the "Uncategorized" category id or null.
- Close the modal

### 4. `DuplicateCheckModal` — top-level component
Reconciliation prompt. Props: `{ open, receipt, match, onSkip, onReplace, onKeepBoth, t }`

**When shown:** After `onConfirm` from `ReceiptScanModal`, for each confirmed receipt, check for a duplicate (see Duplicate Detection logic below). If a match is found, show this modal before saving.

**Layout:**
- Title: "Possible Duplicate Found"
- Two-column side-by-side comparison:
  - Left: "Existing transaction" — date, merchant/description, amount, category
  - Right: "Scanned receipt" — date, merchant, total, category
- Three buttons:
  - "Skip (don't save)" — discard the scanned receipt, mark existing transaction as `reconciled: true`
  - "Replace" — delete existing transaction, save scanned receipt as new transaction with `reconciled: true`
  - "Keep Both" — save scanned receipt without reconciliation flag, keep existing unchanged
- Accent: amber (`#f59e0b`) title bar to signal attention

---

## Duplicate Detection Logic

Write this as a top-level helper function `findDuplicate(receipt, transactions)`:

```javascript
function findDuplicate(receipt, transactions) {
  const receiptDate = new Date(receipt.date);
  const receiptAmount = Math.abs(parseFloat(receipt.total));

  return transactions.find(tx => {
    const txDate = new Date(tx.date);
    const txAmount = Math.abs(parseFloat(tx.amount));
    const daysDiff = Math.abs((receiptDate - txDate) / (1000 * 60 * 60 * 24));
    const amountMatch = Math.abs(txAmount - receiptAmount) < 0.02;
    const dateMatch = daysDiff <= 3;
    const merchantWords = receipt.merchant?.toLowerCase().split(' ') || [];
    const descWords = tx.description?.toLowerCase() || '';
    const nameMatch = merchantWords.length > 0 && merchantWords.some(w => w.length > 3 && descWords.includes(w));
    return amountMatch && dateMatch && nameMatch;
  }) || null;
}
```

---

## Schema Additions (additive — existing transactions unaffected)

Add these fields to new transactions created via receipt scan. Do NOT migrate existing transactions. Do NOT remove any existing fields.

```javascript
// Added to transaction objects created from receipt scan:
entryMethod: "scan",         // "scan" | "csv_import" | "manual" — add "csv_import" to existing import flow, "manual" to manual add flow
reconciled: false,           // boolean — true when user confirms this matches an existing entry
reconciledWith: null,        // string | null — id of the matched transaction
```

For existing CSV import flow: set `entryMethod: "csv_import"` on imported transactions going forward.
For existing manual add flow: set `entryMethod: "manual"` on manually added transactions going forward.
These are additive only — no schema migration, no changes to existing stored data.

---

## Wiring into SpendingTracker

### Scan Receipt button placement
Add a "📷 Scan Receipt" button to the **Transactions tab** header row — right side, next to any existing controls. Style consistent with existing secondary buttons (`t.surf` background, `t.border` border, `t.tx1` text). On mobile, show icon only (📷); on desktop show icon + "Scan Receipt" label.

### State additions
```javascript
const [scanModalOpen, setScanModalOpen] = useState(false);
const [dupCheckState, setDupCheckState] = useState(null); // { receipt, match, queue[] }
```

### onConfirm flow (wire into SpendingTracker)
When `ReceiptScanModal` calls `onConfirm(confirmedReceipts)`:

```javascript
async function handleScanConfirm(confirmedReceipts) {
  setScanModalOpen(false);
  // Process receipts one at a time — check for duplicates before saving each
  const queue = [...confirmedReceipts];
  processNextReceipt(queue);
}

function processNextReceipt(queue) {
  if (queue.length === 0) return;
  const [receipt, ...rest] = queue;
  const match = findDuplicate(receipt, transactions);
  if (match) {
    setDupCheckState({ receipt, match, queue: rest });
  } else {
    saveScannedTransaction(receipt);
    processNextReceipt(rest);
  }
}
```

### saveScannedTransaction
```javascript
async function saveScannedTransaction(receipt, options = {}) {
  const newTx = {
    id: generateId(),
    accountId: activeAccountId || null,  // use active account if one is selected, else null
    date: receipt.date,
    description: receipt.merchant,
    amount: -(Math.abs(parseFloat(receipt.total))),  // always negative (expense)
    categoryId: receipt.categoryId || null,
    categoryLocked: !!receipt.categoryId,
    ruleId: null,
    theirCategory: null,
    notes: '',
    isSinkingFundCandidate: false,
    recurrencePattern: '',
    recurrenceType: null,
    importedAt: new Date().toISOString(),
    entryMethod: 'scan',
    reconciled: options.reconciled || false,
    reconciledWith: options.reconciledWith || null,
  };
  const updated = [...transactions, newTx];
  setTransactions(updated);
  await storeSet(`sp_transactions_${activeProfile}`, updated, true);
  // Re-run baseline write after save (same pattern as existing transaction saves)
}
```

### DuplicateCheckModal handlers
```javascript
// "Skip" — don't save scan, mark existing as reconciled
async function handleDupSkip() {
  const { match, queue } = dupCheckState;
  const updated = transactions.map(tx =>
    tx.id === match.id ? { ...tx, reconciled: true, reconciledWith: 'scan' } : tx
  );
  setTransactions(updated);
  await storeSet(`sp_transactions_${activeProfile}`, updated, true);
  setDupCheckState(null);
  processNextReceipt(queue);
}

// "Replace" — delete existing, save scanned
async function handleDupReplace() {
  const { receipt, match, queue } = dupCheckState;
  const filtered = transactions.filter(tx => tx.id !== match.id);
  setTransactions(filtered);
  await storeSet(`sp_transactions_${activeProfile}`, filtered, true);
  setDupCheckState(null);
  await saveScannedTransaction(receipt, { reconciled: true, reconciledWith: match.id });
  processNextReceipt(queue);
}

// "Keep Both" — save scanned, leave existing unchanged
async function handleDupKeepBoth() {
  const { receipt, queue } = dupCheckState;
  setDupCheckState(null);
  await saveScannedTransaction(receipt);
  processNextReceipt(queue);
}
```

---

## JSX Rules Checklist (verify before finishing)
- [ ] `return (` or `return <` — never `return<`
- [ ] All JSX-returning functions are top-level — `ReceiptScanModal`, `DuplicateCheckModal` are NOT defined inside SpendingTracker or any other component
- [ ] No `window.confirm()` or `window.alert()` — `DuplicateCheckModal` handles all confirmation UI
- [ ] `await res.json()` only — no streaming
- [ ] No `<form>` tags — all inputs use `onChange`
- [ ] SVG only — no external chart libraries added
- [ ] Probe/fallback storage pattern used in `saveScannedTransaction`

---

## Verification Steps
1. `cd preview && npm run build` — must complete with 0 errors, 0 warnings
2. Confirm `docs/spending/index.html` exists after build
3. Confirm `modules/spending.jsx` is the only module file changed
4. Confirm no changes to `preview/src/App.jsx` imports beyond pointing to spending.jsx
5. Open in browser — click 📷 Scan Receipt in Transactions tab, verify file picker opens
6. Verify `ReceiptScanModal` and `DuplicateCheckModal` are defined at top level (not nested)

---

## Commit Message
```
feat: SpendingTracker v1.9 — receipt scan, multi-receipt review screen, duplicate detection
```

Commit these files only:
- `modules/spending.jsx`
- `docs/spending/` (full Vite output)
- `preview/vite.config.js`
- `preview/src/App.jsx`

---

## Report Back
After completing, report:
1. Build result (pass/fail, any warnings)
2. List of new top-level components and helpers added
3. Schema fields added to new scan transactions
4. Any deviations from this prompt and why
5. Confirmation that no other modules or shared files were modified
