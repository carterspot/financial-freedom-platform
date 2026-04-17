Generate realistic test data for a married couple — Jordan and Taylor Williams — for a personal finance app. They have separate profiles but shared expenses. Output exactly 6 files as specified. All data must be internally consistent across both profiles. Date range: January 1, 2026 through March 31, 2026. 

  

--- 

  

HOUSEHOLD OVERVIEW: Jordan & Taylor Williams 

- Married, one child: Lily, age 4 

- Live in: 2BR townhome, Temecula, CA (they own) 

- Own: 1BR condo, San Diego, CA (investment/rental property) 

- Lily's daycare: $1,850/month (Taylor pays from her checking) 

- 529 college savings for Lily: $300/month (Taylor contributes) 

  

SHARED DEBTS (split between profiles for clarity): 

- Temecula townhome mortgage: $485,000 original, 5 years in, ~$430,000 remaining 

  6.1% APR, 30-year → $2,940/month (Taylor pays from her account) 

- San Diego rental condo: $395,000 original, 3 years in, ~$360,000 remaining 

  5.75% APR, 30-year → $2,305/month (Taylor pays, rent covers it + profit) 

  Tenant pays: $2,650/month rent → net cash flow ~$345/month 

- Jordan's Tesla Model 3 (2023): $42K original, 48-month loan, ~$24,000 remaining 

  6.8% APR → $698/month (Jordan pays) 

- Taylor's Honda Pilot (2021): PAID OFF — bought used, she's a saver 

  

--- 

  

PROFILE 1: JORDAN WILLIAMS — THE SPENDER 

  

Income: 

- W2: TechBridge Solutions, Inside Sales Manager 

  Base: $95,000/year → ~$5,950/month net biweekly after taxes (~27% effective rate) 

  Commission: variable, paid monthly on the 20th 

    January: $1,850 commission (good close to Q4) 

    February: $620 commission (slow month) 

    March: $2,240 commission (Q1 push) 

- Commutes SD↔Temecula 3 days/week — high gas costs for Tesla even though EV 

  (uses charging at work + occasional supercharger) 

  

Jordan's challenge — OVERSPENDS ON: 

  1. Tech gadgets: Best Buy, Apple Store, Amazon electronics, B&H Photo 

  2. Sports/outdoor gear: REI, Dick's Sporting Goods, online gear shops 

  3. Dining out: lunches in SD on commute days, team dinners, weekend dining 

  These go on his Chase Freedom credit card primarily 

  

Jordan's debts: 

- Chase Freedom Unlimited: $7,500 limit, ~$3,200 balance. 22.49% APR.  

  Balance growing slowly because of gadget/dining habit. 

- Tesla loan: see above 

  

FILE 1: jordan-checking.csv 

Format as a Chase Bank checking account CSV. 

Headers: Date,Description,Amount,Type,Balance 

Starting balance: ~$4,800 Jan 1 

  

INCOME each month: 

  - Biweekly paycheck "TECHBRIDGE SOLUTIONS DD": ~$2,975 (1st and 15th approx) 

  - Commission on 20th: Jan $1,850 | Feb $620 | Mar $2,240 

  - Venmo/Zelle from Taylor for shared expenses: "ZELLE FROM T WILLIAMS"  

    $400/month (his share of groceries/household split) 

  

FIXED: 

  - Tesla loan: "TESLA FINANCIAL SVCS" -$698 (5th) 

  - Tesla insurance: "PROGRESSIVE AUTO" -$187 (1st) 

  - Tesla Supercharger or home charging: "TESLA SUPERCHARGER" $22-$45 monthly 

  - Phone: "T-MOBILE" -$89 

  - Streaming: "YOUTUBE PREMIUM" -$13.99 | "ESPN+" -$10.99 | "PARAMOUNT+" -$11.99 

  - Gym membership: "ANYTIME FITNESS" -$39.99 

  - Half of grocery runs (on his card sometimes): varies 

  

VARIABLE — THE PROBLEM SPENDING: 

  JANUARY (post-holiday, new year new gear mindset): 

    Tech: BEST BUY $347 (new monitor for WFH) | AMAZON $128 (cables, accessories) 

    Outdoor: REI $229 (new hiking boots) | DICKS SPORTING GOODS $87 

    Dining SD commute days: 8-10 lunches $12-$28 each 

    Weekend dining family: 3-4 times $45-$95 each 

    Starbucks: daily on commute days ~$6-$8, 12 times 

  

  FEBRUARY: 

    Tech: APPLE STORE $199 (AirPods case + accessories) | AMAZON ELECTRONICS $156 

    Outdoor: ONLINE GEAR SHOP $312 (snowboard wax, goggles — Feb ski trip) 

    Ski trip weekend: MAMMOTH MOUNTAIN LIFT TICKETS $287 | LODGING $340 

    Dining: slightly less (short month) but still 6-8 lunches + 2-3 family dinners 

     

  MARCH: 

    Tech: B&H PHOTO $445 (mirrorless camera — "for family photos") 

    Outdoor: REI $167 (spring hiking gear) 

    Dining: back to normal 8-10 lunches + family dining 

    He puts some of these on Chase card (show CC payment accordingly) 

  

CC PAYMENT (Chase Freedom): 

  - "CHASE FREEDOM PAYMENT" mid-month: Jan -$250 | Feb -$300 | Mar -$275 

  - Never pays it off — balance slowly creeping: Jan end ~$3,420 | Feb ~$3,650 | Mar ~$3,980 

  

SAVINGS: 

  Jordan is not a saver — he has no automatic savings transfer 

  Occasionally moves money to savings only after a good commission month 

  March: "TRANSFER SAVINGS" -$500 (after the big commission) 

  

Generate 50-70 transactions/month. Balance should stay healthy (he earns well)  

but drift slightly based on spending and commission variability. 

  

FILE 2: jordan-cc.csv 

Format as Chase Freedom Unlimited credit card statement. 

Headers: Trans Date,Post Date,Description,Amount,Category 

Positive = purchase, Negative = payment 

Starting balance: $3,200.00 

  

Concentrate the problem spending here: 

JANUARY: Tech gadgets + REI purchases + dining. End balance ~$3,420. 

FEBRUARY: AirPods, ski trip, online gear. End balance ~$3,650 despite payment. 

MARCH: Camera purchase + spring gear + dining. End balance ~$3,980. 

Include payments matching what shows in checking. 

  

FILE 3: jordan-income.json 

{ 

  "version": "inc_1.0", 

  "exportedAt": "2026-03-31T00:00:00.000Z", 

  "profileId": "pin_jordan_williams", 

  "streams": [ 

    { 

      "id": "inc_jordan_001", 

      "name": "TechBridge Solutions - Base Salary", 

      "type": "W2", 

      "amount": "2975", 

      "frequency": "Bi-Weekly", 

      "stabilityRating": "Stable", 

      "afterTax": true, 

      "startDate": "2023-04-01", 

      "endDate": "", 

      "notes": "Inside Sales Manager. Base $95K. Biweekly deposit.", 

      "categoryId": "inc_001", 

      "color": "#6366f1" 

    }, 

    { 

      "id": "inc_jordan_002", 

      "name": "TechBridge Solutions - Sales Commission", 

      "type": "W2", 

      "amount": "1570", 

      "frequency": "Monthly", 

      "stabilityRating": "Variable", 

      "afterTax": true, 

      "startDate": "2023-04-01", 

      "endDate": "", 

      "notes": "Variable commission paid 20th of each month. Range $500-$3000.", 

      "categoryId": "inc_001", 

      "color": "#ec4899" 

    } 

  ] 

} 

  

FILE 4: jordan-debt.json 

{ 

  "version": "dt_1.0", 

  "exportedAt": "2026-03-31T00:00:00.000Z", 

  "profileId": "pin_jordan_williams", 

  "cards": [ 

    { 

      "id": "dt_jordan_card_001", 

      "name": "Chase Freedom Unlimited", 

      "last4": "6621", 

      "color": "#f97316", 

      "balance": "3980.00", 

      "limit": "7500", 

      "apr": "22.49", 

      "minPaymentMode": "auto", 

      "minPaymentFixed": "", 

      "monthlyPayment": "275", 

      "payoffMode": "payment", 

      "dueDay": "22", 

      "statementDay": "14", 

      "expiration": "07/28", 

      "originalBalance": "3200.00" 

    } 

  ], 

  "loans": [ 

    { 

      "id": "dt_jordan_loan_001", 

      "name": "2023 Tesla Model 3", 

      "lender": "Tesla Financial Services", 

      "type": "auto", 

      "color": "#ef4444", 

      "originalBalance": "42000", 

      "currentBalance": "24100.00", 

      "interestRate": "6.800", 

      "monthlyPayment": "698.00", 

      "termMonths": 48, 

      "remainingMonths": "27", 

      "nextPaymentDay": "5", 

      "notes": "2023 Model 3 LR AWD. EV but still has charging costs. Commutes SD-Temecula 3x/week." 

    } 

  ], 

  "logs": [] 

} 

  

--- 

  

PROFILE 2: TAYLOR WILLIAMS — THE SAVER 

  

Income: 

- W2: Temecula Valley Hospital, Registered Nurse (RN) 

  $88,000/year base + shift differentials (nights/weekends add ~$8-10K/year) 

  Net take-home: ~$5,100/month biweekly after taxes (28% effective) 

  Occasional overtime or shift diff bumps some paychecks by $200-$400 

  

Taylor's strength — SAVES INTENTIONALLY: 

  - 529 plan for Lily: $300/month automatic 

  - Emergency fund top-up: $400/month automatic 

  - Retirement: 401k maxed via payroll (already deducted from net) 

  - Occasionally makes extra mortgage principal payments when budget allows 

  

Taylor handles all the household infrastructure: 

  - Townhome mortgage 

  - Rental condo mortgage (and receives rent) 

  - All Lily expenses (daycare, pediatrician, activities) 

  - Utilities, groceries (primary shopper) 

  - Rental property management 

  

Taylor's credit — nearly pristine: 

  - Citi Premier Card: $10,000 limit, $1,240 balance. 17.99% APR. 

    Used for groceries (3x points), gas (3x points), travel bookings 

    Pays in full or near-full every month — she manages this well 

  - No other credit card debt 

  

FILE 5: taylor-checking.csv 

Format as a Bank of America checking account CSV. 

Headers: Date,Description,Amount,Running Balance 

Starting balance: ~$12,400 Jan 1 (she keeps a healthy emergency buffer) 

  

INCOME: 

  - Biweekly paycheck "TEMECULA VALLEY HOSP": ~$2,550 base + occasional diff 

    Jan paychecks: $2,550 | $2,850 (shift diff)  

    Feb: $2,550 | $2,550 

    Mar: $2,550 | $2,980 (extra shifts — colleague called out) 

  - Rental income: "RENTAL DEPOSIT SD CONDO" +$2,650 (1st of each month — on time) 

  - Zelle from Jordan: "ZELLE FROM J WILLIAMS" +$400/month 

  

FIXED: 

  - Townhome mortgage: "BOA HOME MORTGAGE" -$2,940 (1st) 

  - Rental mortgage: "BOA RENTAL MORTGAGE" -$2,305 (3rd) 

  - Daycare: "LITTLE STARS DAYCARE" -$1,850 (1st) 

  - 529 contribution: "529 COLLEGE SAVINGS" -$300 (5th) 

  - Emergency fund: "TRANSFER TO SAVINGS" -$400 (5th) 

  - HOA townhome: "SOMMERSET HILLS HOA" -$225 (1st) 

  - Home insurance: "STATE FARM HOME" -$147 (15th) 

  - Life insurance (both): "NORTHWESTERN MUTUAL" -$89 (1st) 

  - Electric: "SCE ELECTRIC" -$145 to -$195 

  - Gas (SoCalGas): "SOCALGAS" -$55 to -$95 

  - Water: "CITY OF TEMECULA" -$62 

  - Internet: "COX COMMUNICATIONS" -$79.99 

  - Taylor's phone: "VERIZON" -$76 

  

VARIABLE: 

  - Groceries (primary shopper): "VONS", "COSTCO", "SPROUTS"  

    4-6 transactions/month, $85-$220 each 

    (some on Citi card for points — show those as Citi payment) 

  - Lily's pediatrician/copays: "TEMECULA PEDIATRICS" $25-$45 occasional 

  - Lily activities: "LITTLE GYM TEMECULA" -$89/month | Occasional dance class 

  - Gas for Honda Pilot (paid off — efficient car): 2-3 fillups, -$48 to -$65 

  - Pharmacy: "CVS PHARMACY" 1-2 times, $12-$38 

  - Home maintenance (she handles this): varies 

    January: nothing | February: "HOME DEPOT" -$127 (minor fix) 

    March: "LOWES" -$89 + "HANDYMAN SERVICES" -$165 (rental property repair — deductible) 

  - Dining (family outings, she's moderate): 2-3 times, $38-$78 

  - Date night (Jordan usually pays — she occasionally does): 1-2 times, $65-$120 

  

CITI CARD PAYMENT (she pays almost in full): 

  - "CITI PREMIER PAYMENT": Jan -$1,100 | Feb -$890 | Mar -$1,240 

  

EXTRA MORTGAGE PRINCIPAL (she does this when she can): 

  - January: extra $200 to mortgage principal "BOA MORTGAGE EXTRA" (good month) 

  - February: skips (tighter) 

  - March: extra $300 (Jordan's commission eased pressure) 

  

Generate 60-80 transactions/month. Balance should stay strong ($10K-$14K range) 

reflecting her disciplined management. 

  

FILE 6: taylor-cc.csv 

Format as a Citi Premier credit card statement. 

Headers: Trans Date,Post Date,Description,Amount,Category 

Positive = purchase, Negative = payment 

Starting balance: $1,240.00 

  

Taylor's card is well-managed — groceries for points, some gas, occasional online: 

JANUARY: VONS $187 | COSTCO $234 | SPROUTS $92 | CHEVRON $54 | AMAZON $67 (household) 

  TARGET $43 | PEDIATRICIAN COPAY $30 | Payment: -$1,100 

FEBRUARY: VONS $156 | COSTCO $198 | SPROUTS $88 | CHEVRON $49 | HOME DEPOT $127 

  AMAZON $38 | Payment: -$890 

MARCH: VONS $178 | COSTCO $267 (stocking up) | SPROUTS $95 | CHEVRON $52 

  AMAZON $54 | CHILDRENS MUSEUM $24 (Lily outing) | CHEESECAKE FACTORY $87 (anniversary dinner) 

  Payment: -$1,240 

End of March balance should be ~$1,100-$1,400 — she keeps this tight. 

  

FILE 7: taylor-income.json 

{ 

  "version": "inc_1.0", 

  "exportedAt": "2026-03-31T00:00:00.000Z", 

  "profileId": "pin_taylor_williams", 

  "streams": [ 

    { 

      "id": "inc_taylor_001", 

      "name": "Temecula Valley Hospital - RN", 

      "type": "W2", 

      "amount": "2550", 

      "frequency": "Bi-Weekly", 

      "stabilityRating": "Stable", 

      "afterTax": true, 

      "startDate": "2021-09-01", 

      "endDate": "", 

      "notes": "Base pay. Shift differentials add $200-$450 on some checks. 401k maxed via payroll.", 

      "categoryId": "inc_001", 

      "color": "#10b981" 

    }, 

    { 

      "id": "inc_taylor_002", 

      "name": "SD Condo - Rental Income", 

      "type": "Rental", 

      "amount": "2650", 

      "frequency": "Monthly", 

      "stabilityRating": "Stable", 

      "afterTax": false, 

      "startDate": "2023-03-01", 

      "endDate": "", 

      "notes": "1BR condo, San Diego. Tenant since Mar 2023. Mortgage on property is $2,305/mo. Net cash flow ~$345.", 

      "categoryId": "inc_004", 

      "color": "#3b82f6" 

    } 

  ] 

} 

  

FILE 8: taylor-debt.json 

{ 

  "version": "dt_1.0", 

  "exportedAt": "2026-03-31T00:00:00.000Z", 

  "profileId": "pin_taylor_williams", 

  "cards": [ 

    { 

      "id": "dt_taylor_card_001", 

      "name": "Citi Premier", 

      "last4": "3308", 

      "color": "#10b981", 

      "balance": "1280.00", 

      "limit": "10000", 

      "apr": "17.99", 

      "minPaymentMode": "auto", 

      "minPaymentFixed": "", 

      "monthlyPayment": "1100", 

      "payoffMode": "payment", 

      "dueDay": "12", 

      "statementDay": "4", 

      "expiration": "03/29", 

      "originalBalance": "1240.00" 

    } 

  ], 

  "loans": [ 

    { 

      "id": "dt_taylor_loan_001", 

      "name": "Sommerset Hills Townhome", 

      "lender": "Bank of America", 

      "type": "mortgage", 

      "color": "#6366f1", 

      "originalBalance": "485000", 

      "currentBalance": "430200.00", 

      "interestRate": "6.100", 

      "monthlyPayment": "2940.00", 

      "termMonths": 360, 

      "remainingMonths": "300", 

      "nextPaymentDay": "1", 

      "notes": "Primary residence. 2BR townhome, Temecula CA. 5 years in. HOA $225/mo." 

    }, 

    { 

      "id": "dt_taylor_loan_002", 

      "name": "SD Condo - Investment", 

      "lender": "Bank of America", 

      "type": "mortgage", 

      "color": "#06b6d4", 

      "originalBalance": "395000", 

      "currentBalance": "360400.00", 

      "interestRate": "5.750", 

      "monthlyPayment": "2305.00", 

      "termMonths": 360, 

      "remainingMonths": "324", 

      "nextPaymentDay": "3", 

      "notes": "Rental property - 1BR condo, San Diego CA. Tenant pays $2,650/mo. Positive cash flow ~$345." 

    } 

  ], 

  "logs": [] 

} 

  

--- 

  

OUTPUT INSTRUCTIONS: 

- Output all 8 files clearly labeled with filenames 

- Make all transaction dates realistic (weekdays for most, some weekend shopping) 

- Vary amounts slightly month to month — don't repeat exact numbers 

- Jordan's balance should fluctuate more; Taylor's should stay stable and healthy 

- The contrast between their spending styles should be clearly visible in the data 

- Ensure CC balances at end of March match the debt JSON files 