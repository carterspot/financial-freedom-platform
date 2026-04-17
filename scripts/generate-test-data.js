'use strict';
const fs = require('fs');
const path = require('path');

// ==================== PRNG ====================
function seededRNG(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
  }
  let s = h >>> 0;
  return function () {
    s = Math.imul(1664525, s) + 1013904223 | 0;
    return (s >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randAmount(rng, min, max) {
  return Math.round((min + rng() * (max - min)) * 100) / 100;
}
function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}
function r2(n) { return Math.round(n * 100) / 100; }

// ==================== DATE HELPERS ====================
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function fmtMDY(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${m}/${dd}/${d.getFullYear()}`;
}
function addDays(d, n) {
  const r = new Date(d.getTime());
  r.setDate(r.getDate() + n);
  return r;
}
function daysBetween(d1, d2) {
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}
function monthsBetween(d1, d2) {
  return (d2.getTime() - d1.getTime()) / (86400000 * 30.4375);
}
function daysInMonth(year, month0) {
  return new Date(year, month0 + 1, 0).getDate();
}

// ==================== CONSTANTS ====================
const BASE_DATE = new Date(2026, 2, 31); // 2026-03-31

const BASE_BALANCES = {
  emma_checking: 3450,   emma_cc: 2150,
  marcus_checking: 8100, marcus_cc: 4850,
  sarah_checking: 13200, sarah_cc: 7900,
  jordan_checking: 4200, jordan_cc: 3980,
  taylor_checking: 11800, taylor_cc: 1280,
};

const NET_MONTHLY = { emma: 200, marcus: 500, sarah: 800, jordan: 100, taylor: 600 };

// Monthly net change in CC balance (positive = grows, negative = shrinks)
const CC_MONTHLY_DELTA = { emma: -10, marcus: 50, sarah: -100, jordan: 250, taylor: 0 };

function getStartBalance(key, startDate) {
  const base = BASE_BALANCES[key];
  if (key.endsWith('_cc')) return base;
  const persona = key.replace('_checking', '');
  const months = Math.max(0, monthsBetween(BASE_DATE, startDate));
  return r2(base + months * NET_MONTHLY[persona]);
}

// ==================== TRANSACTION HELPERS ====================
function addBalances(txns, startBal) {
  const sorted = [...txns].sort((a, b) => a.date.getTime() - b.date.getTime());
  let bal = r2(startBal);
  return sorted.map(tx => {
    bal = r2(bal + tx.amount);
    return { ...tx, balance: bal };
  });
}

function sortTxns(txns) {
  return [...txns].sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ==================== CSV FORMATTERS ====================
function csvEsc(s) {
  const str = String(s == null ? '' : s);
  return (str.includes(',') || str.includes('"') || str.includes('\n'))
    ? `"${str.replace(/"/g, '""')}"` : str;
}

// Chase checking: Date,Description,Amount,Type,Balance  (YYYY-MM-DD)
function toChaseCheckCSV(txns) {
  const rows = ['Date,Description,Amount,Type,Balance'];
  for (const tx of txns) {
    rows.push([
      fmtYMD(tx.date), csvEsc(tx.description),
      tx.amount.toFixed(2), tx.amount >= 0 ? 'credit' : 'debit',
      tx.balance.toFixed(2),
    ].join(','));
  }
  return rows.join('\n') + '\n';
}

// Wells Fargo checking: Date,Description,Amount,Running Balance  (MM/DD/YYYY)
function toWFCheckCSV(txns) {
  const rows = ['Date,Description,Amount,Running Balance'];
  for (const tx of txns) {
    rows.push([fmtMDY(tx.date), csvEsc(tx.description), tx.amount.toFixed(2), tx.balance.toFixed(2)].join(','));
  }
  return rows.join('\n') + '\n';
}

// BofA checking: Date,Description,Amount,Balance  (YYYY-MM-DD)
function toBofACheckCSV(txns) {
  const rows = ['Date,Description,Amount,Balance'];
  for (const tx of txns) {
    rows.push([fmtYMD(tx.date), csvEsc(tx.description), tx.amount.toFixed(2), tx.balance.toFixed(2)].join(','));
  }
  return rows.join('\n') + '\n';
}

// Discover / Chase Freedom / Citi Premier CC: Trans Date,Post Date,Description,Amount,Category
function toChaseDiscoverCCCSV(txns) {
  const rows = ['Trans Date,Post Date,Description,Amount,Category'];
  for (const tx of sortTxns(txns)) {
    rows.push([
      fmtYMD(tx.date), fmtYMD(addDays(tx.date, 1)),
      csvEsc(tx.description), tx.amount.toFixed(2), csvEsc(tx.category || 'Shopping'),
    ].join(','));
  }
  return rows.join('\n') + '\n';
}

// Citi CC (Marcus): Date,Description,Amount,Category  (MM/DD/YYYY)
function toCitiCCCSV(txns) {
  const rows = ['Date,Description,Amount,Category'];
  for (const tx of sortTxns(txns)) {
    rows.push([fmtMDY(tx.date), csvEsc(tx.description), tx.amount.toFixed(2), csvEsc(tx.category || 'Shopping')].join(','));
  }
  return rows.join('\n') + '\n';
}

// ==================== GENERATOR HELPERS ====================
function genMonthLoop(startDate, endDate, cb) {
  let cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cur.getTime() <= endDate.getTime()) {
    cb(cur.getFullYear(), cur.getMonth());
    cur.setMonth(cur.getMonth() + 1);
  }
}

// Add a transaction if the day exists and falls within the date range
function makeTxAdder(startDate, endDate, list) {
  return function add(year, month0, day, description, amount, category) {
    if (!day || day < 1) return;
    const maxD = daysInMonth(year, month0);
    if (day > maxD) return;
    const d = new Date(year, month0, day);
    if (d < startDate || d > endDate) return;
    list.push({ date: d, description: String(description), amount: r2(amount), category: category || '' });
  };
}

// Scale a monthly count by the fraction of the month in the date range
function scaleCount(rng, min, max, year, month0, startDate, endDate) {
  const mStart = new Date(year, month0, 1);
  const mEnd   = new Date(year, month0 + 1, 0);
  const rStart = mStart < startDate ? startDate : mStart;
  const rEnd   = mEnd   > endDate   ? endDate   : mEnd;
  const fraction = (daysBetween(rStart, rEnd) + 1) / daysInMonth(year, month0);
  return Math.round(randInt(rng, min, max) * fraction);
}

// Random day within a month (optionally bounded)
function rDay(rng, year, month0, lo, hi) {
  return randInt(rng, lo || 1, hi || daysInMonth(year, month0));
}

// Split a total into n random parts (all positive)
function splitIntoN(rng, total, n) {
  if (n <= 1) return [r2(Math.max(1, total))];
  const parts = [];
  let remaining = total;
  for (let i = 0; i < n - 1; i++) {
    const portion = remaining / (n - i);
    const part = r2(randAmount(rng, portion * 0.5, portion * 1.5));
    parts.push(Math.max(1, part));
    remaining -= part;
  }
  parts.push(r2(Math.max(1, remaining)));
  return parts;
}

// ==================== PERSONA GENERATORS ====================

// ---- EMMA RODRIGUEZ ----
// Chase checking (YYYY-MM-DD) | Discover CC (Trans/Post Date)
function generateEmma(rng, startDate, endDate) {
  const checking = [];
  const cc = [];
  const addC  = makeTxAdder(startDate, endDate, checking);
  const addCC = makeTxAdder(startDate, endDate, cc);

  genMonthLoop(startDate, endDate, (year, month0) => {
    const monthNum = month0 + 1;

    // Biweekly payroll (~1st and ~15th)
    addC(year, month0, 1  + randInt(rng, 0, 1), 'ARGANO LLC PAYROLL', randAmount(rng, 2550, 2620));
    addC(year, month0, 15 + randInt(rng, 0, 1), 'ARGANO LLC PAYROLL', randAmount(rng, 2550, 2620));

    // Fixed checking bills
    addC(year, month0, 1,  'PARKSIDE APARTMENTS',   -1450.00);
    addC(year, month0, 1,  'LEMONADE INSURANCE',    -18.00);
    addC(year, month0, 2,  'XFINITY',               -79.99);
    addC(year, month0, 2,  'AT&T WIRELESS',         -68.00);
    addC(year, month0, 3,  'CITY POWER UTILITY',    -randAmount(rng, 65, 95));
    addC(year, month0, 3,  'PLANET FITNESS',        -24.99);
    addC(year, month0, 5,  'SPOTIFY',               -10.99);
    addC(year, month0, 10, 'NAVIENT PAYMENT',       -650.00);
    addC(year, month0, 15, 'TRANSFER TO SAVINGS',   -516.00);

    // CC payment — same amount on checking and CC
    const ccPmt = randAmount(rng, 200, 350);
    addC (year, month0, 17, 'DISCOVER CARD PAYMENT', -ccPmt);
    addCC(year, month0, 17, 'DISCOVER PAYMENT',      -ccPmt, 'Payment');

    // Fixed CC subscriptions
    addCC(year, month0, 5,  'NETFLIX',      15.49, 'Entertainment');
    addCC(year, month0, 14, 'AMAZON PRIME', 14.99, 'Shopping');

    // Clothing on CC: spike in Jan (1) and Mar (3)
    const isSpike = monthNum === 1 || monthNum === 3;
    const cMin = isSpike ? 100 : 30;
    const cMax = isSpike ? 250 : 80;
    const cCount = scaleCount(rng, isSpike ? 3 : 0, isSpike ? 4 : 1, year, month0, startDate, endDate);
    const cMerch = ['H&M', 'ZARA USA', 'TARGET STYLE', 'TJ MAXX', 'OLD NAVY'];
    for (let i = 0; i < cCount; i++)
      addCC(year, month0, rDay(rng, year, month0), pick(rng, cMerch), randAmount(rng, cMin, cMax), 'Clothing');

    // CC misc dining / personal care
    const ccDin = scaleCount(rng, 1, 3, year, month0, startDate, endDate);
    for (let i = 0; i < ccDin; i++)
      addCC(year, month0, rDay(rng, year, month0),
        pick(rng, ['CHEESECAKE FACTORY', 'UBER EATS', 'OLIVE GARDEN', 'BARNES NOBLE']),
        randAmount(rng, 12, 55), 'Dining');

    const ccPers = scaleCount(rng, 0, 1, year, month0, startDate, endDate);
    for (let i = 0; i < ccPers; i++)
      addCC(year, month0, rDay(rng, year, month0),
        pick(rng, ['SEPHORA', 'ULTA BEAUTY']), randAmount(rng, 18, 50), 'Personal Care');

    // Variable checking
    const grocCount = scaleCount(rng, 8, 12, year, month0, startDate, endDate);
    for (let i = 0; i < grocCount; i++)
      addC(year, month0, rDay(rng, year, month0),
        pick(rng, ['KROGER', 'TRADER JOES', 'WHOLE FOODS']), -randAmount(rng, 45, 140));

    const gasCount = scaleCount(rng, 8, 12, year, month0, startDate, endDate);
    for (let i = 0; i < gasCount; i++)
      addC(year, month0, rDay(rng, year, month0),
        pick(rng, ['SHELL', 'BP', 'CHEVRON']), -randAmount(rng, 38, 55));

    const dinCount = scaleCount(rng, 6, 10, year, month0, startDate, endDate);
    for (let i = 0; i < dinCount; i++)
      addC(year, month0, rDay(rng, year, month0),
        pick(rng, ['CHIPOTLE', 'PANERA BREAD', 'LOCAL PIZZA CO', 'STARBUCKS', 'DUNKIN DONUTS']),
        -randAmount(rng, 8, 35));

    const amzCount = scaleCount(rng, 0, 2, year, month0, startDate, endDate);
    for (let i = 0; i < amzCount; i++)
      addC(year, month0, rDay(rng, year, month0), 'AMAZON.COM', -randAmount(rng, 15, 65));

    const drugCount = scaleCount(rng, 0, 2, year, month0, startDate, endDate);
    for (let i = 0; i < drugCount; i++)
      addC(year, month0, rDay(rng, year, month0),
        pick(rng, ['WALGREENS', 'CVS PHARMACY']), -randAmount(rng, 12, 45));
  });

  return {
    checking: addBalances(checking, getStartBalance('emma_checking', startDate)),
    cc:       sortTxns(cc),
  };
}

// ---- MARCUS CHEN ----
// Wells Fargo checking (MM/DD/YYYY) | Citi CC (MM/DD/YYYY, no post date)
function generateMarcus(rng, startDate, endDate) {
  const checking = [];
  const cc = [];
  const addC  = makeTxAdder(startDate, endDate, checking);
  const addCC = makeTxAdder(startDate, endDate, cc);

  genMonthLoop(startDate, endDate, (year, month0) => {
    const monthNum = month0 + 1;

    // Biweekly W2 payroll
    addC(year, month0, 1  + randInt(rng, 0, 1), 'ACCENTURE PAYROLL DD', randAmount(rng, 3400, 3480));
    addC(year, month0, 15 + randInt(rng, 0, 1), 'ACCENTURE PAYROLL DD', randAmount(rng, 3400, 3480));

    // Side business income (1-2x/month, days 8-25)
    const sideBizCount = randInt(rng, 1, 2);
    for (let i = 0; i < sideBizCount; i++)
      addC(year, month0, rDay(rng, year, month0, 8, 25),
        pick(rng, ['STRIPE TRANSFER', 'PAYPAL TRANSFER']), randAmount(rng, 500, 1500));

    // Fixed bills
    addC(year, month0, 1,  'ROCKET MORTGAGE',      -2617.00);
    addC(year, month0, 1,  'CITYVIEW CONDOS HOA',  -385.00);
    addC(year, month0, 5,  'HONDA FINANCIAL',      -594.00);
    addC(year, month0, 5,  'CON EDISON',           -randAmount(rng, 95, 145));
    addC(year, month0, 6,  'SPECTRUM',             -89.99);
    addC(year, month0, 7,  'VERIZON WIRELESS',     -142.00);
    addC(year, month0, 8,  'APPLE ONE',            -32.95);
    addC(year, month0, 8,  'HBO MAX',              -15.99);
    addC(year, month0, 15, 'CHASE SAPPHIRE PAYMENT', -randAmount(rng, 350, 500));
    addC(year, month0, 20, 'CITI CARD PAYMENT',    -185.00);
    addC(year, month0, 22, 'TRANSFER TO SAVINGS',  -randAmount(rng, 780, 1100));

    // CC payment (mirrors checking)
    addCC(year, month0, 20, 'CITI PAYMENT', -185.00, 'Payment');

    // Fixed CC subscriptions
    addCC(year, month0, 8, 'ADOBE CREATIVE CLOUD', 54.99, 'Software');
    addCC(year, month0, 8, 'FIGMA',                15.00, 'Software');

    // Home goods — THE PROBLEM (Feb spike)
    const isSpike = monthNum === 2;
    const hgMin = isSpike ? 140 : 60;
    const hgMax = isSpike ? 350 : 180;
    const hgCount = scaleCount(rng, isSpike ? 3 : 1, isSpike ? 4 : 2, year, month0, startDate, endDate);
    for (let i = 0; i < hgCount; i++)
      addCC(year, month0, rDay(rng, year, month0),
        pick(rng, ['HOMEGOODS', 'WAYFAIR.COM', 'AMAZON HOME', 'IKEA']),
        randAmount(rng, hgMin, hgMax), 'Home');

    // Online courses/tools (0-1/month)
    const courseCount = scaleCount(rng, 0, 1, year, month0, startDate, endDate);
    for (let i = 0; i < courseCount; i++)
      addCC(year, month0, rDay(rng, year, month0),
        pick(rng, ['UDEMY', 'SKILLSHARE', 'FONT SHOP', 'CREATIVE MARKET']),
        randAmount(rng, 25, 150), 'Education');

    // Variable checking
    const grocCount = scaleCount(rng, 3, 5, year, month0, startDate, endDate);
    for (let i = 0; i < grocCount; i++)
      addC(year, month0, rDay(rng, year, month0),
        pick(rng, ['WHOLE FOODS MARKET', 'COSTCO', 'TRADER JOES']), -randAmount(rng, 65, 210));

    const gasCount = scaleCount(rng, 3, 4, year, month0, startDate, endDate);
    for (let i = 0; i < gasCount; i++)
      addC(year, month0, rDay(rng, year, month0),
        pick(rng, ['SHELL OIL', 'EXXON MOBIL']), -randAmount(rng, 52, 78));
  });

  return {
    checking: addBalances(checking, getStartBalance('marcus_checking', startDate)),
    cc:       sortTxns(cc),
  };
}

// ---- SARAH MITCHELL ----
// BofA checking (YYYY-MM-DD) | Chase Sapphire CC (Trans/Post Date)
function generateSarah(rng, startDate, endDate) {
  const checking = [];
  const cc = [];
  const addC  = makeTxAdder(startDate, endDate, checking);
  const addCC = makeTxAdder(startDate, endDate, cc);

  genMonthLoop(startDate, endDate, (year, month0) => {
    const monthNum = month0 + 1;

    // Rental income (day 1)
    addC(year, month0, 1, 'RENTAL PROPERTY DEP', 1850.00);

    // Irregular client income (2-4 ACH deposits, scaled to range)
    const incomeCount = scaleCount(rng, 2, 4, year, month0, startDate, endDate);
    if (incomeCount > 0) {
      const monthlyTarget = ({ 1: 9200, 2: 6800, 3: 8400 })[monthNum] || randAmount(rng, 6500, 10000);
      const parts = splitIntoN(rng, monthlyTarget, incomeCount);
      const incMerch = ['HENDERSON GROUP ACH', 'METRO PARKS DEPT', 'RIVERSIDE HOA', 'SPRING CREEK RESORT', 'PRIVATE CLIENT ACH'];
      for (let i = 0; i < incomeCount; i++)
        addC(year, month0, rDay(rng, year, month0, 3, 28), pick(rng, incMerch), parts[i]);
    }

    // Fixed bills
    addC(year, month0, 1,  'BANK OF AMERICA MORTG',    -3500.00);
    addC(year, month0, 5,  'BOA RENTAL MORTG',         -1500.00);
    addC(year, month0, 10, 'FORD MOTOR CREDIT',        -700.00);
    addC(year, month0, 15, 'STATE FARM HOME',          -187.00);
    addC(year, month0, 15, 'STATE FARM AUTO',          -194.00);
    addC(year, month0, 1,  'BCBS HEALTH INS',          -487.00);
    addC(year, month0, 5,  'SCE ELECTRIC',             -randAmount(rng, 145, 210));
    addC(year, month0, 6,  'SOCALGAS',                 -randAmount(rng, 65, 110));
    addC(year, month0, 6,  'CITY OF TEMECULA WATER',   -45.00);
    addC(year, month0, 7,  'AT&T FIBER',               -89.00);
    addC(year, month0, 7,  'APPLE IPHONE PLAN',        -95.00);
    addC(year, month0, 12, 'CHASE SAPPHIRE PAYMENT',   -350.00);
    addC(year, month0, 18, 'AMEX BLUE CASH PAYMENT',   -300.00);
    addC(year, month0, 22, 'CHASE INK PAYMENT',        -500.00);
    addC(year, month0, 5,  'TRANSFER TO SAVINGS',      -randAmount(rng, 800, 1500));
    addC(year, month0, 5,  'VANGUARD IRA CONTRIB',     -500.00);

    // CC payment (mirrors checking)
    addCC(year, month0, 12, 'CHASE SAPPHIRE PAYMENT', -350.00, 'Payment');

    // ASLA Membership (Jan only)
    if (monthNum === 1)
      addC(year, month0, rDay(rng, year, month0, 5, 20), 'ASLA MEMBERSHIP', -595.00);

    // Variable checking
    const gasCount = scaleCount(rng, 4, 6, year, month0, startDate, endDate);
    for (let i = 0; i < gasCount; i++)
      addC(year, month0, rDay(rng, year, month0),
        pick(rng, ['CHEVRON', 'SHELL', 'LOVES TRAVEL']), -randAmount(rng, 75, 110));

    const grocCount = scaleCount(rng, 3, 5, year, month0, startDate, endDate);
    for (let i = 0; i < grocCount; i++)
      addC(year, month0, rDay(rng, year, month0),
        pick(rng, ['WHOLE FOODS MARKET', 'SPROUTS', 'COSTCO']), -randAmount(rng, 65, 195));

    const dinCount = scaleCount(rng, 4, 6, year, month0, startDate, endDate);
    for (let i = 0; i < dinCount; i++)
      addC(year, month0, rDay(rng, year, month0),
        pick(rng, ['LOCAL RESTAURANT', 'POSTMATES', 'BRAVO ITALIAN KITCHEN']), -randAmount(rng, 22, 68));

    // CC (Chase Sapphire) — vacation habit: Jan and Mar
    if (monthNum === 1) {
      addCC(year, month0, rDay(rng, year, month0, 3, 15), 'SOUTHWEST AIRLINES', randAmount(rng, 400, 700),  'Travel');
      addCC(year, month0, rDay(rng, year, month0, 3, 15), 'MARRIOTT HOTELS',    randAmount(rng, 600, 1000), 'Travel');
    } else if (monthNum === 3) {
      addCC(year, month0, rDay(rng, year, month0, 3,  12), 'AIRBNB',          randAmount(rng, 300, 500), 'Travel');
      addCC(year, month0, rDay(rng, year, month0, 12, 20), 'DELTA AIR LINES', randAmount(rng, 280, 420), 'Travel');
      addCC(year, month0, rDay(rng, year, month0, 20, 28), 'HILTON HOTELS',   randAmount(rng, 300, 500), 'Travel');
    } else {
      const lightCount = scaleCount(rng, 1, 3, year, month0, startDate, endDate);
      for (let i = 0; i < lightCount; i++)
        addCC(year, month0, rDay(rng, year, month0),
          pick(rng, ['OPENTABLE RESTAURANT', 'RUTH CHRIS STEAK', 'HULU', 'NETFLIX']),
          randAmount(rng, 15, 80), pick(rng, ['Dining', 'Entertainment']));
    }
  });

  return {
    checking: addBalances(checking, getStartBalance('sarah_checking', startDate)),
    cc:       sortTxns(cc),
  };
}

// ---- JORDAN WILLIAMS ----
// Chase checking (YYYY-MM-DD) | Chase Freedom CC (Trans/Post Date)
function generateJordan(rng, startDate, endDate) {
  const checking = [];
  const cc = [];
  const addC  = makeTxAdder(startDate, endDate, checking);
  const addCC = makeTxAdder(startDate, endDate, cc);

  genMonthLoop(startDate, endDate, (year, month0) => {
    const monthNum = month0 + 1;
    const isQ1Q3 = (monthNum >= 1 && monthNum <= 3) || (monthNum >= 7 && monthNum <= 9);

    // Biweekly W2 payroll
    addC(year, month0, 1  + randInt(rng, 0, 1), 'TECHBRIDGE SOLUTIONS DD', randAmount(rng, 2950, 3000));
    addC(year, month0, 15 + randInt(rng, 0, 1), 'TECHBRIDGE SOLUTIONS DD', randAmount(rng, 2950, 3000));

    // Commission (20th) — higher in Q1/Q3
    addC(year, month0, 20, 'TECHBRIDGE SOLUTIONS COMM',
      randAmount(rng, isQ1Q3 ? 1200 : 500, isQ1Q3 ? 2500 : 1000));

    // Zelle from Taylor (day 3)
    addC(year, month0, 3, 'ZELLE FROM T WILLIAMS', 400.00);

    // Fixed bills
    addC(year, month0, 1,  'PROGRESSIVE AUTO',   -187.00);
    addC(year, month0, 5,  'TESLA FINANCIAL SVCS', -698.00);
    addC(year, month0, 7,  'T-MOBILE',           -89.00);
    addC(year, month0, 8,  'YOUTUBE PREMIUM',    -13.99);
    addC(year, month0, 8,  'ESPN+',              -10.99);
    addC(year, month0, 8,  'PARAMOUNT+',         -11.99);
    addC(year, month0, 10, 'ANYTIME FITNESS',    -39.99);

    // CC payment — same on checking and CC
    const ccPmt = randAmount(rng, 250, 300);
    addC (year, month0, 20, 'CHASE FREEDOM PAYMENT', -ccPmt);
    addCC(year, month0, 20, 'CHASE FREEDOM PAYMENT', -ccPmt, 'Payment');

    // Occasional savings after big commission month (~30% chance in Q1/Q3)
    if (isQ1Q3 && randInt(rng, 1, 10) <= 3)
      addC(year, month0, 25, 'TRANSFER SAVINGS', -500.00);

    // EV charging
    const evCount = scaleCount(rng, 2, 3, year, month0, startDate, endDate);
    for (let i = 0; i < evCount; i++)
      addC(year, month0, rDay(rng, year, month0),
        pick(rng, ['TESLA SUPERCHARGER', 'EVGO']), -randAmount(rng, 22, 45));

    // Occasional gas (range anxiety)
    if (randInt(rng, 0, 2) === 0)
      addC(year, month0, rDay(rng, year, month0), 'SHELL', -randAmount(rng, 10, 25));

    // CC — THE PROBLEM SPENDING
    // Tech gadgets (2-3/month)
    const techCount = scaleCount(rng, 2, 3, year, month0, startDate, endDate);
    for (let i = 0; i < techCount; i++)
      addCC(year, month0, rDay(rng, year, month0),
        pick(rng, ['BEST BUY', 'APPLE STORE', 'AMAZON ELECTRONICS', 'B&H PHOTO']),
        randAmount(rng, 80, 450), 'Electronics');

    // Sports/outdoor (1-2/month)
    const sportsCount = scaleCount(rng, 1, 2, year, month0, startDate, endDate);
    for (let i = 0; i < sportsCount; i++)
      addCC(year, month0, rDay(rng, year, month0),
        pick(rng, ['REI', 'DICKS SPORTING GOODS', 'ONLINE GEAR SHOP']),
        randAmount(rng, 65, 350), 'Sports');

    // SD commute dining (8-12/month)
    const sdDinCount = scaleCount(rng, 8, 12, year, month0, startDate, endDate);
    for (let i = 0; i < sdDinCount; i++)
      addCC(year, month0, rDay(rng, year, month0),
        pick(rng, ['LOCAL SD RESTAURANT', 'CHIPOTLE SD', 'SHAKE SHACK', 'PACIFIC BEACH TACO']),
        randAmount(rng, 12, 28), 'Dining');

    // Family dining (3-4/month)
    const famDinCount = scaleCount(rng, 3, 4, year, month0, startDate, endDate);
    for (let i = 0; i < famDinCount; i++)
      addCC(year, month0, rDay(rng, year, month0),
        pick(rng, ['OLIVE GARDEN', 'CHEESECAKE FACTORY', 'RED ROBIN', 'OUTBACK STEAKHOUSE']),
        randAmount(rng, 45, 95), 'Dining');

    // Starbucks (10-14/month on commute days)
    const sbCount = scaleCount(rng, 10, 14, year, month0, startDate, endDate);
    for (let i = 0; i < sbCount; i++)
      addCC(year, month0, rDay(rng, year, month0), 'STARBUCKS', randAmount(rng, 6, 8), 'Dining');
  });

  return {
    checking: addBalances(checking, getStartBalance('jordan_checking', startDate)),
    cc:       sortTxns(cc),
  };
}

// ---- TAYLOR WILLIAMS ----
// BofA checking (YYYY-MM-DD) | Citi Premier CC (Trans/Post Date)
function generateTaylor(rng, startDate, endDate) {
  const checking = [];
  const cc = [];
  const addC  = makeTxAdder(startDate, endDate, checking);
  const addCC = makeTxAdder(startDate, endDate, cc);

  genMonthLoop(startDate, endDate, (year, month0) => {
    const monthNum = month0 + 1;

    // Rental income (day 1)
    addC(year, month0, 1, 'RENTAL DEPOSIT SD CONDO', 2650.00);

    // Zelle from Jordan (day 3)
    addC(year, month0, 3, 'ZELLE FROM J WILLIAMS', 400.00);

    // Biweekly payroll (25% chance of shift diff bump)
    const pay1 = randInt(rng, 0, 3) === 0 ? randAmount(rng, 2700, 3000) : randAmount(rng, 2500, 2550);
    const pay2 = randInt(rng, 0, 3) === 0 ? randAmount(rng, 2700, 3000) : randAmount(rng, 2500, 2550);
    addC(year, month0, 1  + randInt(rng, 0, 1), 'TEMECULA VALLEY HOSP', pay1);
    addC(year, month0, 15 + randInt(rng, 0, 1), 'TEMECULA VALLEY HOSP', pay2);

    // Fixed bills
    addC(year, month0, 1,  'BOA HOME MORTGAGE',    -2940.00);
    addC(year, month0, 1,  'LITTLE STARS DAYCARE', -1850.00);
    addC(year, month0, 1,  'SOMMERSET HILLS HOA',  -225.00);
    addC(year, month0, 1,  'NORTHWESTERN MUTUAL',  -89.00);
    addC(year, month0, 3,  'BOA RENTAL MORTGAGE',  -2305.00);
    addC(year, month0, 5,  '529 COLLEGE SAVINGS',  -300.00);
    addC(year, month0, 5,  'TRANSFER TO SAVINGS',  -400.00);
    addC(year, month0, 7,  'SCE ELECTRIC',         -randAmount(rng, 145, 195));
    addC(year, month0, 7,  'SOCALGAS',             -randAmount(rng, 55, 95));
    addC(year, month0, 8,  'CITY OF TEMECULA',     -62.00);
    addC(year, month0, 8,  'COX COMMUNICATIONS',   -79.99);
    addC(year, month0, 8,  'VERIZON',              -76.00);
    addC(year, month0, 15, 'STATE FARM HOME',      -147.00);

    // CC payment — same on checking and CC
    const ccPmt = randAmount(rng, 890, 1240);
    addC (year, month0, 12, 'CITI PREMIER PAYMENT', -ccPmt);
    addCC(year, month0, 12, 'CITI PREMIER PAYMENT', -ccPmt, 'Payment');

    // Occasional extra mortgage principal (~25% chance)
    if (randInt(rng, 0, 3) === 0)
      addC(year, month0, rDay(rng, year, month0, 25, 28), 'BOA MORTGAGE EXTRA', -randAmount(rng, 200, 300));

    // Variable checking
    const gasCount = scaleCount(rng, 2, 3, year, month0, startDate, endDate);
    for (let i = 0; i < gasCount; i++)
      addC(year, month0, rDay(rng, year, month0),
        pick(rng, ['CHEVRON', 'SHELL']), -randAmount(rng, 48, 65));

    const pharmCount = scaleCount(rng, 1, 2, year, month0, startDate, endDate);
    for (let i = 0; i < pharmCount; i++)
      addC(year, month0, rDay(rng, year, month0), 'CVS PHARMACY', -randAmount(rng, 12, 38));

    const lilyCount = scaleCount(rng, 1, 2, year, month0, startDate, endDate);
    for (let i = 0; i < lilyCount; i++)
      addC(year, month0, rDay(rng, year, month0),
        pick(rng, ['LITTLE GYM TEMECULA', 'DANCE CLASS TEMECULA']), -randAmount(rng, 89, 145));

    if (randInt(rng, 0, 2) === 0)
      addC(year, month0, rDay(rng, year, month0), 'TEMECULA PEDIATRICS', -randAmount(rng, 25, 45));

    if (randInt(rng, 0, 2) === 0)
      addC(year, month0, rDay(rng, year, month0),
        pick(rng, ['HOME DEPOT', 'LOWES', 'HANDYMAN SERVICES']), -randAmount(rng, 60, 200));

    const famDinCount = scaleCount(rng, 2, 3, year, month0, startDate, endDate);
    for (let i = 0; i < famDinCount; i++)
      addC(year, month0, rDay(rng, year, month0),
        pick(rng, ['CHILIS', 'APPLEBEES', 'OLIVE GARDEN', 'RED LOBSTER']), -randAmount(rng, 38, 78));

    // Citi Premier CC — disciplined, groceries for points
    const grocCount = scaleCount(rng, 4, 6, year, month0, startDate, endDate);
    for (let i = 0; i < grocCount; i++)
      addCC(year, month0, rDay(rng, year, month0),
        pick(rng, ['VONS', 'COSTCO', 'SPROUTS']), randAmount(rng, 85, 267), 'Groceries');

    const ccGasCount = scaleCount(rng, 1, 2, year, month0, startDate, endDate);
    for (let i = 0; i < ccGasCount; i++)
      addCC(year, month0, rDay(rng, year, month0), 'CHEVRON', randAmount(rng, 49, 54), 'Gas');

    const amzCount = scaleCount(rng, 1, 2, year, month0, startDate, endDate);
    for (let i = 0; i < amzCount; i++)
      addCC(year, month0, rDay(rng, year, month0), 'AMAZON.COM', randAmount(rng, 38, 70), 'Shopping');

    if (randInt(rng, 0, 2) === 0)
      addCC(year, month0, rDay(rng, year, month0),
        pick(rng, ['CHILDRENS MUSEUM', 'ACTIVITY CENTER TEMECULA']), randAmount(rng, 18, 35), 'Kids');

    // Anniversary dinner (March)
    if (monthNum === 3)
      addCC(year, month0, rDay(rng, year, month0, 10, 20), 'CHEESECAKE FACTORY', randAmount(rng, 85, 95), 'Dining');
  });

  return {
    checking: addBalances(checking, getStartBalance('taylor_checking', startDate)),
    cc:       sortTxns(cc),
  };
}

// ==================== JSON GENERATION ====================
const PERSONA_FOLDERS = {
  emma:   'emma-rodriguez',
  marcus: 'marcus-chen',
  sarah:  'sarah-mitchell',
  jordan: 'jordan-williams',
  taylor: 'taylor-williams',
};

function loadSeedJSON(personaKey, type, rootDir) {
  const folder = PERSONA_FOLDERS[personaKey];
  const filePath = path.join(rootDir, 'docs', 'test-data', folder, `${personaKey}-${type}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function advanceIncomeJSON(data, runDate) {
  const result = JSON.parse(JSON.stringify(data));
  result.exportedAt = runDate.toISOString();
  return result;
}

function advanceDebtJSON(data, runDate) {
  const result = JSON.parse(JSON.stringify(data));
  result.exportedAt = runDate.toISOString();

  const months = Math.max(0, monthsBetween(BASE_DATE, runDate));
  if (months < 0.1) return result;

  // Advance loan balances using amortization
  for (const loan of (result.loans || [])) {
    const balance = parseFloat(loan.currentBalance) || 0;
    const apr     = parseFloat(loan.interestRate) || 0;
    const payment = parseFloat(loan.monthlyPayment) || 0;
    const monthlyInterest = balance * (apr / 100) / 12;
    const principalPerMonth = Math.max(0, payment - monthlyInterest);
    loan.currentBalance = r2(Math.max(0, balance - principalPerMonth * months)).toFixed(2);
    if (loan.remainingMonths) {
      loan.remainingMonths = String(Math.max(0, parseInt(loan.remainingMonths) - Math.round(months)));
    }
  }

  // Advance card balances using per-persona monthly delta
  const personaKey = Object.keys(PERSONA_FOLDERS).find(k =>
    result.profileId && result.profileId.toLowerCase().includes(k)
  ) || '';
  const delta = CC_MONTHLY_DELTA[personaKey] || 0;
  for (const card of (result.cards || [])) {
    const balance = parseFloat(card.balance) || 0;
    const limit   = parseFloat(card.limit) || 99999;
    const newBal  = Math.max(0, Math.min(limit, balance + delta * months));
    card.balance  = r2(newBal).toFixed(2);
  }

  return result;
}

// ==================== MAIN ====================
const PERSONA_GENERATORS = { emma: generateEmma, marcus: generateMarcus, sarah: generateSarah, jordan: generateJordan, taylor: generateTaylor };

function parseArgs() {
  const args = process.argv.slice(2);
  let mode = 'week', user = 'all', date = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && args[i + 1]) mode = args[++i];
    else if (args[i] === '--user' && args[i + 1]) user = args[++i];
    else if (args[i] === '--date' && args[i + 1]) date = args[++i];
  }
  return { mode, user, date };
}

function main() {
  const { mode, user, date: dateStr } = parseArgs();

  const endDate = dateStr ? parseDate(dateStr) : (() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  })();

  const days = mode === 'month' ? 30 : 7;
  const startDate = addDays(endDate, -(days - 1));

  const personas = user === 'all' ? Object.keys(PERSONA_GENERATORS) : [user];

  if (personas.some(p => !PERSONA_GENERATORS[p])) {
    console.error(`Unknown persona. Valid: ${Object.keys(PERSONA_GENERATORS).join(', ')}`);
    process.exit(1);
  }

  const rootDir = path.join(__dirname, '..');
  const endDateStr = fmtYMD(endDate);
  const outBaseDir = path.join(rootDir, 'docs', 'test-data', 'generated', endDateStr);

  let csvCount = 0, jsonCount = 0;

  for (const persona of personas) {
    const rng    = seededRNG(persona + fmtYMD(startDate));
    const result = PERSONA_GENERATORS[persona](rng, startDate, endDate);

    const outDir = path.join(outBaseDir, persona);
    fs.mkdirSync(outDir, { recursive: true });

    // Write CSVs
    let checkingCSV, ccCSV;
    if (persona === 'marcus') {
      checkingCSV = toWFCheckCSV(result.checking);
      ccCSV       = toCitiCCCSV(result.cc);
    } else if (persona === 'sarah' || persona === 'taylor') {
      checkingCSV = toBofACheckCSV(result.checking);
      ccCSV       = toChaseDiscoverCCCSV(result.cc);
    } else {
      checkingCSV = toChaseCheckCSV(result.checking);
      ccCSV       = toChaseDiscoverCCCSV(result.cc);
    }

    fs.writeFileSync(path.join(outDir, `${persona}-checking.csv`), checkingCSV);
    fs.writeFileSync(path.join(outDir, `${persona}-cc.csv`), ccCSV);
    csvCount += 2;

    // Write JSONs
    const incomeBase = loadSeedJSON(persona, 'income', rootDir);
    const debtBase   = loadSeedJSON(persona, 'debt',   rootDir);

    if (incomeBase) {
      fs.writeFileSync(
        path.join(outDir, `${persona}-income.json`),
        JSON.stringify(advanceIncomeJSON(incomeBase, endDate), null, 2)
      );
      jsonCount++;
    }
    if (debtBase) {
      fs.writeFileSync(
        path.join(outDir, `${persona}-debt.json`),
        JSON.stringify(advanceDebtJSON(debtBase, endDate), null, 2)
      );
      jsonCount++;
    }
  }

  const startDateStr = fmtYMD(startDate);
  console.log('FFP Test Data Generator');
  console.log(`Mode: ${mode} | Date range: ${startDateStr} to ${endDateStr}`);
  console.log(`Generated: ${personas.length} personas | ${csvCount} CSV files | ${jsonCount} JSON files`);
  console.log(`Output: docs/test-data/generated/${endDateStr}/`);
}

main();
