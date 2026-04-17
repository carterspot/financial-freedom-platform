# Build Prompt — FFP Test Data Generator

## Before Starting
Read:
1. `CLAUDE.md` — project context
2. `docs/test-data/test-user-personas.md` — all 5 persona descriptions
3. Skim `docs/test-data/emma-rodriguez/emma-checking.csv` and `emma-cc.csv` — exact column formats confirmed below

---

## Objective
Create a standalone Node.js CLI script at `scripts/generate-test-data.js` that generates realistic weekly or monthly bank statement CSVs and JSON exports for all 5 FFP test personas. No JSX rules apply — this is a plain .js file. No npm dependencies — use only Node.js built-ins (`fs`, `path`).

Also create `docs/test-data/jordan-williams/` and `docs/test-data/taylor-williams/` seed folders with their initial income and debt JSON files (matching the schemas from the married couple build prompt).

---

## CLI Usage

```bash
# Generate this week's data for all personas (default)
node scripts/generate-test-data.js

# Generate last 30 days for all personas (overlap/dedup testing)
node scripts/generate-test-data.js --mode month

# Generate one persona only
node scripts/generate-test-data.js --user emma

# Specify end date (default: today)
node scripts/generate-test-data.js --date 2026-05-01

# Combine options
node scripts/generate-test-data.js --mode month --user jordan --date 2026-05-01
```

**Options:**
- `--mode week` (default) | `month` — 7-day or 30-day window ending on `--date`
- `--user all` (default) | `emma` | `marcus` | `sarah` | `jordan` | `taylor`
- `--date YYYY-MM-DD` (default: today's date via `new Date()`)

---

## Output Structure

All output goes to `docs/test-data/generated/[end-date]/[persona]/`:

```
docs/test-data/generated/
  2026-04-20/
    emma/
      emma-checking.csv
      emma-cc.csv
      emma-income.json
      emma-debt.json
    marcus/
      marcus-checking.csv
      marcus-cc.csv
      marcus-income.json
      marcus-debt.json
    sarah/
      sarah-checking.csv
      sarah-cc.csv        ← Chase Sapphire only (primary problem card)
      sarah-income.json
      sarah-debt.json
    jordan/
      jordan-checking.csv
      jordan-cc.csv
      jordan-income.json
      jordan-debt.json
    taylor/
      taylor-checking.csv
      taylor-cc.csv
      taylor-income.json
      taylor-debt.json
```

Print a summary to stdout after generation:
```
FFP Test Data Generator
Mode: week | Date range: 2026-04-14 to 2026-04-20
Generated: 5 personas | 10 CSV files | 10 JSON files
Output: docs/test-data/generated/2026-04-20/
```

---

## Seeded Randomness

Use a seeded PRNG so the same command always produces identical output. Seed = string hash of `(personaKey + startDateISO)`. This makes tests reproducible.

```javascript
function seededRNG(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
  }
  let s = h >>> 0;
  return function() {
    s = Math.imul(1664525, s) + 1013904223 | 0;
    return (s >>> 0) / 4294967296;
  };
}
// Usage: const rng = seededRNG('emma2026-04-14');
// const val = rng(); // 0.0–1.0
```

Use this helper throughout — never `Math.random()` directly.

```javascript
// Pick random item from array
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// Random amount within range, rounded to 2 decimals
function randAmount(rng, min, max) {
  return Math.round((min + rng() * (max - min)) * 100) / 100;
}

// Random int within range (inclusive)
function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}
```

---

## CSV Formats (exact — match existing files)

### Chase checking (Emma, Jordan)
```
Date,Description,Amount,Type,Balance
2026-01-01,PARKSIDE APARTMENTS,-1450.00,debit,1750.00
2026-01-03,ARGANO LLC PAYROLL,2580.00,credit,4330.00
```
- Date: `YYYY-MM-DD`
- Amount: negative = debit/expense, positive = deposit
- Type: `"debit"` or `"credit"` (string)
- Balance: running balance, start from persona's base balance

### Discover CC (Emma)
```
Trans Date,Post Date,Description,Amount,Category
2026-01-04,2026-01-05,ZARA USA,189.00,Clothing
```
- Trans Date / Post Date: `YYYY-MM-DD`, Post Date = Trans Date + 1 day
- Amount: positive = charge/purchase, negative = payment
- Category: string label

### Wells Fargo checking (Marcus)
```
Date,Description,Amount,Running Balance
01/01/2026,ROCKET MORTGAGE,-2617.00,5783.00
```
- Date: `MM/DD/YYYY` ← Marcus only uses this format
- Running Balance: running balance

### Citi CC (Marcus)
```
Date,Description,Amount,Category
01/04/2026,WAYFAIR.COM,187.43,Home
```
- Date: `MM/DD/YYYY`
- Amount: positive = charge, negative = payment

### Bank of America checking (Sarah, Taylor)
```
Date,Description,Amount,Balance
2026-01-01,"BANK OF AMERICA MORTG",-3500.00,10700.00
```
- Date: `YYYY-MM-DD`
- Descriptions with spaces use quoted strings
- Balance: running balance

### Chase Freedom CC (Jordan)
```
Trans Date,Post Date,Description,Amount,Category
2026-01-05,2026-01-06,BEST BUY,347.00,Electronics
```
- Same format as Emma Discover CC

### Citi Premier CC (Taylor)
```
Trans Date,Post Date,Description,Amount,Category
2026-01-03,2026-01-04,VONS,187.43,Groceries
```
- Same format as Jordan CC

---

## Persona Spending Profiles

### EMMA RODRIGUEZ
**Checking start balance:** $3,200 (Jan 1 2026 baseline — advance forward by net monthly flow for subsequent months)
**CC start balance:** $1,847.32

**Income:**
- Biweekly paycheck on approx 1st and 15th: desc `ARGANO LLC PAYROLL`, amount range $2,550–$2,620

**Fixed (day of month → transaction):**
| Day | Description | Amount | Account |
|-----|-------------|--------|---------|
| 1 | PARKSIDE APARTMENTS | -1450.00 | checking |
| 1 | LEMONADE INSURANCE | -18.00 | checking |
| 2 | XFINITY | -79.99 | checking |
| 2 | AT&T WIRELESS | -68.00 | checking |
| 3 | CITY POWER UTILITY | -65 to -95 | checking |
| 3 | PLANET FITNESS | -24.99 | checking |
| 5 | NETFLIX | -15.49 | cc |
| 5 | SPOTIFY | -10.99 | checking |
| 10 | NAVIENT PAYMENT | -650.00 | checking |
| 14 | AMAZON PRIME | -14.99 | cc |
| 15 | TRANSFER TO SAVINGS | -516.00 | checking |
| 17 | DISCOVER CARD PAYMENT | -200 to -350 | checking (negative on checking, negative on CC) |

**Variable (per week, checking unless noted):**
| Pool | Merchants | Amount | Weekly freq |
|------|-----------|--------|-------------|
| Groceries | KROGER, TRADER JOES, WHOLE FOODS | $45–$140 | 2–4 |
| Gas | SHELL, BP, CHEVRON | $38–$55 | 2–3 |
| Dining | CHIPOTLE, PANERA BREAD, LOCAL PIZZA, STARBUCKS | $8–$35 | 6–10 total/month → 1–3/week |
| Amazon | AMAZON.COM | $15–$65 | 0–1 |
| Drugstore | WALGREENS, CVS PHARMACY | $12–$45 | 0–1 |

**Clothing habit (CC):**
- Normal months: 0–1 clothing purchase, $30–$80, merchants: H&M, ZARA USA, TARGET STYLE, TJ MAXX, OLD NAVY
- Spike pattern (Jan, Mar historically): 3–4 clothing purchases in the month, $100–$250 each
- Generator should apply spike pattern to months 1 and 3; all other months use normal rate

---

### MARCUS CHEN
**Checking start balance:** $8,400
**Citi CC start balance:** $4,565

**Income:**
- W2 biweekly approx 1st and 15th: `ACCENTURE PAYROLL DD`, $3,400–$3,480
- Side biz: `STRIPE TRANSFER` or `PAYPAL TRANSFER`, 1–2x/month, $500–$1,500, irregular day (8–25)

**Fixed:**
| Day | Description | Amount | Account |
|-----|-------------|--------|---------|
| 1 | ROCKET MORTGAGE | -2617.00 | checking |
| 1 | CITYVIEW CONDOS HOA | -385.00 | checking |
| 5 | HONDA FINANCIAL | -594.00 | checking |
| 5 | CON EDISON | -95 to -145 | checking |
| 6 | SPECTRUM | -89.99 | checking |
| 7 | VERIZON WIRELESS | -142.00 | checking |
| 8 | APPLE ONE | -32.95 | checking |
| 8 | HBO MAX | -15.99 | checking |
| 15 | CHASE SAPPHIRE PAYMENT | -350 to -500 | checking |
| 20 | CITI CARD PAYMENT | -185.00 | checking |
| 22 | TRANSFER TO SAVINGS | -780 to -1100 | checking |
| 54.99 monthly | ADOBE CREATIVE CLOUD | 54.99 | Citi CC |
| 15 monthly | FIGMA | 15.00 | Citi CC |

**Variable checking:**
| Pool | Merchants | Amount | Weekly freq |
|------|-----------|--------|-------------|
| Groceries | WHOLE FOODS MARKET, COSTCO, TRADER JOES | $65–$210 | 3–5 total/month |
| Gas | SHELL OIL, EXXON MOBIL | $52–$78 | 3–4 total/month |
| Dining (Chase card) | show as CHASE SAPPHIRE PAYMENT increase | — | — |

**Home goods habit (Citi CC — THE PROBLEM):**
- Normal months: 1–2 purchases, $60–$180, merchants: HOMEGOODS, WAYFAIR.COM, AMAZON HOME, IKEA
- Spike: Feb historically — 3–4 purchases, $140–$350 (home office refresh)
- Online courses/tools: UDEMY, SKILLSHARE, random font/plugin shops, $25–$150, 0–1/month

---

### SARAH MITCHELL
**Checking start balance:** $14,200
**Chase Sapphire CC start balance:** $5,200

**Income (irregular client ACH — self-employed):**
- 2–4 ACH deposits per month, varying amounts, merchants: `HENDERSON GROUP ACH`, `METRO PARKS DEPT`, `RIVERSIDE HOA`, `SPRING CREEK RESORT`, `PRIVATE CLIENT ACH`
- Monthly total varies: Jan ~$9,200 | Feb ~$6,800 | Mar ~$8,400 | subsequent months vary $6,500–$10,000
- For weekly generation: distribute monthly total across 2–3 deposits randomly placed in the month
- Rental income: `RENTAL PROPERTY DEP` +$1,850 on day 1

**Fixed:**
| Day | Description | Amount | Account |
|-----|-------------|--------|---------|
| 1 | BANK OF AMERICA MORTG | -3500.00 | checking |
| 1 | RENTAL PROPERTY DEP | +1850.00 | checking |
| 5 | BOA RENTAL MORTG | -1500.00 | checking |
| 10 | FORD MOTOR CREDIT | -700.00 | checking |
| 15 | STATE FARM HOME | -187.00 | checking |
| 15 | STATE FARM AUTO | -194.00 | checking |
| 1 | BCBS HEALTH INS | -487.00 | checking |
| 5 | SCE ELECTRIC | -145 to -210 | checking |
| 6 | SOCALGAS | -65 to -110 | checking |
| 6 | CITY OF TEMECULA WATER | -45.00 | checking |
| 7 | AT&T FIBER | -89.00 | checking |
| 7 | APPLE IPHONE PLAN | -95.00 | checking |
| 12 | CHASE SAPPHIRE PAYMENT | -350.00 | checking |
| 18 | AMEX BLUE CASH PAYMENT | -300.00 | checking |
| 22 | CHASE INK PAYMENT | -500.00 | checking |
| 5 | TRANSFER TO SAVINGS | -800 to -1500 | checking |
| 5 | VANGUARD IRA CONTRIB | -500.00 | checking |

**Variable checking:**
| Pool | Merchants | Amount | Monthly freq |
|------|-----------|--------|--------------|
| Gas (F-250) | CHEVRON, SHELL, LOVES TRAVEL | $75–$110 | 4–6 |
| Groceries | WHOLE FOODS MARKET, SPROUTS, COSTCO | $65–$195 | 3–5 |
| Dining | local restaurant names, POSTMATES | $22–$68 | 4–6 |
| Professional | ASLA MEMBERSHIP (Jan only, -$595), misc subscriptions | varies | 0–1 |

**Vacation habit (Chase Sapphire CC):**
- Jan: flight + hotel deposit booking (~$1,200–$2,000 total)
- Mar: trip charges ($500–$900) + summer booking deposits ($600–$900)
- Other months: occasional dining + streaming on CC ($80–$200 total)
- Generate vacation charges on the CC in Jan and Mar; lighter months otherwise

**Business card (Chase Ink — Citi CC in generator):**
- Adobe, Figma, Skillshare, misc supplies: $100–$200/month total
- 2–3 business purchases, $30–$150 each

---

### JORDAN WILLIAMS
**Checking start balance:** $4,800
**Chase Freedom CC start balance:** $3,200

**Income:**
- W2 biweekly approx 1st and 15th: `TECHBRIDGE SOLUTIONS DD`, $2,950–$3,000
- Commission on 20th: `TECHBRIDGE SOLUTIONS COMM`, variable $500–$2,500 (higher in Q1/Q3, lower in Q2)
- Zelle from Taylor: `ZELLE FROM T WILLIAMS` +$400, day 3 each month

**Fixed:**
| Day | Description | Amount | Account |
|-----|-------------|--------|---------|
| 1 | PROGRESSIVE AUTO | -187.00 | checking |
| 5 | TESLA FINANCIAL SVCS | -698.00 | checking |
| 7 | T-MOBILE | -89.00 | checking |
| 8 | YOUTUBE PREMIUM | -13.99 | checking |
| 8 | ESPN+ | -10.99 | checking |
| 8 | PARAMOUNT+ | -11.99 | checking |
| 10 | ANYTIME FITNESS | -39.99 | checking |
| 20 | CHASE FREEDOM PAYMENT | -250 to -300 | checking |

**Variable checking:**
| Pool | Merchants | Amount | Monthly freq |
|------|-----------|--------|--------------|
| EV Charging | TESLA SUPERCHARGER, EVGO | $22–$45 | 2–3 |
| Gas (rare, EV) | SHELL (when range anxiety) | $0–$25 | 0–1 |

**Problem spending (Chase Freedom CC):**
| Pool | Merchants | Amount | Monthly freq |
|------|-----------|--------|--------------|
| Tech gadgets | BEST BUY, APPLE STORE, AMAZON ELECTRONICS, B&H PHOTO | $80–$450 | 2–3 |
| Sports/outdoor | REI, DICKS SPORTING GOODS, ONLINE GEAR SHOP | $65–$350 | 1–2 |
| Dining SD commute | local SD restaurants, CHIPOTLE, SHAKE SHACK | $12–$28 | 8–12/month → 2–3/week |
| Family dining | OLIVE GARDEN, CHEESECAKE FACTORY, local family spots | $45–$95 | 3–4/month |
| Starbucks | STARBUCKS | $6–$8 | 10–14/month on commute days |

**Occasional savings (checking):**
- After big commission month (>$2,000): `TRANSFER SAVINGS` -$500 on day 25

---

### TAYLOR WILLIAMS
**Checking start balance:** $12,400
**Citi Premier CC start balance:** $1,240

**Income:**
- W2 biweekly approx 1st and 15th: `TEMECULA VALLEY HOSP`, $2,500–$2,550 base, occasional shift diff bump to $2,700–$3,000 (25% chance on any paycheck)
- Rental income: `RENTAL DEPOSIT SD CONDO` +$2,650, day 1 each month
- Zelle from Jordan: `ZELLE FROM J WILLIAMS` +$400, day 3 each month

**Fixed:**
| Day | Description | Amount | Account |
|-----|-------------|--------|---------|
| 1 | BOA HOME MORTGAGE | -2940.00 | checking |
| 1 | BOA RENTAL MORTGAGE | -2305.00 | checking (offset by rental income) |
| 1 | LITTLE STARS DAYCARE | -1850.00 | checking |
| 1 | SOMMERSET HILLS HOA | -225.00 | checking |
| 1 | NORTHWESTERN MUTUAL | -89.00 | checking |
| 3 | BOA RENTAL MORTGAGE | — | (paid day 3) |
| 5 | 529 COLLEGE SAVINGS | -300.00 | checking |
| 5 | TRANSFER TO SAVINGS | -400.00 | checking |
| 7 | SCE ELECTRIC | -145 to -195 | checking |
| 7 | SOCALGAS | -55 to -95 | checking |
| 8 | CITY OF TEMECULA | -62.00 | checking |
| 8 | COX COMMUNICATIONS | -79.99 | checking |
| 8 | VERIZON | -76.00 | checking |
| 15 | STATE FARM HOME | -147.00 | checking |
| 12 | CITI PREMIER PAYMENT | -890 to -1240 | checking |

**Variable checking:**
| Pool | Merchants | Amount | Monthly freq |
|------|-----------|--------|--------------|
| Gas (Honda Pilot) | CHEVRON, SHELL | $48–$65 | 2–3 |
| Pharmacy | CVS PHARMACY | $12–$38 | 1–2 |
| Lily activities | LITTLE GYM TEMECULA, dance class | $89–$145 | 1–2 |
| Lily pediatrician | TEMECULA PEDIATRICS | $25–$45 | 0–1 |
| Home maintenance | HOME DEPOT, LOWES, HANDYMAN SERVICES | $60–$200 | 0–1 |
| Family dining | CHILIS, APPLEBEES, local casual | $38–$78 | 2–3 |

**Citi Premier CC (disciplined — groceries for points):**
| Pool | Merchants | Amount | Monthly freq |
|------|-----------|--------|--------------|
| Groceries | VONS, COSTCO, SPROUTS | $85–$267 | 4–6 |
| Gas | CHEVRON | $49–$54 | 1–2 |
| Amazon | AMAZON.COM | $38–$70 | 1–2 |
| Lily outings | CHILDRENS MUSEUM, activity centers | $18–$35 | 0–1 |
| Anniversary/date night (March) | CHEESECAKE FACTORY | $85–$95 | 0–1 |

**Extra mortgage principal (occasional):**
- After good commission month from Jordan (Taylor notices the budget slack): `BOA MORTGAGE EXTRA` -$200 to -$300, end of month

---

## Balance Tracking

Track a running balance for each persona starting from their base balance. For each generated transaction in chronological order, update the running balance. Write the current balance in the Balance/Running Balance column.

**Base balances (as of 2026-03-31):**
- Emma checking: ~$3,450 | Emma CC: ~$2,150
- Marcus checking: ~$8,100 | Marcus Citi CC: ~$4,850
- Sarah checking: ~$13,200 | Sarah Chase Sapphire: ~$7,900
- Jordan checking: ~$4,200 | Jordan Chase Freedom: ~$3,980
- Taylor checking: ~$11,800 | Taylor Citi Premier: ~$1,280

For runs covering dates after March 2026, advance the starting balance by estimating net monthly flow:
- Emma net monthly: ~+$200 (tight but positive)
- Marcus net monthly: ~+$500
- Sarah net monthly: ~+$800 (variable)
- Jordan net monthly: ~+$100 (barely saving, commission-dependent)
- Taylor net monthly: ~+$600 (disciplined)

Calculate approximate starting balance for the requested date range = base balance + (months since 2026-03-31 × net monthly rate).

---

## JSON Exports

For income and debt JSON files, use the exact schemas from the existing files in `docs/test-data/`. Update `exportedAt` to the run date. For debt JSON, advance balances by applying one monthly payment per month elapsed since March 2026:

- Emma student loan: principal reduction ~$290/payment
- Marcus Citi CC: barely reduces ($185 payment, high interest — may actually grow)
- Jordan Chase Freedom: barely reduces ($250–300 payment, balance growing ~$250/month net)
- Taylor Citi Premier: pays near-full, stays $1,000–$1,400 range

---

## Seed Files to Create

Create these folders and files (use exact schemas from `docs/build-prompts/test-user-prompts-married.md`):

**`docs/test-data/jordan-williams/jordan-income.json`** — Jordan's income streams (base salary + commission)
**`docs/test-data/jordan-williams/jordan-debt.json`** — Chase Freedom card + Tesla loan
**`docs/test-data/taylor-williams/taylor-income.json`** — Taylor's income streams (hospital RN + rental)
**`docs/test-data/taylor-williams/taylor-debt.json`** — Citi Premier card + two mortgages

Use the exact JSON content from the married couple build prompt — these are already fully specified there.

---

## README

Create `scripts/README.md` with:
- One-paragraph description of what the generator does
- Full CLI usage with all options and examples
- Table of which personas are supported
- Note about seeded output (same command = same output)
- Note about month mode for dedup testing
- Import instructions (same as in `docs/test-data/test-user-prompts.md`)

---

## JSX Rules
Not applicable — this is a plain Node.js script.

## Verification
1. Run `node scripts/generate-test-data.js --date 2026-04-20` — verify output appears in `docs/test-data/generated/2026-04-20/`
2. Run again — verify identical output (seeded RNG)
3. Run `--mode month` — verify 30-day range
4. Run `--user emma` — verify only emma folder is generated
5. Open `emma-checking.csv` — verify headers match `Date,Description,Amount,Type,Balance`
6. Open `marcus-checking.csv` — verify date format is `MM/DD/YYYY`
7. Verify `docs/test-data/jordan-williams/` and `docs/test-data/taylor-williams/` seed files exist

## Commit Message
```
feat: add test data generator script — 5 personas, week/month modes, seeded output
```

Commit these files only:
- `scripts/generate-test-data.js`
- `scripts/README.md`
- `docs/test-data/jordan-williams/jordan-income.json`
- `docs/test-data/jordan-williams/jordan-debt.json`
- `docs/test-data/taylor-williams/taylor-income.json`
- `docs/test-data/taylor-williams/taylor-debt.json`

## Report Back
1. Build/run result — did the script execute cleanly
2. Sample of one generated CSV (first 5 lines of emma-checking.csv)
3. Confirmation of seeded output (ran twice, same result)
4. Any deviations from this prompt and why
