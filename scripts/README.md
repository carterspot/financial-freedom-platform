# FFP Test Data Generator

Generates realistic weekly or monthly bank statement CSVs and income/debt JSON exports for all five FFP test personas. Output is deterministic — running the same command twice produces identical files thanks to seeded randomness. No dependencies beyond Node.js built-ins.

## Usage

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

## Options

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `--mode` | `week` \| `month` | `week` | 7-day or 30-day window ending on `--date` |
| `--user` | `all` \| persona key | `all` | Generate one persona or all five |
| `--date` | `YYYY-MM-DD` | today | End date of the generation window |

## Supported Personas

| Key | Name | Bank (checking) | Card | Story |
|-----|------|-----------------|------|-------|
| `emma` | Emma Rodriguez | Chase (YYYY-MM-DD) | Discover CC | W2 $85K, renter, student loan, clothing habit Jan/Mar |
| `marcus` | Marcus Chen | Wells Fargo (MM/DD/YYYY) | Citi CC | W2 + freelance, condo, Citi card at 83% util (growing) |
| `sarah` | Sarah Mitchell | Bank of America | Chase Sapphire | Self-employed variable income, two mortgages, vacation habit |
| `jordan` | Jordan Williams | Chase (YYYY-MM-DD) | Chase Freedom | Tech sales, commuter, overspends gadgets/dining |
| `taylor` | Taylor Williams | Bank of America | Citi Premier | RN + rental income, disciplined saver, grocery-points card |

## Output Structure

```
docs/test-data/generated/
  2026-04-20/
    emma/
      emma-checking.csv     ← Chase: Date,Description,Amount,Type,Balance
      emma-cc.csv           ← Discover: Trans Date,Post Date,Description,Amount,Category
      emma-income.json
      emma-debt.json
    marcus/
      marcus-checking.csv   ← Wells Fargo: Date,Description,Amount,Running Balance (MM/DD/YYYY)
      marcus-cc.csv         ← Citi: Date,Description,Amount,Category (MM/DD/YYYY)
      ...
    sarah/
      sarah-checking.csv    ← BofA: Date,Description,Amount,Balance
      sarah-cc.csv          ← Chase Sapphire: Trans Date,Post Date,Description,Amount,Category
      ...
    jordan/ taylor/         ← same pattern
```

## Seeded Output

Output is reproducible. The seed is `personaKey + startDateISO` — same command always produces identical files. This makes test scenarios stable across runs.

## Month Mode for Dedup Testing

`--mode month` generates a 30-day window. Import the same persona's month output twice into SpendingTracker to exercise the duplicate detection flow. The overlap is intentional.

## Importing into SpendingTracker

1. Open SpendingTracker → Transactions tab → Import CSV
2. Select the generated `{persona}-checking.csv` or `{persona}-cc.csv`
3. Map columns on the review screen (headers match bank formats exactly)
4. For income/debt data: use the IncomeTracker and DebtTracker JSON import flows

## JSON Debt Balances

Debt JSON files have balances advanced from the March 2026 seed baseline using:
- **Loans**: amortization formula (payment minus monthly interest = principal reduction)
- **Credit cards**: persona-specific monthly net delta (Emma: slight paydown, Marcus: slow growth, Jordan: +$250/month, Taylor: stable)
