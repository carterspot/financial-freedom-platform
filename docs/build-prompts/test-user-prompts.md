# FFP Test User Data Generation Prompts
**Financial Freedom Platform — March 2026**

Paste each prompt below into a fresh Claude chat. Each generates 3 files per user:
- `[name]-spending.csv` — bank/CC statement for SpendingTracker import
- `[name]-income.json` — income streams for IncomeTracker import
- `[name]-debt.json` — cards and loans for DebtTracker import

---

## PROMPT 1 — Emma Rodriguez (Test User 1)

```
Generate realistic test data for a personal finance app test user named Emma Rodriguez.
Output exactly 3 files as specified below. Make all data internally consistent — balances,
payments, and spending should make sense together. Date range: January 1, 2026 through
March 31, 2026.

---

USER PROFILE: Emma Rodriguez
- W2 income: $85,000/year gross → ~$5,160/month net after taxes (use 27% effective tax rate)
- Single, renting an apartment in a mid-size city
- Challenge: Overspends on clothing — shops at stores like H&M, Zara, Target, TJ Maxx, Old Navy.
  Puts clothing purchases on her credit card. Goes over what she can really afford on clothes
  2 out of 3 months. January she bought a full new wardrobe refresh ($680). March she splurged
  again ($420).
- Saves 10% of net income per month as a transfer to savings
- Pays all bills on time but is starting to feel financial pressure
- Should have 10-20% left over at end of month after bills, savings, and spending
- Credit card: $6,000 limit, tends to carry $1,800-$2,400 balance because of clothing habit
- Student loan: $100,000 original, has been paying for about 1 year at $650/month, 
  ~5.5% interest rate, standard repayment plan. Current balance ~$97,200.

---

FILE 1: emma-checking.csv
Format this as a realistic Chase bank checking account statement CSV.
Headers: Date,Description,Amount,Type,Balance
- Amount: negative = debit/expense, positive = credit/deposit
- Type: "debit" or "credit"
- Include running balance starting at ~$3,200 on Jan 1

Include these transaction types each month (vary amounts slightly, vary dates realistically):
INCOME (first and 15th of each month - biweekly paycheck):
  - Direct deposit from "ARGANO LLC PAYROLL" ~$2,580 each paycheck

FIXED MONTHLY (vary dates 1-5 of month):
  - Rent: "PARKSIDE APARTMENTS" -$1,450 (1st of month)
  - Electric: "CITY POWER UTILITY" -$65 to -$95
  - Internet: "XFINITY" -$79.99
  - Phone: "AT&T WIRELESS" -$68.00
  - Streaming: "NETFLIX" -$15.49, "SPOTIFY" -$10.99
  - Renter's Insurance: "LEMONADE INSURANCE" -$18.00
  - Student loan: "NAVIENT PAYMENT" -$650.00
  - Gym: "PLANET FITNESS" -$24.99

VARIABLE MONTHLY:
  - Groceries: "KROGER", "TRADER JOES", "WHOLE FOODS" 2-4 transactions, -$45 to -$140 each
  - Gas: "SHELL", "BP", "CHEVRON" 2-3 times, -$38 to -$55
  - Dining out: "CHIPOTLE", "PANERA BREAD", "LOCAL PIZZA", coffee shops 6-10 times, -$8 to -$35
  - Amazon: 1-3 times, -$15 to -$65 (household items)
  - Walgreens/CVS: 1-2 times, -$12 to -$45
  - Credit card payment: "DISCOVER CARD PAYMENT" mid-month, -$200 to -$350
    (minimum + extra but not paying full balance due to clothing habit)

SAVINGS TRANSFER (monthly, around 15th):
  - "TRANSFER TO SAVINGS" -$516 (10% of net monthly income)

JANUARY SPECIAL: Add clothing store charge to credit card payment increase for Feb
MARCH SPECIAL: Same pattern — she splurged again

Generate approximately 45-65 transactions per month, 135-195 total.

FILE 2: emma-cc.csv
Format as a realistic Discover credit card statement CSV.
Headers: Trans Date,Post Date,Description,Amount,Category
- Amount: POSITIVE = charge/purchase, NEGATIVE = payment
- CC statements reverse debit/credit (charges are positive)

Starting balance Jan 1: $1,847.32
Credit limit: $6,000

Include:
- Clothing stores each month (this is her challenge):
  JANUARY (big refresh): ZARA $189, H&M $142, TARGET STYLE $156, TJ MAXX $193 → total ~$680
  FEBRUARY: only $45 at Target (held back)
  MARCH (splurge): OLD NAVY $89, ZARA $156, H&M $175 → total ~$420
- Occasional dining/entertainment on card: 2-3 times/month -$15 to -$45
- Amazon Prime: -$14.99/month
- Payments from checking: match the "DISCOVER CARD PAYMENT" from checking (positive amount on CC = payment received)
- End of March balance should be around $2,100-$2,400

Generate approximately 15-25 transactions per month.

FILE 3: emma-income.json
Generate a JSON object matching this exact structure:

{
  "version": "inc_1.0",
  "exportedAt": "2026-03-31T00:00:00.000Z",
  "profileId": "pin_emma_rodriguez",
  "streams": [
    {
      "id": "inc_emma_001",
      "name": "Argano LLC - Salary",
      "type": "W2",
      "amount": "2580",
      "frequency": "Bi-Weekly",
      "stabilityRating": "Stable",
      "afterTax": true,
      "startDate": "2024-03-01",
      "endDate": "",
      "notes": "Direct deposit, biweekly",
      "categoryId": "inc_001",
      "color": "#6366f1"
    }
  ]
}

FILE 4: emma-debt.json
Generate a JSON object matching this exact structure:

{
  "version": "dt_1.0",
  "exportedAt": "2026-03-31T00:00:00.000Z",
  "profileId": "pin_emma_rodriguez",
  "cards": [
    {
      "id": "dt_emma_card_001",
      "name": "Discover It",
      "last4": "4892",
      "color": "#f97316",
      "balance": "2187.43",
      "limit": "6000",
      "apr": "22.99",
      "minPaymentMode": "auto",
      "minPaymentFixed": "",
      "monthlyPayment": "275",
      "payoffMode": "payment",
      "dueDay": "22",
      "statementDay": "15",
      "expiration": "09/28",
      "originalBalance": "1847.32"
    }
  ],
  "loans": [
    {
      "id": "dt_emma_loan_001",
      "name": "Federal Student Loan",
      "lender": "Navient",
      "type": "student",
      "color": "#8b5cf6",
      "originalBalance": "100000",
      "currentBalance": "97234.18",
      "interestRate": "5.500",
      "monthlyPayment": "650.00",
      "termMonths": 120,
      "remainingMonths": "108",
      "nextPaymentDay": "10",
      "notes": "Standard repayment, IBR eligible"
    }
  ],
  "logs": []
}

Adjust the balances to be realistic for someone who has been paying for 1 year and carrying
a small revolving CC balance due to clothing spending. Output all 4 files clearly labeled.
```

---

## PROMPT 2 — Marcus Chen (Test User 2)

```
Generate realistic test data for a personal finance app test user named Marcus Chen.
Output exactly 4 files as specified below. Make all data internally consistent — balances,
payments, and spending should make sense together. Date range: January 1, 2026 through
March 31, 2026.

---

USER PROFILE: Marcus Chen
- W2 income: $110,000/year gross → ~$6,875/month net (use 28% effective tax rate)
- Side business (freelance UX consulting): $1,000-$1,500/month variable, paid irregularly
- Lives in a condo he owns in a metro area
- Married, spouse also works (spouse income not tracked in this profile)
- Challenge: Overspends on home goods (Crate & Barrel, Pottery Barn, HomeGoods, Wayfair)
  AND side business supplies (Adobe, Figma, online courses, equipment). These go on different cards.
- Saves 10-15% per month as transfer (base 10% from W2, extra when side biz is good)
- Pays all CC and loans on time but minimum + small extra only on high-utilization card
- Needs better budgeting and clear what-if scenarios for debt payoff

DEBTS:
- Mortgage: $425,000 condo, 30-year at 6.25% APR, bought 2 years ago. 
  Current balance ~$418,200. Monthly payment $2,617.
- Car loan: $30,000 original (2024 Honda CR-V), 60-month at 7.1% APR, 10 months remaining payments.
  Current balance ~$21,400. Monthly payment $594.
- Chase Sapphire (Card 1): $8,000 limit, current balance ~$2,380 (30% utilization), 19.99% APR
  — used for dining, travel, general purchases
- Citi Double Cash (Card 2): $5,500 limit, current balance ~$4,565 (83% utilization), 24.99% APR
  — this is the problem card, home goods and side biz supplies piled up here
  Monthly payment: $185 (barely above minimum, making slow progress)

---

FILE 1: marcus-checking.csv
Format as a realistic Wells Fargo checking account CSV.
Headers: Date,Description,Amount,Running Balance
- Amount: negative = expense, positive = deposit
- Starting balance: ~$8,400 on Jan 1

Include each month:
INCOME:
  - W2 biweekly: "ACCENTURE PAYROLL DD" ~$3,437 (1st and 15th approx)
  - Side biz: "STRIPE TRANSFER" or "PAYPAL TRANSFER" 1-2 times/month, $500-$1,500 each
    January: ~$1,100 total | February: ~$1,400 total | March: ~$1,050 total

FIXED:
  - Mortgage: "ROCKET MORTGAGE" -$2,617 (1st)
  - Car loan: "HONDA FINANCIAL" -$594 (5th)
  - HOA: "CITYVIEW CONDOS HOA" -$385 (1st)
  - Electric: "CON EDISON" -$95 to -$145
  - Internet: "SPECTRUM" -$89.99
  - Phone (2 lines): "VERIZON WIRELESS" -$142
  - Streaming bundle: "APPLE ONE" -$32.95, "HBO MAX" -$15.99

VARIABLE:
  - Groceries: "WHOLE FOODS", "COSTCO", "TRADER JOES" 3-5 transactions, -$65 to -$210
  - Gas: "SHELL", "EXXON" 3-4 times, -$52 to -$78 (CR-V is decent on gas)
  - Dining: restaurants 4-8 times/month on Chase card (show as Chase payment)
  - Home goods (THE PROBLEM): HomeGoods, Wayfair, IKEA 1-3 times/month on Citi card
    January: ~$340 total home goods | February: ~$520 total (went overboard on home office)
    March: ~$280 total
  - Side biz supplies: Adobe CC, Figma, Skillshare, misc on Citi card
    Each month: $80-$180 in software/subscriptions

CC PAYMENTS:
  - "CHASE SAPPHIRE PAYMENT" -$350 to -$500/month (mid-month)
  - "CITI CARD PAYMENT" -$185/month (minimum + $10, barely moving the balance)

SAVINGS TRANSFER:
  - "TRANSFER TO SAVINGS" varies: Jan -$850 | Feb -$1,100 | Mar -$780

Generate 55-75 transactions per month.

FILE 2: marcus-cc.csv
Format as a Citi credit card statement (the high-utilization problem card).
Headers: Date,Description,Amount,Category
- Positive = charge, Negative = payment/credit
- Starting balance: $4,565.00

This card shows the problem clearly:
JANUARY: Home goods: WAYFAIR $187, HOMEGOODS $156, POTTERY BARN $92 | Adobe CC $54.99 | Figma $15/mo | Udemy course $89 | Random Amazon home items $67
FEBRUARY: Big home office refresh: WAYFAIR $312 (standing desk mat), HOMEGOODS $143, AMAZON $98 (cable management), Crate & Barrel $67 | Adobe $54.99 | Two online courses $149 total
MARCH: Settling down slightly but still: HOMEGOODS $127, Amazon home $58 | Adobe $54.99 | New font pack $45 | Skillshare $32
Payment each month: -$185

End March balance should be ~$4,780-$4,900 (slowly creeping up despite payments — this is the crisis)

FILE 3: marcus-income.json
{
  "version": "inc_1.0",
  "exportedAt": "2026-03-31T00:00:00.000Z",
  "profileId": "pin_marcus_chen",
  "streams": [
    {
      "id": "inc_marcus_001",
      "name": "Accenture - Salary",
      "type": "W2",
      "amount": "3437",
      "frequency": "Bi-Weekly",
      "stabilityRating": "Stable",
      "afterTax": true,
      "startDate": "2022-06-01",
      "endDate": "",
      "notes": "Senior Product Manager",
      "categoryId": "inc_001",
      "color": "#6366f1"
    },
    {
      "id": "inc_marcus_002",
      "name": "Freelance UX Consulting",
      "type": "Self-Employment",
      "amount": "1150",
      "frequency": "Monthly",
      "stabilityRating": "Variable",
      "afterTax": false,
      "startDate": "2023-01-01",
      "endDate": "",
      "notes": "Variable, typically $1k-$1.5k/month. Set aside 25% for taxes.",
      "categoryId": "inc_002",
      "color": "#10b981"
    }
  ]
}

FILE 4: marcus-debt.json
{
  "version": "dt_1.0",
  "exportedAt": "2026-03-31T00:00:00.000Z",
  "profileId": "pin_marcus_chen",
  "cards": [
    {
      "id": "dt_marcus_card_001",
      "name": "Chase Sapphire Reserve",
      "last4": "7743",
      "color": "#6366f1",
      "balance": "2380.00",
      "limit": "8000",
      "apr": "19.99",
      "minPaymentMode": "auto",
      "minPaymentFixed": "",
      "monthlyPayment": "425",
      "payoffMode": "payment",
      "dueDay": "18",
      "statementDay": "10",
      "expiration": "11/27",
      "originalBalance": "2380.00"
    },
    {
      "id": "dt_marcus_card_002",
      "name": "Citi Double Cash",
      "last4": "3391",
      "color": "#ef4444",
      "balance": "4850.00",
      "limit": "5500",
      "apr": "24.99",
      "minPaymentMode": "auto",
      "minPaymentFixed": "",
      "monthlyPayment": "185",
      "payoffMode": "payment",
      "dueDay": "25",
      "statementDay": "17",
      "expiration": "06/28",
      "originalBalance": "4565.00"
    }
  ],
  "loans": [
    {
      "id": "dt_marcus_loan_001",
      "name": "Cityview Condo Mortgage",
      "lender": "Rocket Mortgage",
      "type": "mortgage",
      "color": "#3b82f6",
      "originalBalance": "425000",
      "currentBalance": "418200.00",
      "interestRate": "6.250",
      "monthlyPayment": "2617.00",
      "termMonths": 360,
      "remainingMonths": "336",
      "nextPaymentDay": "1",
      "notes": "30yr fixed, bought Jan 2024. HOA $385/mo additional."
    },
    {
      "id": "dt_marcus_loan_002",
      "name": "2024 Honda CR-V",
      "lender": "Honda Financial Services",
      "type": "auto",
      "color": "#f97316",
      "originalBalance": "30000",
      "currentBalance": "21400.00",
      "interestRate": "7.100",
      "monthlyPayment": "594.00",
      "termMonths": 60,
      "remainingMonths": "38",
      "nextPaymentDay": "5",
      "notes": "60-month loan, 22 months paid"
    }
  ],
  "logs": []
}

Output all 4 files clearly labeled. Adjust balances to be realistic and consistent with the
spending patterns shown in the CSV files.
```

---

## PROMPT 3 — Sarah Mitchell (Test User 3)

```
Generate realistic test data for a personal finance app test user named Sarah Mitchell.
Output exactly 4 files as specified below. Make all data internally consistent — balances,
payments, and spending should make sense together. Date range: January 1, 2026 through
March 31, 2026.

---

USER PROFILE: Sarah Mitchell
- Self-employed: landscape architecture firm owner
- Income is seasonal and variable:
  January: ~$9,200 (strong — year-end project payments coming in)
  February: ~$6,800 (low season — slower month)
  March: ~$8,400 (picking up — spring projects starting)
- Rental income: $1,850/month rent received, $1,500/month mortgage on rental = $350 net cash flow
  (show gross rental income, rental mortgage is separate expense)
- Is a saver — disciplined, tracks everything
- Challenge: Vacation spending. She works hard and rewards herself with travel.
  Books trips impulsively, tends to put them on credit cards.
  January: booked a March trip to Costa Rica ($1,847 flights + hotel deposit)
  March: the Costa Rica trip itself ($680 activities + meals + souvenirs + excursions)
  Also books a summer trip in March (deposits: $450 flights, $320 hotel)

DEBTS:
- Home Mortgage: 30-year originally, 20 years remaining. $3,500/month. 
  ~6% APR. Estimate original loan ~$480,000, current balance ~$398,000.
- Rental Property Mortgage: $1,500/month. 15-year, 8 years remaining at 5.5%.
  Original ~$185,000. Current balance ~$112,000.
- Truck Loan: 2023 Ford F-250 (needed for site visits — gas guzzler).
  $700/month, 48-month loan, 24 months remaining. ~$15,800 balance. 7.9% APR.
- Credit Card 1 (Chase Sapphire Preferred — personal): $12,000 limit, $5,200 balance. 21.99% APR.
  This is where vacation goes. Carries a balance.
- Credit Card 2 (Amex Blue Cash — personal): $8,000 limit, $2,100 balance. 18.99% APR.
  General personal use. Reasonably managed.
- Credit Card 3 (Chase Ink Business — business card): $15,000 limit, $7,700 balance. 20.49% APR.
  Business expenses: software, supplies, subcontractors. Carries a balance.
  Total CC debt: $15,000 of ~$35,000 total limit.

---

FILE 1: sarah-checking.csv
Format as a realistic Bank of America checking account CSV.
Headers: Date,Description,Amount,Balance
- Amount: negative = debit, positive = deposit
- Starting balance: ~$14,200 on Jan 1 (she keeps a buffer — saver mindset)

Income deposits (variable, paid by invoice — irregular dates):
JANUARY: Client deposits totaling ~$9,200:
  "HENDERSON GROUP ACH" $3,400 | "METRO PARKS DEPT" $2,800 | "RIVERSIDE HOA" $3,000
FEBRUARY: Slower: "METRO PARKS DEPT" $2,200 | "PRIVATE CLIENT ACH" $4,600
MARCH: "HENDERSON GROUP ACH" $4,100 | "SPRING CREEK RESORT" $2,100 | "PRIVATE CLIENT ACH" $2,200

Rental income: "RENTAL PROPERTY DEP" +$1,850 (1st of each month — tenant pays promptly)

FIXED MONTHLY EXPENSES:
  - Home mortgage: "BANK OF AMERICA MORTG" -$3,500 (1st)
  - Rental property mortgage: "BOA RENTAL MORTG" -$1,500 (5th)
  - Truck loan: "FORD MOTOR CREDIT" -$700 (10th)
  - Home insurance: "STATE FARM HOME" -$187
  - Auto insurance (truck): "STATE FARM AUTO" -$194
  - Business software: QuickBooks, Adobe, various -$85 to -$145 (on business card, show as biz card pmt)
  - Health insurance (self-employed): "BCBS HEALTH INS" -$487/month
  - Utilities home: electric -$145 to -$210, gas -$65 to -$110, water -$45
  - Internet: "AT&T FIBER" -$89
  - Phone: "APPLE IPHONE PLAN" -$95

VARIABLE:
  - Gas (F-250 is thirsty): "CHEVRON", "SHELL", "LOVES" 4-6 times/month, -$75 to -$110 each
  - Groceries: "WHOLE FOODS", "SPROUTS", "COSTCO" 3-5 times, -$65 to -$195
  - Dining: moderate (she eats well but cooks a lot), 4-6 times, -$22 to -$68
  - Professional: "ASLA MEMBERSHIP" Jan -$595 | Software subscriptions

CC PAYMENTS (she pays well above minimum — saver discipline):
  - Chase Sapphire: -$350/month 
  - Amex Blue Cash: -$300/month
  - Chase Ink Business: -$500/month (on checking, paying down biz card)

SAVINGS/INVESTMENTS (she saves aggressively):
  - "TRANSFER TO SAVINGS" -$1,500 Jan, -$800 Feb (tighter month), -$1,200 Mar
  - "VANGUARD IRA CONTRIB" -$500/month
  - "SEP IRA CONTRIB" quarterly — show in March: -$2,300

VACATION SPENDING (THE CHALLENGE):
  JANUARY (booking the Costa Rica trip):
    "UNITED AIRLINES" -$847 (flights — goes on Chase Sapphire)
    "MARRIOTT HOTELS" -$1,000 (deposit — on Chase Sapphire)
    (show as Chase Sapphire payment increase in Feb to partially cover)
  MARCH (in Costa Rica + booking summer):
    Show these on Chase Sapphire statement instead
    Show increased Chase payment in March

Generate 60-80 transactions per month.

FILE 2: sarah-cc.csv
Format as a Chase Sapphire Preferred credit card statement.
Headers: Trans Date,Post Date,Description,Amount,Category
- Positive = purchase/charge, Negative = payment
- Starting balance: $5,200.00 (January 1)
- Credit limit: $12,000

JANUARY: 
  Vacation booking: UNITED AIRLINES $847.00 | MARRIOTT BONVOY $1,000.00
  Regular use: dining 3-4 times $28-$65 each | Spotify $10.99 | Netflix $15.49
  Payment received: -$350.00

FEBRUARY:
  Normal month — no big vacation purchases
  Dining and misc: 5-6 times, $18-$58 each
  Annual fee: CHASE ANNUAL FEE $95.00
  Payment: -$350.00
  Balance creeping up due to January bookings + annual fee

MARCH (COSTA RICA TRIP):
  Travel charges: 
    COSTA RICA ACTIVITIES TOUR CO $285.00
    OCEAN ADVENTURES CR $195.00
    LOCAL RESTAURANTS (multiple) $340.00 total
    SOUVENIR SHOPS $87.00
    UBER COSTA RICA $52.00
  Summer trip deposits:
    DELTA AIRLINES $450.00
    HILTON HOTELS $320.00
  Regular: dining, streaming
  Payment: -$350.00 (same payment but balance growing — this is the pattern)

End March balance: ~$7,800-$8,200 (growing — vacation habit is real)

FILE 3: sarah-income.json
{
  "version": "inc_1.0",
  "exportedAt": "2026-03-31T00:00:00.000Z",
  "profileId": "pin_sarah_mitchell",
  "streams": [
    {
      "id": "inc_sarah_001",
      "name": "Mitchell Landscape Architecture",
      "type": "Self-Employment",
      "amount": "8133",
      "frequency": "Monthly",
      "stabilityRating": "Variable",
      "afterTax": false,
      "startDate": "2019-03-01",
      "endDate": "",
      "notes": "Seasonal — strong Q1/Q3, slower Feb. Set aside 30% for taxes and SEP IRA.",
      "categoryId": "inc_002",
      "color": "#10b981"
    },
    {
      "id": "inc_sarah_002",
      "name": "Rental Property - Oak Street",
      "type": "Rental",
      "amount": "1850",
      "frequency": "Monthly",
      "stabilityRating": "Stable",
      "afterTax": false,
      "startDate": "2021-07-01",
      "endDate": "",
      "notes": "Gross rent $1850. Rental mortgage $1500. Net cash flow ~$350/mo before maintenance.",
      "categoryId": "inc_004",
      "color": "#3b82f6"
    }
  ]
}

FILE 4: sarah-debt.json
{
  "version": "dt_1.0",
  "exportedAt": "2026-03-31T00:00:00.000Z",
  "profileId": "pin_sarah_mitchell",
  "cards": [
    {
      "id": "dt_sarah_card_001",
      "name": "Chase Sapphire Preferred",
      "last4": "2241",
      "color": "#6366f1",
      "balance": "8050.00",
      "limit": "12000",
      "apr": "21.99",
      "minPaymentMode": "auto",
      "minPaymentFixed": "",
      "monthlyPayment": "350",
      "payoffMode": "payment",
      "dueDay": "20",
      "statementDay": "12",
      "expiration": "04/29",
      "originalBalance": "5200.00"
    },
    {
      "id": "dt_sarah_card_002",
      "name": "Amex Blue Cash Preferred",
      "last4": "8847",
      "color": "#10b981",
      "balance": "2100.00",
      "limit": "8000",
      "apr": "18.99",
      "minPaymentMode": "auto",
      "minPaymentFixed": "",
      "monthlyPayment": "300",
      "payoffMode": "payment",
      "dueDay": "15",
      "statementDay": "7",
      "expiration": "08/27",
      "originalBalance": "2100.00"
    },
    {
      "id": "dt_sarah_card_003",
      "name": "Chase Ink Business Preferred",
      "last4": "5519",
      "color": "#f97316",
      "balance": "7700.00",
      "limit": "15000",
      "apr": "20.49",
      "minPaymentMode": "auto",
      "minPaymentFixed": "",
      "monthlyPayment": "500",
      "payoffMode": "payment",
      "dueDay": "28",
      "statementDay": "20",
      "expiration": "12/28",
      "originalBalance": "7700.00"
    }
  ],
  "loans": [
    {
      "id": "dt_sarah_loan_001",
      "name": "Primary Home Mortgage",
      "lender": "Bank of America",
      "type": "mortgage",
      "color": "#3b82f6",
      "originalBalance": "480000",
      "currentBalance": "398200.00",
      "interestRate": "6.000",
      "monthlyPayment": "3500.00",
      "termMonths": 360,
      "remainingMonths": "240",
      "nextPaymentDay": "1",
      "notes": "30-year fixed, 10 years paid, 20 remaining."
    },
    {
      "id": "dt_sarah_loan_002",
      "name": "Oak Street Rental Mortgage",
      "lender": "Bank of America",
      "type": "mortgage",
      "color": "#06b6d4",
      "originalBalance": "185000",
      "currentBalance": "112400.00",
      "interestRate": "5.500",
      "monthlyPayment": "1500.00",
      "termMonths": 180,
      "remainingMonths": "96",
      "nextPaymentDay": "5",
      "notes": "15-year fixed, 7 years paid, 8 remaining. Investment property."
    },
    {
      "id": "dt_sarah_loan_003",
      "name": "2023 Ford F-250",
      "lender": "Ford Motor Credit",
      "type": "auto",
      "color": "#f59e0b",
      "originalBalance": "52000",
      "currentBalance": "15800.00",
      "interestRate": "7.900",
      "monthlyPayment": "700.00",
      "termMonths": 48,
      "remainingMonths": "24",
      "nextPaymentDay": "10",
      "notes": "F-250 for site visits. High gas costs — ~$350-450/month in fuel."
    }
  ],
  "logs": []
}

Output all 4 files clearly labeled. Make the data feel real — vary transaction dates
realistically, use authentic-sounding merchant names, and ensure all the numbers add up
across the three months.
```

---

## Import Instructions

Once you have the generated files, import them in this order per user:

**SpendingTracker:**
1. Open SpendingTracker → Import CSV
2. Create account "Checking" → map columns → import checking CSV
3. Create account "Credit Card" → map columns → toggle Flip Sign → import CC CSV

**IncomeTracker:**
1. Open IncomeTracker → Backup & Restore → Import JSON
2. Select the income JSON file → Import (Replace)

**DebtTracker:**
1. Open DebtTracker → Backup & Restore → Import JSON
2. Select the debt JSON file → Import (Replace)

Each user should be loaded as a separate profile using their Recovery PIN:
- Emma: `pin_emma_rodriguez`
- Marcus: `pin_marcus_chen`  
- Sarah: `pin_sarah_mitchell`
