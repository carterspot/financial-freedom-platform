import { useState, useEffect, useRef, useCallback } from "react";

// SpendingTracker v1.10
// ─── Constants ────────────────────────────────────────────────────────────────
const MODULE_PREFIX = "sp_";
const API_URL = "https://ffp-api-proxy.carterspot.workers.dev/";
const MODEL = "claude-sonnet-4-20250514";
const SPLIT_CATEGORY_ID = "cat_split";
const MAX_SPLIT_ITEMS = 8;
const AVATAR_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];
const COLOR = {
  primary:  "#6366f1",
  success:  "#10b981",
  warning:  "#f59e0b",
  danger:   "#ef4444",
  pink:     "#ec4899",
  blue:     "#3b82f6",
  orange:   "#f97316",
  purple:   "#8b5cf6",
  teal:     "#06b6d4",
};
const ACCOUNT_TYPES = ["Checking","Savings","Credit Card","Cash","Other"];
const SCAN_CATEGORIES = ["Groceries","Dining Out","Gas","Shopping","Electronics","Household","Health & Medical","Personal Care","Entertainment","Clothing","Baby & Kids","Pet Care","Subscriptions","Other"];

// ─── Default Categories ───────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  // Income
  { id:"inc_001", name:"Paycheck / Salary",    section:"Income",        icon:"💵", color:"#10b981", isEssential:false },
  { id:"inc_002", name:"Freelance / Side Income", section:"Income",     icon:"💻", color:"#10b981", isEssential:false },
  { id:"inc_003", name:"Investment Income",    section:"Income",        icon:"📈", color:"#10b981", isEssential:false },
  { id:"inc_004", name:"Transfer In",          section:"Income",        icon:"🔄", color:"#10b981", isEssential:false },
  { id:"inc_005", name:"Other Income",         section:"Income",        icon:"💰", color:"#10b981", isEssential:false },
  // Housing
  { id:"exp_001", name:"Rent / Mortgage",      section:"Housing",       icon:"🏠", color:"#6366f1", isEssential:true },
  { id:"exp_002", name:"HOA Fees",             section:"Housing",       icon:"🏘", color:"#6366f1", isEssential:true },
  { id:"exp_003", name:"Home Maintenance",     section:"Housing",       icon:"🔧", color:"#6366f1", isEssential:false },
  { id:"exp_004", name:"Home Insurance",       section:"Housing",       icon:"🛡", color:"#6366f1", isEssential:true },
  { id:"exp_005", name:"Property Tax",         section:"Housing",       icon:"🏛", color:"#6366f1", isEssential:true },
  // Food
  { id:"exp_006", name:"Groceries",            section:"Food",          icon:"🛒", color:"#f97316", isEssential:true },
  { id:"exp_007", name:"Restaurants / Dining", section:"Food",          icon:"🍽", color:"#f97316", isEssential:false },
  { id:"exp_008", name:"Coffee / Cafes",       section:"Food",          icon:"☕", color:"#f97316", isEssential:false },
  { id:"exp_009", name:"Alcohol / Bars",       section:"Food",          icon:"🍺", color:"#f97316", isEssential:false },
  // Transportation
  { id:"exp_010", name:"Gas / Fuel",           section:"Transportation",icon:"⛽", color:"#ec4899", isEssential:true },
  { id:"exp_011", name:"Car Payment",          section:"Transportation",icon:"🚗", color:"#ec4899", isEssential:true },
  { id:"exp_012", name:"Car Insurance",        section:"Transportation",icon:"🛡", color:"#ec4899", isEssential:true },
  { id:"exp_013", name:"Car Maintenance",      section:"Transportation",icon:"🔧", color:"#ec4899", isEssential:false },
  { id:"exp_014", name:"Parking / Tolls",      section:"Transportation",icon:"🅿", color:"#ec4899", isEssential:false },
  { id:"exp_015", name:"Public Transit / Rideshare", section:"Transportation", icon:"🚌", color:"#ec4899", isEssential:false },
  // Utilities
  { id:"exp_016", name:"Electric",             section:"Utilities",     icon:"⚡", color:"#f59e0b", isEssential:true },
  { id:"exp_017", name:"Water / Sewer",        section:"Utilities",     icon:"💧", color:"#f59e0b", isEssential:true },
  { id:"exp_018", name:"Gas / Heat",           section:"Utilities",     icon:"🔥", color:"#f59e0b", isEssential:true },
  { id:"exp_019", name:"Internet",             section:"Utilities",     icon:"📶", color:"#f59e0b", isEssential:true },
  { id:"exp_020", name:"Phone / Mobile",       section:"Utilities",     icon:"📱", color:"#f59e0b", isEssential:true },
  // Health
  { id:"exp_021", name:"Health Insurance",     section:"Health",        icon:"🏥", color:"#06b6d4", isEssential:true },
  { id:"exp_022", name:"Doctor / Medical",     section:"Health",        icon:"👨‍⚕️", color:"#06b6d4", isEssential:true },
  { id:"exp_023", name:"Pharmacy / Rx",        section:"Health",        icon:"💊", color:"#06b6d4", isEssential:true },
  { id:"exp_024", name:"Dental / Vision",      section:"Health",        icon:"🦷", color:"#06b6d4", isEssential:false },
  { id:"exp_025", name:"Gym / Fitness",        section:"Health",        icon:"💪", color:"#06b6d4", isEssential:false },
  // Personal
  { id:"exp_026", name:"Clothing / Apparel",   section:"Personal",      icon:"👕", color:"#8b5cf6", isEssential:false },
  { id:"exp_027", name:"Hair / Grooming",      section:"Personal",      icon:"✂️", color:"#8b5cf6", isEssential:false },
  { id:"exp_028", name:"Personal Care",        section:"Personal",      icon:"🧴", color:"#8b5cf6", isEssential:false },
  { id:"exp_029", name:"Education / Books",    section:"Personal",      icon:"📚", color:"#8b5cf6", isEssential:false },
  // Entertainment
  { id:"exp_030", name:"Streaming Services",   section:"Entertainment", icon:"📺", color:"#3b82f6", isEssential:false },
  { id:"exp_031", name:"Games / Hobbies",      section:"Entertainment", icon:"🎮", color:"#3b82f6", isEssential:false },
  { id:"exp_032", name:"Movies / Events",      section:"Entertainment", icon:"🎬", color:"#3b82f6", isEssential:false },
  { id:"exp_033", name:"Subscriptions",        section:"Entertainment", icon:"🔔", color:"#3b82f6", isEssential:false },
  // Shopping
  { id:"exp_034", name:"Amazon / Online",      section:"Shopping",      icon:"📦", color:"#f43f5e", isEssential:false },
  { id:"exp_035", name:"Electronics",          section:"Shopping",      icon:"💻", color:"#f43f5e", isEssential:false },
  { id:"exp_036", name:"Home Goods",           section:"Shopping",      icon:"🛋", color:"#f43f5e", isEssential:false },
  { id:"exp_037", name:"Gifts",                section:"Shopping",      icon:"🎁", color:"#f43f5e", isEssential:false },
  // Giving
  { id:"exp_038", name:"Charitable Giving",    section:"Giving",        icon:"❤️", color:"#ef4444", isEssential:false },
  { id:"exp_039", name:"Church / Tithe",       section:"Giving",        icon:"⛪", color:"#ef4444", isEssential:false },
  { id:"exp_040", name:"Family Support",       section:"Giving",        icon:"👨‍👩‍👧", color:"#ef4444", isEssential:false },
  // Savings
  { id:"exp_041", name:"Emergency Fund",       section:"Savings",       icon:"🏦", color:"#10b981", isEssential:false },
  { id:"exp_042", name:"Sinking Fund",         section:"Savings",       icon:"🪣", color:"#10b981", isEssential:false },
  { id:"exp_043", name:"Investment / Brokerage",section:"Savings",      icon:"📊", color:"#10b981", isEssential:false },
  { id:"exp_044", name:"Retirement (401k/IRA)",section:"Savings",       icon:"🏖", color:"#10b981", isEssential:false },
  // Debt Payments
  { id:"exp_045", name:"Credit Card Payment",  section:"Debt Payments", icon:"💳", color:"#ef4444", isEssential:true },
  { id:"exp_046", name:"Student Loan",         section:"Debt Payments", icon:"🎓", color:"#ef4444", isEssential:true },
  { id:"exp_047", name:"Personal Loan",        section:"Debt Payments", icon:"🏦", color:"#ef4444", isEssential:true },
  // Kids
  { id:"exp_048", name:"Childcare / Daycare",  section:"Kids",          icon:"👶", color:"#ec4899", isEssential:true },
  { id:"exp_049", name:"School / Tuition",     section:"Kids",          icon:"🏫", color:"#ec4899", isEssential:true },
  { id:"exp_050", name:"Kids Activities",      section:"Kids",          icon:"⚽", color:"#ec4899", isEssential:false },
  { id:"exp_051", name:"Baby Supplies",        section:"Kids",          icon:"🧸", color:"#ec4899", isEssential:true },
  // Travel
  { id:"exp_052", name:"Flights",              section:"Travel",        icon:"✈️", color:"#06b6d4", isEssential:false },
  { id:"exp_053", name:"Hotels / Lodging",     section:"Travel",        icon:"🏨", color:"#06b6d4", isEssential:false },
  { id:"exp_054", name:"Vacation / Travel",    section:"Travel",        icon:"🏝", color:"#06b6d4", isEssential:false },
  // Business
  { id:"exp_055", name:"Business Expense",     section:"Business",      icon:"💼", color:"#8b5cf6", isEssential:false },
  { id:"exp_056", name:"Software / Tools",     section:"Business",      icon:"🛠", color:"#8b5cf6", isEssential:false },
  // Misc
  { id:"exp_057", name:"Uncategorized",        section:"Misc",          icon:"❓", color:"#94a3b8", isEssential:false },
  { id:"trn_001", name:"Transfer",             section:"Transfer",      icon:"↔️", color:"#94a3b8", type:"both", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:57, isEssential:false },
];

// IDs treated as essential cost-of-living — used by migration + baseline
const ESSENTIAL_IDS = new Set([
  "exp_001","exp_002","exp_004","exp_005","exp_006",
  "exp_010","exp_011","exp_012","exp_016","exp_017",
  "exp_018","exp_019","exp_020","exp_021","exp_022",
  "exp_023","exp_045","exp_046","exp_047","exp_048",
  "exp_049","exp_051"
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const fmt$ = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);

function parseCSVLine(line) {
  const result = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(l => parseCSVLine(l));
  return { headers, rows };
}

function parseAmount(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/[$,\s]/g,"").replace(/\((.+)\)/,"$1");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function normalizeDate(str) {
  if (!str) return null;
  str = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const mdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,"0")}-${mdy[2].padStart(2,"0")}`;
  const mdy2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdy2) {
    const yr = parseInt(mdy2[3]) >= 50 ? "19"+mdy2[3] : "20"+mdy2[3];
    return `${yr}-${mdy2[1].padStart(2,"0")}-${mdy2[2].padStart(2,"0")}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
  return null;
}

function autoDetectColumns(headers) {
  const lc = headers.map(h => h.toLowerCase());
  const find = (...keys) => {
    for (const k of keys) {
      const i = lc.findIndex(h => h.includes(k));
      if (i !== -1) return headers[i];
    }
    return null;
  };
  return {
    date:        find("date","posted","transaction date","trans date"),
    description: find("description","desc","merchant","memo","name","payee"),
    amount:      find("amount","debit","credit","transaction","charge"),
    debit:       find("debit"),
    credit:      find("credit"),
    category:    find("category","type"),
  };
}

function applyRules(description, rules) {
  if (!rules || !rules.length) return null;
  const sorted = [...rules].sort((a,b) => (a.priority||0)-(b.priority||0));
  const d = description.toLowerCase();
  for (const r of sorted) {
    const kw = (r.keyword||"").toLowerCase();
    if (!kw) continue;
    if (r.matchType === "exact" && d === kw) return r;
    if (r.matchType === "startsWith" && d.startsWith(kw)) return r;
    if ((!r.matchType || r.matchType === "contains") && d.includes(kw)) return r;
  }
  return null;
}

function currentYYYYMM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function prevMonth(ym) {
  const [y,m] = ym.split("-").map(Number);
  const d = new Date(y, m-2, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function nextMonth(ym) {
  const [y,m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function getMonthLabel(ym) {
  const [y,m] = ym.split("-").map(Number);
  return new Date(y,m-1,1).toLocaleString("en-US",{month:"long",year:"numeric"});
}

// Split-aware category accumulator. Hoisted so SummaryTab + TrendsTab share one rule:
// a split parent contributes only through its children; the sentinel SPLIT_CATEGORY_ID
// must never land in a bucket.
function accumulateTx(tx, buckets) {
  if (tx.isSplit && tx.splits && tx.splits.length) {
    for (const s of tx.splits) {
      const cid = s.categoryId || "exp_057";
      if (cid === SPLIT_CATEGORY_ID) continue;
      buckets[cid] = (buckets[cid] || 0) + Math.abs(parseFloat(s.amount) || 0);
    }
  } else {
    const cid = tx.categoryId || "exp_057";
    if (cid === SPLIT_CATEGORY_ID) return;
    buckets[cid] = (buckets[cid] || 0) + Math.abs(tx.amount);
  }
}

// Sum a split's children that match categoryId.
function splitChildSum(tx, categoryId) {
  if (!tx.isSplit || !tx.splits || !tx.splits.length) return 0;
  let s = 0;
  for (const item of tx.splits) {
    if ((item.categoryId || "exp_057") === categoryId) s += Math.abs(parseFloat(item.amount) || 0);
  }
  return s;
}

function computeRollingAvg(transactions, categoryId, selectedMonth, months) {
  months = months || 3;
  let totals = [];
  let cur = selectedMonth;
  for (let i = 0; i < months; i++) {
    cur = prevMonth(cur);
    const total = transactions
      .filter(t => {
        if (!t.date || !t.date.startsWith(cur) || !(t.amount < 0)) return false;
        if (t.isSplit && t.splits && t.splits.length) return t.splits.some(s => (s.categoryId || "exp_057") === categoryId);
        return t.categoryId === categoryId;
      })
      .reduce((s, t) => {
        if (t.isSplit && t.splits && t.splits.length) return s + splitChildSum(t, categoryId);
        return s + Math.abs(t.amount);
      }, 0);
    totals.push(total);
  }
  const sum = totals.reduce((a,b) => a+b, 0);
  return sum / months;
}

function computeRollingAvgIncome(transactions, categoryId, selectedMonth, months) {
  months = months || 3;
  let totals = [];
  let cur = selectedMonth;
  for (let i = 0; i < months; i++) {
    cur = prevMonth(cur);
    const total = transactions
      .filter(t => {
        if (!t.date || !t.date.startsWith(cur) || !(t.amount > 0)) return false;
        if (t.isSplit && t.splits && t.splits.length) return t.splits.some(s => (s.categoryId || "exp_057") === categoryId);
        return t.categoryId === categoryId;
      })
      .reduce((s, t) => {
        if (t.isSplit && t.splits && t.splits.length) return s + splitChildSum(t, categoryId);
        return s + t.amount;
      }, 0);
    totals.push(total);
  }
  return totals.reduce((a, b) => a + b, 0) / months;
}

function computeBaseline(transactions, categories) {
  const essentialIds = new Set(categories.filter(c => c.isEssential).map(c => c.id));
  const now = new Date();
  const months = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }
  const catTotals = {};
  for (const tx of transactions) {
    if (!tx.date || !tx.categoryId) continue;
    if (!essentialIds.has(tx.categoryId)) continue;
    if (tx.amount >= 0) continue;
    const m = tx.date.slice(0,7);
    if (!months.includes(m)) continue;
    catTotals[tx.categoryId] = (catTotals[tx.categoryId] || 0) + Math.abs(tx.amount);
  }
  const breakdown = [];
  for (const [catId, total] of Object.entries(catTotals)) {
    const cat = categories.find(c => c.id === catId);
    if (!cat) continue;
    breakdown.push({ catId, catName: cat.name, icon: cat.icon, color: cat.color, avg: total / 3 });
  }
  breakdown.sort((a, b) => b.avg - a.avg);
  const amount = breakdown.reduce((s, c) => s + c.avg, 0);
  return { amount, breakdown, calculatedOn: new Date().toISOString(), monthsUsed: months };
}

// ─── Range helpers ────────────────────────────────────────────────────────────
function getMonthsInRange(start, end) {
  const months = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 120) { months.push(cur); cur = nextMonth(cur); guard++; }
  return months;
}

function txInRange(tx, range) {
  if (!tx.date) return false;
  if (range.mode === "month") return tx.date.startsWith(range.month);
  const m = tx.date.slice(0,7);
  return m >= range.start && m <= range.end;
}

function defaultRange() {
  const m = currentYYYYMM();
  return { mode:"month", month:m, start:m, end:m };
}

function rangeLabel(range) {
  if (range.mode === "month") return getMonthLabel(range.month);
  if (range.start === range.end) return getMonthLabel(range.start);
  return `${getMonthLabel(range.start)} — ${getMonthLabel(range.end)}`;
}

// ─── Theme ───────────────────────────────────────────────────────────────────
function useTheme(dm) {
  return {
    bg:      dm ? "#020617" : "#f1f5f9",
    panelBg: dm ? "#0f172a" : "#ffffff",
    surf:    dm ? "#1e293b" : "#f1f5f9",
    deepBg:  dm ? "#0a0f1e" : "#ffffff",
    border:  dm ? "#1e293b" : "#e2e8f0",
    border2: dm ? "#334155" : "#cbd5e1",
    tx1:     dm ? "#f1f5f9" : "#0f172a",
    tx2:     dm ? "#94a3b8" : "#64748b",
    tx3:     dm ? "#475569" : "#94a3b8",
  };
}

// ─── Responsive ───────────────────────────────────────────────────────────────
function useBreakpoint() {
  const [w, setW] = useState(960);
  useEffect(() => {
    const fn = () => setW(typeof window !== 'undefined' ? window.innerWidth : 960);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 640, isTablet: w < 960, isDesktop: w >= 960 };
}

// ─── Storage ──────────────────────────────────────────────────────────────────
let _cloudAvailable = null;
async function probeCloudStorage() {
  if (_cloudAvailable !== null) return _cloudAvailable;
  if (!window?.storage?.get) { _cloudAvailable = false; return false; }
  try {
    await Promise.race([
      window.storage.get("__probe__", false),
      new Promise((_,r) => setTimeout(() => r(new Error("timeout")), 2500))
    ]);
    _cloudAvailable = true;
  } catch { _cloudAvailable = false; }
  return _cloudAvailable;
}
async function storeGet(key, shared=false) {
  if (await probeCloudStorage()) {
    try { const r = await window.storage.get(key, shared); return r ? JSON.parse(r.value) : null; }
    catch { _cloudAvailable = false; }
  }
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function storeSet(key, value, shared=false) {
  if (await probeCloudStorage()) {
    try { await window.storage.set(key, JSON.stringify(value), shared); return; }
    catch { _cloudAvailable = false; }
  }
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
const hasCloudStorage = () => _cloudAvailable === true;

// ─── AI ───────────────────────────────────────────────────────────────────────
async function callClaude(apiKey, body) {
  const headers = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  if (apiKey?.trim()) headers["x-api-key"] = apiKey.trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res;
  } catch(e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

function aiErrorMsg(e) {
  if (e.name === "AbortError")       return "Request timed out — check your connection and retry.";
  if (e.message.includes("401"))     return "Invalid API key — update your key via the key button in the nav bar.";
  if (e.message.includes("429"))     return "Rate limited — wait a moment and try again.";
  if (e.message.includes("500"))     return "Anthropic API error — try again shortly.";
  return `AI unavailable (${e.message}) — try again.`;
}

async function probeApiKey(key) {
  try {
    const res = await fetch(API_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":key},
      body:JSON.stringify({ model:MODEL, max_tokens:1, messages:[{role:"user",content:"hi"}] }),
      signal:AbortSignal.timeout(8000),
    });
    return res.status === 200 ? "valid" : res.status === 401 ? "invalid" : "limited";
  } catch { return "unknown"; }
}

// ─── Receipt Scan Helpers ─────────────────────────────────────────────────────
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

async function extractReceiptsFromImage(apiKey, base64, mediaType) {
  const body = {
    model: MODEL,
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
        { type: "text", text: `Extract all receipts visible in this image. For each receipt found return:
- merchant: store or restaurant name (string)
- date: purchase date in YYYY-MM-DD format (string; use today's date if unclear)
- total: final charged total as a number (include tax, exclude tip if tip is handwritten separately)
- items: array of line items, each with:
  - description: item name (string)
  - amount: item price as a number
  - suggestedCategory: best match from this list only — Groceries, Dining Out, Gas, Shopping, Electronics, Household, Health & Medical, Personal Care, Entertainment, Clothing, Baby & Kids, Pet Care, Subscriptions, Other

Return ONLY a JSON object in this exact shape: {"receipts": [...]}
If no receipt is found, return: {"receipts": []}
No explanation. No markdown. JSON only.` }
      ]
    }]
  };
  const res = await callClaude(apiKey, body);
  const data = await res.json();
  const raw = data.content?.[0]?.text || '{"receipts":[]}';
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.receipts) ? parsed.receipts : [];
  } catch { return []; }
}

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

// ─── Post-hoc Reconciliation Helpers (v1.10-P2) ───────────────────────────────
function pairKeyFor(idA, idB) {
  return [idA, idB].sort().join(':');
}

function describeSimilarity(a, b) {
  const tokA = new Set((a || '').toLowerCase().split(/\s+/).filter(Boolean));
  const tokB = new Set((b || '').toLowerCase().split(/\s+/).filter(Boolean));
  if (!tokA.size || !tokB.size) return 0;
  let inter = 0;
  tokA.forEach(tok => { if (tokB.has(tok)) inter++; });
  return inter / (tokA.size + tokB.size - inter);
}

function findDuplicatePairs(transactions, dismissedPairs) {
  const dismissedSet = new Set((dismissedPairs || []).map(d => d.pairKey));
  const buckets = new Map();
  for (const tx of transactions || []) {
    if (!tx || !tx.id || tx.amount == null || !tx.date) continue;
    const key = Math.abs(parseFloat(tx.amount) || 0).toFixed(2);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(tx);
  }
  const pairs = [];
  const seen = new Set();
  for (const group of buckets.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        if (a.id === b.id) continue;
        const pk = pairKeyFor(a.id, b.id);
        if (seen.has(pk) || dismissedSet.has(pk)) continue;
        if ((a.reconciled && a.reconciledWith === b.id) ||
            (b.reconciled && b.reconciledWith === a.id)) continue;
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (!isFinite(da) || !isFinite(db)) continue;
        const dayDelta = Math.round(Math.abs((da - db) / 86400000));
        if (dayDelta > 3) continue;
        const score = describeSimilarity(a.description, b.description);
        const noDesc = !(a.description || '').trim() && !(b.description || '').trim();
        if (score < 0.5 && !(noDesc && dayDelta === 0)) continue;
        let reason;
        if (noDesc && dayDelta === 0) reason = "Same amount, same day, no description";
        else if (score >= 0.999) reason = "Same amount, identical description";
        else if (dayDelta === 0 && score >= 0.7) reason = "Same amount, same day, similar description";
        else if (dayDelta === 0) reason = "Same amount, same day";
        else reason = `Same amount, ${dayDelta} day${dayDelta === 1 ? '' : 's'} apart`;
        pairs.push({ a, b, score, reason, pairKey: pk });
        seen.add(pk);
      }
    }
  }
  return pairs;
}

// ─── ProfileDropdown ──────────────────────────────────────────────────────────
function ProfileDropdown({ t, profiles, activeProfile, onSwitch, onClose, onEditProfile }) {
  return (
    <div style={{ position:"absolute",top:"calc(100% + 6px)",right:0,background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,boxShadow:"0 8px 32px rgba(0,0,0,.3)",minWidth:200,zIndex:300,overflow:"hidden" }}>
      <div style={{ padding:"8px 14px 6px",borderBottom:`1px solid ${t.border}` }}>
        <span style={{ fontSize:11,fontWeight:600,color:t.tx3 }}>SWITCH PROFILE</span>
      </div>
      {profiles.map(p => (
        <div key={p.id} onClick={() => onSwitch(p)}
          style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",background:p.id===activeProfile?.id?COLOR.primary+"18":"transparent",borderBottom:`1px solid ${t.border}`,transition:"background .15s" }}>
          <div style={{ width:28,height:28,borderRadius:"50%",background:p.avatarColor||COLOR.primary,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0 }}>
            {(p.name||"?").charAt(0).toUpperCase()}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700,fontSize:13,color:t.tx1 }}>{p.name}</div>
            {p.id===activeProfile?.id && <div style={{ fontSize:10,color:COLOR.primary,fontWeight:600 }}>Active</div>}
          </div>
          {p.id===activeProfile?.id && (
            <div style={{ display:"flex",alignItems:"center",gap:6 }}>
              <span style={{ fontSize:14,color:COLOR.primary }}>✓</span>
              <button onClick={e => { e.stopPropagation(); onClose(); onEditProfile && onEditProfile(p); }}
                style={{ background:"transparent",border:`1px solid ${t.border}`,borderRadius:6,padding:"2px 7px",color:t.tx2,cursor:"pointer",fontSize:12,lineHeight:1 }}>✏</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
function ConfirmModal({ t, message, onConfirm, onCancel }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:t.panelBg,borderRadius:20,width:"100%",maxWidth:360,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ fontSize:15,color:t.tx1,marginBottom:20,lineHeight:1.5 }}>{message}</div>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onCancel} style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex:1,background:COLOR.danger,border:"none",borderRadius:10,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14 }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── ApiKeyModal ───────────────────────────────────────────────────────────────
function ApiKeyModal({ t, apiKey, onSave, onClose }) {
  const [val, setVal] = useState(apiKey||"");
  const [show, setShow] = useState(false);
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:t.panelBg,borderRadius:20,width:"100%",maxWidth:440,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ fontWeight:800,fontSize:17,color:t.tx1,marginBottom:4 }}>Anthropic API Key</div>
        <div style={{ fontSize:13,color:t.tx2,marginBottom:16 }}>Required for AI categorization and rule suggestions.</div>
        <label style={{ fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600 }}>API KEY</label>
        <div style={{ display:"flex",gap:8,marginBottom:16 }}>
          <input
            type={show ? "text" : "password"}
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder="sk-ant-..."
            style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx1,fontSize:13,boxSizing:"border-box" }}
          />
          <button onClick={() => setShow(s => !s)} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 12px",color:t.tx2,cursor:"pointer",fontSize:12 }}>{show ? "🙈" : "👁"}</button>
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Cancel</button>
          <button onClick={() => onSave(val.trim())} style={{ flex:1,background:COLOR.primary,border:"none",borderRadius:10,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── BackupModal ───────────────────────────────────────────────────────────────
function BackupModal({ t, transactions, accounts, categories, onClose, onImport, onOpenImport }) {
  const [tab, setTab] = useState("export");
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileRef = useRef(null);

  function exportJSON() {
    const data = { transactions, accounts, categories, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `spending-backup-${currentYYYYMM()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function exportCSV() {
    const catMap = Object.fromEntries((categories||[]).map(c => [c.id, c.name]));
    const accMap = Object.fromEntries((accounts||[]).map(a => [a.id, a.nickname]));
    const header = "date,description,amount,category,account,notes";
    const rows = (transactions||[]).map(t2 => {
      const isSplit = t2.isSplit && Array.isArray(t2.splits) && t2.splits.length > 0;
      const categoryCell = isSplit ? "Split" : (catMap[t2.categoryId] || "");
      let notesVal = t2.notes || "";
      if (isSplit) {
        const parts = t2.splits.map(s => `${catMap[s.categoryId] || "Uncategorized"} $${(Math.abs(parseFloat(s.amount) || 0)).toFixed(2)}`).join(" / ");
        notesVal = (notesVal ? notesVal + " " : "") + `[Split: ${parts}]`;
      }
      return [t2.date, `"${(t2.description||"").replace(/"/g,'""')}"`, t2.amount, categoryCell, accMap[t2.accountId]||"", `"${notesVal.replace(/"/g,'""')}"`].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `spending-transactions-${currentYYYYMM()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImportText(ev.target.result);
    reader.readAsText(file);
  }

  function doImport() {
    try {
      const data = JSON.parse(importText);
      if (!Array.isArray(data.transactions)) {
        setImportStatus("Invalid backup: missing transactions array.");
        return;
      }
      onImport(data);
      setImportStatus("✅ Import successful!");
      setShowConfirm(false);
    } catch {
      setImportStatus("Invalid JSON — check your file and try again.");
    }
  }

  const tabBtn = (active) => ({
    background: active ? COLOR.primary : t.surf,
    color: active ? "#fff" : t.tx2,
    border: `1px solid ${active ? COLOR.primary : t.border}`,
    borderRadius: 8, padding: "7px 20px", cursor: "pointer", fontWeight: 600, fontSize: 13,
  });

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:t.panelBg,borderRadius:20,width:"100%",maxWidth:420,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontWeight:800,fontSize:17,color:t.tx1 }}>Backup & Restore</div>
          <button onClick={onClose} style={{ background:"transparent",border:`1px solid ${t.border}`,borderRadius:6,color:t.tx3,cursor:"pointer",fontSize:16,padding:"2px 9px",lineHeight:1 }}>×</button>
        </div>
        <div style={{ display:"flex",gap:6,marginBottom:16 }}>
          <button style={tabBtn(tab==="export")} onClick={() => setTab("export")}>Export</button>
          <button style={tabBtn(tab==="import")} onClick={() => setTab("import")}>Import</button>
        </div>
        {tab === "export" && (
          <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:16 }}>
            <button onClick={exportJSON} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"11px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:14 }}>
              📦 Full Backup (JSON)
            </button>
            <button onClick={exportCSV} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"11px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:14 }}>
              📄 Export Transactions (CSV)
            </button>
          </div>
        )}
        {tab === "import" && (
          <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:16 }}>
            <input ref={fileRef} type="file" accept=".json" style={{ display:"none" }} onChange={handleFileSelect} />
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={() => fileRef.current.click()} style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"11px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>
                📂 Restore Backup
              </button>
              <button onClick={() => { onClose(); onOpenImport && onOpenImport(); }} style={{ flex:1,background:COLOR.primary,border:"none",borderRadius:10,padding:"11px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13 }}>
                📥 Import Transactions
              </button>
            </div>
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder="Or paste JSON backup here…"
              rows={5}
              style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx1,fontSize:12,fontFamily:"monospace",resize:"vertical",boxSizing:"border-box",width:"100%" }}
            />
            {importStatus && <div style={{ fontSize:12,color:importStatus.startsWith("✅")?COLOR.success:COLOR.danger }}>{importStatus}</div>}
            <button
              onClick={() => { if (!importText.trim()) return; setImportStatus(null); setShowConfirm(true); }}
              style={{ background:COLOR.primary,border:"none",borderRadius:10,padding:"11px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14 }}>
              Import & Replace
            </button>
          </div>
        )}
        <button onClick={onClose} style={{ width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Close</button>
      </div>
      {showConfirm && (
        <ConfirmModal t={t}
          message="This will replace all transactions and accounts with the imported data. This cannot be undone."
          onConfirm={doImport}
          onCancel={() => setShowConfirm(false)} />
      )}
    </div>
  );
}

// ─── CategoryPill ─────────────────────────────────────────────────────────────
function CategoryPill({ category }) {
  if (!category) return <span style={{ fontSize:11,color:"#94a3b8" }}>Uncategorized</span>;
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:3,fontSize:11,fontWeight:600,color:category.color||COLOR.primary,background:(category.color||COLOR.primary)+"18",border:`1px solid ${(category.color||COLOR.primary)}33`,borderRadius:6,padding:"2px 7px" }}>
      {category.icon} {category.name}
    </span>
  );
}

// ─── MonthSelector ────────────────────────────────────────────────────────────
function MonthSelector({ t, month, onChange }) {
  return (
    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
      <button onClick={() => onChange(prevMonth(month))} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 11px",color:t.tx1,cursor:"pointer",fontSize:14 }}>‹</button>
      <span style={{ fontWeight:700,fontSize:14,color:t.tx1,minWidth:140,textAlign:"center" }}>{getMonthLabel(month)}</span>
      <button onClick={() => onChange(nextMonth(month))} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 11px",color:t.tx1,cursor:"pointer",fontSize:14 }}>›</button>
    </div>
  );
}

// ─── DateRangeSelector ────────────────────────────────────────────────────────
function DateRangeSelector({ t, range, onChange }) {
  const modeBtn = (active) => ({
    background: active ? COLOR.primary : t.surf,
    color: active ? "#fff" : t.tx2,
    border: `1px solid ${active ? COLOR.primary : t.border}`,
    borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600, fontSize: 11,
  });

  function switchToRange() {
    const cur = range.month || currentYYYYMM();
    onChange({ mode:"range", month:cur, start: prevMonth(prevMonth(cur)), end:cur });
  }

  function switchToMonth() {
    const m = range.start || range.month || currentYYYYMM();
    onChange({ mode:"month", month:m, start:m, end:m });
  }

  if (range.mode === "month") {
    const m = range.month;
    return (
      <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
        <div style={{ display:"flex",gap:2 }}>
          <button style={modeBtn(true)}>Month</button>
          <button style={modeBtn(false)} onClick={switchToRange}>Range</button>
        </div>
        <button onClick={() => { const p=prevMonth(m); onChange({ mode:"month",month:p,start:p,end:p }); }} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 11px",color:t.tx1,cursor:"pointer",fontSize:14 }}>‹</button>
        <span style={{ fontWeight:700,fontSize:14,color:t.tx1,minWidth:140,textAlign:"center" }}>{getMonthLabel(m)}</span>
        <button onClick={() => { const n=nextMonth(m); onChange({ mode:"month",month:n,start:n,end:n }); }} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 11px",color:t.tx1,cursor:"pointer",fontSize:14 }}>›</button>
      </div>
    );
  }

  return (
    <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
      <div style={{ display:"flex",gap:2 }}>
        <button style={modeBtn(false)} onClick={switchToMonth}>Month</button>
        <button style={modeBtn(true)}>Range</button>
      </div>
      <div style={{ display:"flex",alignItems:"center",gap:4 }}>
        <input type="month" value={range.start} onChange={e => onChange({ ...range, start:e.target.value })}
          style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"5px 8px",color:t.tx1,fontSize:13 }} />
        <span style={{ color:t.tx2,fontSize:13 }}>—</span>
        <input type="month" value={range.end} onChange={e => onChange({ ...range, end:e.target.value })}
          style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"5px 8px",color:t.tx1,fontSize:13 }} />
      </div>
      <span style={{ fontWeight:600,fontSize:13,color:t.tx2 }}>{rangeLabel(range)}</span>
    </div>
  );
}

// ─── CategoryMultiSelect ──────────────────────────────────────────────────────
function CategoryMultiSelect({ t, categories, selectedIds, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function handleOut(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handleOut);
    return () => document.removeEventListener("mousedown", handleOut);
  }, []);
  const count = selectedIds.length;
  const label = count === 0 ? "All categories" : `${count} categor${count===1?"y":"ies"}`;
  function toggle(id) {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  }
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{ background:t.surf,border:`1px solid ${count>0?COLOR.primary:t.border}`,borderRadius:8,padding:"7px 10px",color:count>0?COLOR.primary:t.tx1,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap" }}>
        {label}
        {count > 0 && <span style={{ background:COLOR.primary,color:"#fff",borderRadius:10,padding:"0 6px",fontSize:10,fontWeight:700 }}>{count}</span>}
        <span style={{ fontSize:10,color:t.tx3 }}>▾</span>
      </button>
      {open && (
        <div style={{ position:"absolute",top:"calc(100% + 4px)",left:0,background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:12,boxShadow:"0 8px 24px rgba(0,0,0,.25)",zIndex:200,minWidth:220,maxHeight:280,overflowY:"auto" }}>
          <div onClick={() => { onChange([]); setOpen(false); }} style={{ padding:"8px 12px",borderBottom:`1px solid ${t.border}`,fontSize:12,color:count===0?COLOR.primary:t.tx2,cursor:"pointer",fontWeight:600 }}>
            ✓ All categories
          </div>
          {categories.map(c => (
            <div key={c.id} onClick={() => toggle(c.id)} style={{ display:"flex",alignItems:"center",gap:8,padding:"7px 12px",cursor:"pointer",background:selectedIds.includes(c.id)?COLOR.primary+"15":"transparent",borderBottom:`1px solid ${t.border}` }}>
              <input type="checkbox" readOnly checked={selectedIds.includes(c.id)} style={{ accentColor:COLOR.primary,width:13,height:13,flexShrink:0,pointerEvents:"none" }} />
              <span style={{ fontSize:12,color:t.tx1 }}>{c.icon} {c.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CategoryBarRow ───────────────────────────────────────────────────────────
function CategoryBarRow({ t, cat, value, avg, barBase, isIncome, onClick }) {
  const [hovered, setHovered] = useState(false);
  const barColor = cat?.color || (isIncome ? COLOR.success : COLOR.danger);
  const fillPct  = barBase > 0 ? Math.min((value / barBase) * 100, 100) : 0;
  const avgPct   = barBase > 0 ? Math.min((avg   / barBase) * 100, 100) : 0;
  let deltaColor = COLOR.success;
  let deltaLabel = "—";
  if (avg > 0) {
    const delta = (value - avg) / avg;
    if (!isIncome) {
      if (delta > 0.25) deltaColor = COLOR.danger;
      else if (delta > 0) deltaColor = COLOR.warning;
      else deltaColor = COLOR.success;
    } else {
      deltaColor = delta >= 0 ? COLOR.success : COLOR.warning;
    }
    deltaLabel = (delta >= 0 ? "+" : "") + Math.round(delta * 100) + "%";
  }
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 16px",borderBottom:`1px solid ${t.border}`,cursor:"pointer",background:hovered?t.surf:"transparent",transition:"background .12s" }}>
      <div style={{ width:155,flexShrink:0 }}><CategoryPill category={cat} /></div>
      <div style={{ flex:1,position:"relative",height:14,background:t.border,borderRadius:3 }}>
        <div style={{ position:"absolute",left:0,top:0,height:"100%",width:`${fillPct}%`,background:barColor+"bb",borderRadius:3 }} />
        {avg > 0 && (
          <div style={{ position:"absolute",top:-3,height:"calc(100% + 6px)",width:2.5,background:COLOR.primary,left:`${Math.min(avgPct,100)}%`,transform:"translateX(-50%)",borderRadius:1,zIndex:2 }} />
        )}
      </div>
      <div style={{ width:100,textAlign:"right",flexShrink:0 }}>
        <div style={{ fontFamily:"monospace",fontSize:13,fontWeight:700,color:isIncome?COLOR.success:COLOR.danger }}>{fmt$(value)}</div>
        <div style={{ fontSize:10,fontWeight:700,color:deltaColor }}>{deltaLabel}</div>
      </div>
    </div>
  );
}

// ─── AccountModal ─────────────────────────────────────────────────────────────
function AccountModal({ t, account, onSave, onClose, onSaveAndImport }) {
  const [nickname, setNickname] = useState(account?.nickname||"");
  const [type, setType]         = useState(account?.type||"Checking");
  const [color, setColor]       = useState(account?.color||AVATAR_COLORS[0]);
  const [flipSign, setFlipSign] = useState(account?.flipSign||false);

  function handleSave() {
    if (!nickname.trim()) return;
    onSave({ ...(account||{}), id: account?.id||generateId(), nickname:nickname.trim(), type, color, flipSign, columnMap: account?.columnMap||{} });
  }

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2100,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:t.panelBg,borderRadius:20,width:"100%",maxWidth:440,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ fontWeight:800,fontSize:17,color:t.tx1,marginBottom:16 }}>{account ? "Edit Account" : "Add Account"}</div>
        <label style={{ fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600 }}>ACCOUNT NICKNAME</label>
        <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="e.g. Chase Checking" style={{ width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx1,fontSize:13,boxSizing:"border-box",marginBottom:12 }} />
        <label style={{ fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600 }}>ACCOUNT TYPE</label>
        <select value={type} onChange={e => setType(e.target.value)} style={{ width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx1,fontSize:13,boxSizing:"border-box",marginBottom:12 }}>
          {ACCOUNT_TYPES.map(tp => <option key={tp}>{tp}</option>)}
        </select>
        <label style={{ fontSize:11,color:t.tx2,display:"block",marginBottom:8,fontWeight:600 }}>COLOR</label>
        <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" }}>
          {AVATAR_COLORS.map(c => (
            <div key={c} onClick={() => setColor(c)} style={{ width:24,height:24,borderRadius:"50%",background:c,cursor:"pointer",border:color===c?"3px solid #fff":"2px solid transparent",boxSizing:"border-box" }} />
          ))}
        </div>
        <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:16 }}>
          <input type="checkbox" checked={flipSign} onChange={e => setFlipSign(e.target.checked)} style={{ width:16,height:16,accentColor:COLOR.primary }} />
          <span style={{ fontSize:13,color:t.tx1 }}>Flip sign on import (for credit card statements where charges are positive)</span>
        </label>
        <div style={{ display:"flex",gap:10,marginBottom: onSaveAndImport ? 8 : 0 }}>
          <button onClick={onClose} style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} style={{ flex:1,background:COLOR.primary,border:"none",borderRadius:10,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14 }}>Save</button>
        </div>
        {onSaveAndImport && (
          <button onClick={() => {
            if (!nickname.trim()) return;
            const acc = { ...(account||{}), id: account?.id||generateId(), nickname:nickname.trim(), type, color, flipSign, columnMap: account?.columnMap||{} };
            onSaveAndImport(acc);
          }} style={{ width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>
            📥 Save & Import Transactions
          </button>
        )}
      </div>
    </div>
  );
}

// ─── AccountsModal ────────────────────────────────────────────────────────────
function AccountsModal({ t, accounts, onSave, onClose, onSaveAndImport }) {
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  function handleDelete(id) { setConfirm(id); }
  function doDelete(id) { onSave(accounts.filter(a => a.id !== id)); setConfirm(null); }
  function handleSaveAccount(acc) {
    const idx = accounts.findIndex(a => a.id === acc.id);
    if (idx >= 0) {
      const next = [...accounts]; next[idx] = acc; onSave(next);
    } else {
      onSave([...accounts, acc]);
    }
    setEditing(null);
  }

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:t.panelBg,borderRadius:20,width:"100%",maxWidth:480,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontWeight:800,fontSize:17,color:t.tx1 }}>Accounts</div>
          <button onClick={() => setEditing({})} style={{ background:COLOR.primary,border:"none",borderRadius:8,padding:"7px 14px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13 }}>+ Add</button>
        </div>
        {accounts.length === 0 && (
          <div style={{ textAlign:"center",padding:"20px 0",color:t.tx2,fontSize:13 }}>No accounts yet. Add one to get started.</div>
        )}
        <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:16 }}>
          {accounts.map(a => (
            <div key={a.id} style={{ display:"flex",alignItems:"center",gap:12,background:t.surf,borderRadius:10,padding:"10px 14px" }}>
              <div style={{ width:32,height:32,borderRadius:"50%",background:a.color||COLOR.primary,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",flexShrink:0 }}>
                {(a.nickname||"?").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700,fontSize:14,color:t.tx1 }}>{a.nickname}</div>
                <div style={{ fontSize:12,color:t.tx2 }}>{a.type}{a.flipSign?" · flip sign":""}</div>
              </div>
              <button onClick={() => setEditing(a)} style={{ background:"transparent",border:`1px solid ${t.border}`,borderRadius:7,padding:"4px 10px",color:t.tx2,cursor:"pointer",fontSize:12 }}>Edit</button>
              <button onClick={() => handleDelete(a.id)} style={{ background:"transparent",border:`1px solid ${COLOR.danger}44`,borderRadius:7,padding:"4px 10px",color:COLOR.danger,cursor:"pointer",fontSize:12 }}>Delete</button>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Close</button>
      </div>
      {editing !== null && <AccountModal t={t} account={editing.id ? editing : null} onSave={handleSaveAccount} onClose={() => setEditing(null)} onSaveAndImport={onSaveAndImport ? acc => { handleSaveAccount(acc); onSaveAndImport(acc); } : undefined} />}
      {confirm && <ConfirmModal t={t} message="Delete this account? This won't delete transactions." onConfirm={() => doDelete(confirm)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ─── NewCategoryModal ─────────────────────────────────────────────────────────
function NewCategoryModal({ t, onSave, onClose }) {
  const [name,  setName]  = useState("");
  const [icon,  setIcon]  = useState("💡");
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [type,  setType]  = useState("expense");
  const inp = { width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx1,fontSize:13,boxSizing:"border-box" };
  const lbl = { fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600 };
  function handleSave() {
    if (!name.trim()) return;
    onSave({ id:"cat_"+generateId(),name:name.trim(),icon:icon.trim()||"💡",color,type,parentId:null,isDefault:false,hidden:false,alertEnabled:false,alertConfig:{},sortOrder:99,section:"Custom" });
  }
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2200,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:t.panelBg,borderRadius:20,width:"100%",maxWidth:360,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ fontWeight:800,fontSize:17,color:t.tx1,marginBottom:16 }}>New Category</div>
        <label style={lbl}>NAME</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Pet Care" style={{ ...inp,marginBottom:12 }} />
        <label style={lbl}>ICON (emoji)</label>
        <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="🐾" style={{ ...inp,marginBottom:12,fontSize:18 }} />
        <label style={lbl}>TYPE</label>
        <select value={type} onChange={e => setType(e.target.value)} style={{ ...inp,marginBottom:12 }}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="both">Both</option>
        </select>
        <label style={{ fontSize:11,color:t.tx2,display:"block",marginBottom:8,fontWeight:600 }}>COLOR</label>
        <div style={{ display:"flex",gap:8,marginBottom:16,flexWrap:"wrap" }}>
          {AVATAR_COLORS.map(c => (
            <div key={c} onClick={() => setColor(c)} style={{ width:24,height:24,borderRadius:"50%",background:c,cursor:"pointer",border:color===c?"3px solid #fff":"2px solid transparent",boxSizing:"border-box" }} />
          ))}
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()} style={{ flex:1,background:name.trim()?COLOR.primary:t.surf,border:"none",borderRadius:10,padding:"9px 0",color:name.trim()?"#fff":t.tx3,cursor:name.trim()?"pointer":"default",fontWeight:700,fontSize:14 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── TransactionModal ─────────────────────────────────────────────────────────
function TransactionModal({ t, transaction, accounts, categories, rules, onSave, onSaveRule, onSaveCategory, onClose }) {
  const [date,         setDate]         = useState(transaction?.date||currentYYYYMM()+"-01");
  const [description,  setDescription]  = useState(transaction?.description||"");
  const [amount,       setAmount]       = useState(transaction ? String(transaction.amount) : "");
  const [accountId,    setAccountId]    = useState(transaction?.accountId||accounts[0]?.id||"");
  const [categoryId,   setCategoryId]   = useState(transaction?.categoryId||"exp_057");
  const [notes,             setNotes]             = useState(transaction?.notes||"");
  const [recurrenceType,    setRecurrenceType]    = useState(transaction?.recurrenceType||null);
  const [recurrencePattern, setRecurrencePattern] = useState(
    transaction?.recurrencePattern ||
    ((transaction?.description||"").replace(/\d{4,}/g, '').replace(/\s{2,}/g, ' ').trim())
  );
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [showNewCat,   setShowNewCat]   = useState(false);
  const [isSplit,      setIsSplit]      = useState(!!transaction?.isSplit);
  const [splits,       setSplits]       = useState(transaction?.splits?.length ? transaction.splits.map(s => ({ id: s.id || generateId(), amount: String(s.amount ?? ""), categoryId: s.categoryId || "exp_057", notes: s.notes || "" })) : []);
  const [splitError,   setSplitError]   = useState(null);

  const splitCategories = categories.filter(c => c.id !== SPLIT_CATEGORY_ID);
  const parsedTarget = parseAmount(amount);
  const targetTotal = parsedTarget === null ? 0 : Math.abs(parsedTarget);
  const splitTotal = splits.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
  const splitBalanced = isSplit && Math.round((targetTotal - splitTotal) * 100) === 0 && targetTotal > 0;

  function updateSplit(idx, patch) {
    setSplits(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
    if (splitError) setSplitError(null);
  }
  function addSplit() {
    setSplits(prev => prev.length >= MAX_SPLIT_ITEMS ? prev : [...prev, { id: generateId(), amount: "", categoryId: "exp_057", notes: "" }]);
  }
  function removeSplit(idx) {
    setSplits(prev => prev.filter((_, i) => i !== idx));
  }
  function toggleSplit() {
    if (isSplit) {
      setIsSplit(false);
      setSplits([]);
      setSplitError(null);
    } else {
      setIsSplit(true);
      setSplits([{ id: generateId(), amount: "", categoryId: "exp_057", notes: "" }]);
    }
  }

  function handleSave() {
    const amt = parseAmount(amount);
    if (!date || !description.trim() || amt === null) return;
    if (isSplit) {
      if (splits.length < 2) { setSplitError("Add at least 2 split items."); return; }
      if (splits.some(s => !s.categoryId)) { setSplitError("Every split line needs a category."); return; }
      const sum = splits.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
      if (Math.round((Math.abs(amt) - sum) * 100) !== 0) {
        setSplitError(`Splits must total ${fmt$(Math.abs(amt))} (current: ${fmt$(sum)}).`);
        return;
      }
    }
    const isSinkingFundCandidate = ["quarterly","biannual","annual","one-time"].includes(recurrenceType);
    onSave({
      ...(transaction||{}),
      id: transaction?.id || generateId(),
      date,
      description: description.trim(),
      amount: amt,
      accountId,
      categoryId: isSplit ? SPLIT_CATEGORY_ID : categoryId,
      notes,
      recurrenceType: recurrenceType || null,
      recurrencePattern: (recurrenceType && recurrenceType !== "monthly") ? recurrencePattern.trim() : null,
      isSinkingFundCandidate,
      isSplit,
      splits: isSplit ? splits.map(s => ({ id: s.id, amount: parseFloat(s.amount) || 0, categoryId: s.categoryId, notes: s.notes || "" })) : [],
      categoryLocked: true,
      needsReview: false,
      importedAt: transaction?.importedAt || new Date().toISOString(),
      entryMethod: transaction?.entryMethod || "manual",
    });
  }
  function handleSaveRuleLocal(rule) { onSaveRule && onSaveRule(rule); setShowRuleForm(false); }
  function handleSaveNewCategory(newCat) { onSaveCategory && onSaveCategory(newCat); setCategoryId(newCat.id); setShowNewCat(false); }

  const inp = { width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx1,fontSize:13,boxSizing:"border-box" };
  const lbl = { fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600 };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:t.panelBg,borderRadius:20,width:"100%",maxWidth:440,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto" }}>
        <div style={{ fontWeight:800,fontSize:17,color:t.tx1,marginBottom:16 }}>{transaction ? "Edit Transaction" : "Add Transaction"}</div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12 }}>
          <div>
            <label style={lbl}>DATE</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>AMOUNT</label>
            <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="-42.50" style={inp} />
          </div>
        </div>
        <label style={lbl}>DESCRIPTION</label>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="AMAZON.COM" style={{ ...inp,marginBottom:12 }} />
        <label style={lbl}>ACCOUNT</label>
        <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ ...inp,marginBottom:12 }}>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.nickname}</option>)}
          {accounts.length === 0 && <option value="">No accounts</option>}
        </select>
        <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
          <label style={{ ...lbl,marginBottom:0,flex:1 }}>CATEGORY</label>
          {!isSplit && (
            <button onClick={() => setShowNewCat(true)} style={{ background:"transparent",border:"none",color:COLOR.primary,cursor:"pointer",fontSize:11,fontWeight:700,padding:"2px 4px" }}>+ New Category</button>
          )}
        </div>
        {!isSplit && (
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={{ ...inp,marginBottom:8 }}>
            {categories.filter(c => c.id !== SPLIT_CATEGORY_ID).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        )}
        {isSplit && (
          <div style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:10,marginBottom:8 }}>
            {splits.map((s, idx) => (
              <div key={s.id} style={{ display:"grid",gridTemplateColumns:"88px 1fr 28px",gap:6,marginBottom:6,alignItems:"center" }}>
                <input
                  value={s.amount}
                  onChange={e => updateSplit(idx, { amount: e.target.value })}
                  placeholder="0.00"
                  inputMode="decimal"
                  style={{ ...inp,padding:"6px 8px",fontSize:12,fontFamily:"monospace" }} />
                <select
                  value={s.categoryId}
                  onChange={e => updateSplit(idx, { categoryId: e.target.value })}
                  style={{ ...inp,padding:"6px 8px",fontSize:12 }}>
                  {splitCategories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
                <button
                  onClick={() => removeSplit(idx)}
                  aria-label="Remove split"
                  style={{ background:"transparent",border:`1px solid ${t.border}`,borderRadius:5,color:COLOR.danger,cursor:"pointer",fontSize:13,padding:"4px 0",fontWeight:700 }}>×</button>
              </div>
            ))}
            <button
              onClick={addSplit}
              disabled={splits.length >= MAX_SPLIT_ITEMS}
              style={{ width:"100%",background:"transparent",border:`1px dashed ${t.border2}`,borderRadius:6,padding:"6px 0",color: splits.length >= MAX_SPLIT_ITEMS ? t.tx3 : t.tx2,cursor: splits.length >= MAX_SPLIT_ITEMS ? "not-allowed" : "pointer",fontSize:11,fontWeight:600,marginTop:2 }}>
              ＋ Add line item{splits.length >= MAX_SPLIT_ITEMS ? ` (max ${MAX_SPLIT_ITEMS})` : ""}
            </button>
            <div style={{ marginTop:8,fontSize:11,fontWeight:700,color: splitBalanced ? COLOR.success : COLOR.danger,fontFamily:"monospace" }}>
              Allocated: {fmt$(splitTotal)} of {fmt$(targetTotal)}
            </div>
            {splitError && <div style={{ marginTop:4,fontSize:11,color:COLOR.danger }}>{splitError}</div>}
          </div>
        )}
        <button onClick={toggleSplit} style={{ width:"100%",background:"transparent",border:`1px solid ${t.border}`,borderRadius:7,padding:"5px 10px",color: isSplit ? COLOR.danger : t.tx2,cursor:"pointer",fontSize:11,fontWeight:600,marginBottom:8 }}>
          {isSplit ? "Remove split" : "Split transaction"}
        </button>
        {!isSplit && (
          <button onClick={() => setShowRuleForm(true)} style={{ width:"100%",background:"transparent",border:`1px solid ${t.border}`,borderRadius:7,padding:"5px 10px",color:t.tx2,cursor:"pointer",fontSize:11,fontWeight:600,marginBottom:12 }}>
            + Create Rule from This
          </button>
        )}
        <label style={lbl}>NOTES</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note..." style={{ ...inp,marginBottom:12 }} />
        <label style={lbl}>RECURRENCE</label>
        <select value={recurrenceType||""} onChange={e => setRecurrenceType(e.target.value||null)} style={{ ...inp,marginBottom:12 }}>
          <option value="">Not recurring</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="biannual">Semi-Annual</option>
          <option value="annual">Annual</option>
          <option value="one-time">One-Time</option>
        </select>
        {recurrenceType && recurrenceType !== "monthly" && (
          <div style={{ marginBottom:16 }}>
            <label style={lbl}>PATTERN LABEL <span style={{ color:t.tx3,fontWeight:400 }}>Used to group this bill across months (e.g. "Geico Insurance")</span></label>
            <input value={recurrencePattern} onChange={e => setRecurrencePattern(e.target.value.slice(0,60))} maxLength={60} style={inp} />
          </div>
        )}
        {!(recurrenceType && recurrenceType !== "monthly") && <div style={{ marginBottom:16 }} />}
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} style={{ flex:1,background:COLOR.primary,border:"none",borderRadius:10,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14 }}>Save</button>
        </div>
      </div>
      {showRuleForm && <RuleModal t={t} rule={{ id:null,keyword:description,matchType:"contains",categoryId,priority:10 }} categories={categories} onSave={handleSaveRuleLocal} onClose={() => setShowRuleForm(false)} />}
      {showNewCat && <NewCategoryModal t={t} onSave={handleSaveNewCategory} onClose={() => setShowNewCat(false)} />}
    </div>
  );
}

// ─── RuleModal ────────────────────────────────────────────────────────────────
function RuleModal({ t, rule, categories, onSave, onClose }) {
  const [keyword,   setKeyword]   = useState(rule?.keyword||"");
  const [matchType, setMatchType] = useState(rule?.matchType||"contains");
  const [categoryId,setCategoryId]= useState(rule?.categoryId||"exp_057");
  const [priority,  setPriority]  = useState(rule ? String(rule.priority||0) : "0");

  function handleSave() {
    if (!keyword.trim()) return;
    onSave({ ...(rule||{}), id: rule?.id||generateId(), keyword:keyword.trim(), matchType, categoryId, priority:parseInt(priority)||0 });
  }

  const inp = { width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx1,fontSize:13,boxSizing:"border-box" };
  const lbl = { fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600 };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:t.panelBg,borderRadius:20,width:"100%",maxWidth:440,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ fontWeight:800,fontSize:17,color:t.tx1,marginBottom:16 }}>{rule ? "Edit Rule" : "Add Rule"}</div>
        <label style={lbl}>KEYWORD</label>
        <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="amazon" style={{ ...inp,marginBottom:12 }} />
        <label style={lbl}>MATCH TYPE</label>
        <select value={matchType} onChange={e => setMatchType(e.target.value)} style={{ ...inp,marginBottom:12 }}>
          <option value="contains">Contains</option>
          <option value="startsWith">Starts with</option>
          <option value="exact">Exact match</option>
        </select>
        <label style={lbl}>ASSIGN CATEGORY</label>
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={{ ...inp,marginBottom:12 }}>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <label style={lbl}>PRIORITY (lower runs first)</label>
        <input type="number" value={priority} onChange={e => setPriority(e.target.value)} style={{ ...inp,marginBottom:16 }} />
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} style={{ flex:1,background:COLOR.primary,border:"none",borderRadius:10,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── StepDots ─────────────────────────────────────────────────────────────────
function StepDots({ step, total }) {
  return (
    <div style={{ display:"flex",justifyContent:"center",gap:6,marginBottom:16 }}>
      {Array.from({length:total}).map((_,i) => (
        <div key={i} style={{ width:8,height:8,borderRadius:"50%",background: i < step ? COLOR.primary : "#334155",transition:"all .2s" }} />
      ))}
    </div>
  );
}

// ─── ImportStep1 — Account picker ─────────────────────────────────────────────
function ImportStep1({ t, accounts, selectedAccountId, onSelect, onNewAccount, onNext }) {
  return (
    <div>
      <StepDots step={1} total={5} />
      <div style={{ fontWeight:800,fontSize:17,color:t.tx1,marginBottom:4 }}>Select Account</div>
      <div style={{ fontSize:13,color:t.tx2,marginBottom:16 }}>Which account is this CSV from? You can select multiple files after clicking Next.</div>
      <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:16 }}>
        {accounts.map(a => (
          <div key={a.id} onClick={() => onSelect(a.id)}
            style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background: selectedAccountId===a.id ? COLOR.primary+"22" : t.surf, border:`1px solid ${selectedAccountId===a.id ? COLOR.primary : t.border}`,borderRadius:12,cursor:"pointer",transition:"all .15s" }}>
            <div style={{ width:36,height:36,borderRadius:"50%",background:a.color||COLOR.primary,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff",fontWeight:700 }}>
              {(a.nickname||"?").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight:700,fontSize:14,color:t.tx1 }}>{a.nickname}</div>
              <div style={{ fontSize:12,color:t.tx2 }}>{a.type}</div>
            </div>
          </div>
        ))}
        <button onClick={onNewAccount} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 14px",color:t.tx2,cursor:"pointer",fontWeight:600,fontSize:13,textAlign:"left" }}>
          + New account…
        </button>
      </div>
      <button onClick={onNext} disabled={!selectedAccountId} style={{ width:"100%",background: selectedAccountId ? COLOR.primary : t.surf,border:"none",borderRadius:10,padding:"10px 0",color: selectedAccountId ? "#fff" : t.tx3,cursor: selectedAccountId ? "pointer" : "default",fontWeight:700,fontSize:14 }}>
        Select CSV File(s) →
      </button>
    </div>
  );
}

// ─── ImportStep2 — Column mapper ──────────────────────────────────────────────
function ImportStep2({ t, headers, colMap, onColMap, onBack, onNext }) {
  const fields = [
    { key:"date",        label:"Date",        required:true },
    { key:"description", label:"Description", required:true },
    { key:"amount",      label:"Amount",      required:false },
    { key:"debit",       label:"Debit",       required:false },
    { key:"credit",      label:"Credit",      required:false },
    { key:"category",   label:"Their Category", required:false },
  ];
  const canNext = colMap.date && colMap.description && (colMap.amount || (colMap.debit && colMap.credit));
  return (
    <div>
      <StepDots step={2} total={5} />
      <div style={{ fontWeight:800,fontSize:17,color:t.tx1,marginBottom:4 }}>Map Columns</div>
      <div style={{ fontSize:13,color:t.tx2,marginBottom:16 }}>Tell us which CSV columns map to which fields.</div>
      <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:16 }}>
        {fields.map(f => (
          <div key={f.key} style={{ display:"grid",gridTemplateColumns:"120px 1fr",alignItems:"center",gap:10 }}>
            <label style={{ fontSize:12,color:t.tx2,fontWeight:600 }}>{f.label}{f.required?" *":""}</label>
            <select value={colMap[f.key]||""} onChange={e => onColMap({...colMap,[f.key]:e.target.value})}
              style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 10px",color:t.tx1,fontSize:13 }}>
              <option value="">— none —</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div style={{ fontSize:12,color:t.tx3,marginBottom:16 }}>* Either Amount OR both Debit+Credit required.</div>
      <div style={{ display:"flex",gap:10 }}>
        <button onClick={onBack} style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>← Back</button>
        <button onClick={onNext} disabled={!canNext} style={{ flex:2,background: canNext ? COLOR.primary : t.surf,border:"none",borderRadius:10,padding:"9px 0",color: canNext ? "#fff" : t.tx3,cursor: canNext ? "pointer" : "default",fontWeight:700,fontSize:14 }}>
          Next →
        </button>
      </div>
    </div>
  );
}

// ─── ImportStep3 — Sign normalization ─────────────────────────────────────────
function ImportStep3({ t, flipSign, onFlipSign, previewRows, colMap, onBack, onNext }) {
  const samples = previewRows.slice(0,3).map(row => {
    let amt = null;
    if (colMap.amount) amt = parseAmount(row[colMap.amount]);
    else if (colMap.debit && colMap.credit) {
      const d = parseAmount(row[colMap.debit]);
      const c = parseAmount(row[colMap.credit]);
      if (d) amt = -Math.abs(d);
      else if (c) amt = Math.abs(c);
    }
    if (amt !== null && flipSign) amt = -amt;
    return { desc: row[colMap.description]||"", amt };
  });

  return (
    <div>
      <StepDots step={3} total={5} />
      <div style={{ fontWeight:800,fontSize:17,color:t.tx1,marginBottom:4 }}>Sign Normalization</div>
      <div style={{ fontSize:13,color:t.tx2,marginBottom:16 }}>Expenses should be negative. Flip if your CSV shows them as positive.</div>
      <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:16 }}>
        <input type="checkbox" checked={flipSign} onChange={e => onFlipSign(e.target.checked)} style={{ width:16,height:16,accentColor:COLOR.primary }} />
        <span style={{ fontSize:13,color:t.tx1,fontWeight:600 }}>Flip sign (expenses are positive in this CSV)</span>
      </label>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11,color:t.tx2,fontWeight:600,marginBottom:8 }}>PREVIEW</div>
        {samples.map((s,i) => (
          <div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${t.border}` }}>
            <span style={{ fontSize:13,color:t.tx1,maxWidth:"70%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{s.desc||"—"}</span>
            <span style={{ fontFamily:"monospace",fontSize:13,fontWeight:700,color: s.amt===null?"#94a3b8":s.amt<0?COLOR.danger:COLOR.success }}>
              {s.amt===null?"n/a":fmt$(s.amt)}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display:"flex",gap:10 }}>
        <button onClick={onBack} style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>← Back</button>
        <button onClick={onNext} style={{ flex:2,background:COLOR.primary,border:"none",borderRadius:10,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14 }}>Next →</button>
      </div>
    </div>
  );
}

// ─── ImportStep4 — Dedup Preview ──────────────────────────────────────────────
function ImportStep4({ t, dedupData, onBack, onNext }) {
  const { newTxns, dupes, conflicts } = dedupData || { newTxns:[], dupes:[], conflicts:[] };
  const [skipDupes,       setSkipDupes]       = useState(true);
  const [conflictActions, setConflictActions] = useState(
    () => Object.fromEntries((conflicts||[]).map(c => [c.parsed.id, "keep"]))
  );

  const toImport = [
    ...newTxns,
    ...(skipDupes ? [] : dupes.map(d => d.parsed)),
    ...(conflicts||[]).filter(c => conflictActions[c.parsed.id] !== "keep").map(c =>
      conflictActions[c.parsed.id] === "overwrite"
        ? { ...c.parsed, _replaceId: c.existing.id }
        : c.parsed
    ),
  ];

  return (
    <div>
      <StepDots step={4} total={5} />
      <div style={{ fontWeight:800,fontSize:17,color:t.tx1,marginBottom:4 }}>Review Import</div>
      <div style={{ fontSize:13,color:t.tx2,marginBottom:12 }}>Review before importing. Conflicts require your decision.</div>

      <div style={{ display:"flex",gap:8,marginBottom:14 }}>
        <div style={{ flex:1,background:COLOR.success+"18",border:`1px solid ${COLOR.success}44`,borderRadius:10,padding:"10px",textAlign:"center" }}>
          <div style={{ fontSize:22,fontWeight:800,color:COLOR.success }}>{newTxns.length}</div>
          <div style={{ fontSize:11,color:t.tx2 }}>New</div>
        </div>
        <div style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px",textAlign:"center" }}>
          <div style={{ fontSize:22,fontWeight:800,color:t.tx3 }}>{dupes.length}</div>
          <div style={{ fontSize:11,color:t.tx2 }}>Duplicates</div>
        </div>
        <div style={{ flex:1,background:COLOR.warning+"18",border:`1px solid ${COLOR.warning}44`,borderRadius:10,padding:"10px",textAlign:"center" }}>
          <div style={{ fontSize:22,fontWeight:800,color:COLOR.warning }}>{conflicts.length}</div>
          <div style={{ fontSize:11,color:t.tx2 }}>Conflicting</div>
        </div>
      </div>

      {dupes.length > 0 && (
        <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:12,background:t.surf,borderRadius:8,padding:"10px 12px" }}>
          <input type="checkbox" checked={skipDupes} onChange={e => setSkipDupes(e.target.checked)} style={{ width:15,height:15,accentColor:COLOR.primary }} />
          <span style={{ fontSize:13,color:t.tx1 }}>Skip all {dupes.length} duplicate{dupes.length>1?"s":""} (recommended)</span>
        </label>
      )}

      {(conflicts||[]).length > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11,color:COLOR.warning,fontWeight:700,marginBottom:8 }}>⚠ CONFLICTING — SAME DATE & DESCRIPTION, DIFFERENT AMOUNT</div>
          {(conflicts||[]).map(c => (
            <div key={c.parsed.id} style={{ background:COLOR.warning+"10",border:`1px solid ${COLOR.warning}44`,borderRadius:10,padding:"10px 12px",marginBottom:8 }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                <span style={{ fontSize:12,color:t.tx1,fontWeight:600,maxWidth:"65%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{c.parsed.description}</span>
                <span style={{ fontSize:11,color:t.tx2 }}>{c.parsed.date}</span>
              </div>
              <div style={{ display:"flex",gap:16,marginBottom:8,fontSize:12 }}>
                <span style={{ color:t.tx2 }}>Existing: <span style={{ fontFamily:"monospace",fontWeight:700,color:t.tx1 }}>{fmt$(c.existing.amount)}</span></span>
                <span style={{ color:t.tx2 }}>New: <span style={{ fontFamily:"monospace",fontWeight:700,color:COLOR.primary }}>{fmt$(c.parsed.amount)}</span></span>
              </div>
              <div style={{ display:"flex",gap:4 }}>
                {[{v:"keep",l:"Keep existing"},{v:"overwrite",l:"Overwrite"},{v:"both",l:"Import both"}].map(opt => (
                  <button key={opt.v} onClick={() => setConflictActions(p => ({...p,[c.parsed.id]:opt.v}))}
                    style={{ flex:1,background:conflictActions[c.parsed.id]===opt.v?COLOR.primary:t.surf,
                      border:`1px solid ${conflictActions[c.parsed.id]===opt.v?COLOR.primary:t.border}`,
                      borderRadius:6,padding:"5px 4px",color:conflictActions[c.parsed.id]===opt.v?"#fff":t.tx2,
                      cursor:"pointer",fontWeight:600,fontSize:11 }}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {newTxns.length > 0 && (
        <div style={{ maxHeight:150,overflowY:"auto",marginBottom:12,border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden" }}>
          <div style={{ padding:"6px 12px",background:COLOR.success+"10",fontSize:11,color:COLOR.success,fontWeight:700,borderBottom:`1px solid ${t.border}` }}>NEW ({newTxns.length})</div>
          {newTxns.slice(0,15).map(tx => (
            <div key={tx.id} style={{ display:"flex",justifyContent:"space-between",padding:"5px 12px",borderBottom:`1px solid ${t.border}` }}>
              <span style={{ fontSize:12,color:t.tx1,maxWidth:"65%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{tx.description}</span>
              <span style={{ fontFamily:"monospace",fontSize:12,fontWeight:700,color:tx.amount<0?COLOR.danger:COLOR.success }}>{fmt$(tx.amount)}</span>
            </div>
          ))}
          {newTxns.length > 15 && <div style={{ padding:"5px 12px",fontSize:11,color:t.tx2 }}>…and {newTxns.length-15} more</div>}
        </div>
      )}

      {toImport.length === 0 && (
        <div style={{ background:COLOR.warning+"18",border:`1px solid ${COLOR.warning}44`,borderRadius:10,padding:"10px 14px",fontSize:13,color:COLOR.warning,marginBottom:12 }}>
          Nothing new to import with current settings.
        </div>
      )}

      <div style={{ display:"flex",gap:10 }}>
        <button onClick={onBack} style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>← Back</button>
        <button onClick={() => onNext(toImport)} disabled={toImport.length===0}
          style={{ flex:2,background:toImport.length>0?COLOR.primary:t.surf,border:"none",borderRadius:10,padding:"9px 0",
            color:toImport.length>0?"#fff":t.tx3,cursor:toImport.length>0?"pointer":"default",fontWeight:700,fontSize:14 }}>
          Categorize {toImport.length} →
        </button>
      </div>
    </div>
  );
}

// ─── ImportStep5 — AI batch categorization ────────────────────────────────────
function ImportStep5({ t, pending, categories, apiKey, onComplete, onBack }) {
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiDone,       setAiDone]       = useState(false);
  const [assignments,  setAssignments]  = useState(() => pending.map(tx => ({ ...tx })));
  const [needsReview,  setNeedsReview]  = useState([]);
  const [error,        setError]        = useState(null);

  async function runAI() {
    if (!apiKey) { setError("No API key. Categories assigned as Uncategorized."); setAiDone(true); return; }
    setAiLoading(true);
    setError(null);
    try {
      const catList = categories.map(c => `${c.id}: ${c.name} (${c.section})`).join("\n");
      const txList = pending.map((tx,i) => `${i}: "${tx.description}" ${fmt$(tx.amount)}`).join("\n");
      const prompt = `You are a personal finance assistant. Categorize these bank transactions.

Available categories:
${catList}

Transactions:
${txList}

Return ONLY a JSON array, no explanation:
[{"index":0,"categoryId":"exp_006","confidence":"high","reason":"grocery store"}]

Confidence: "high" (obvious), "medium" (likely), "low" (guess).`;

      const res = await callClaude(apiKey, {
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role:"user", content: prompt }]
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || "[]";
      const match = text.match(/\[[\s\S]*\]/);
      const parsed = match ? JSON.parse(match[0]) : [];

      const next = pending.map((tx,i) => {
        const hit = parsed.find(p => p.index === i);
        if (hit && hit.categoryId && categories.find(c => c.id === hit.categoryId)) {
          const locked = hit.confidence === "high";
          return { ...tx, categoryId: hit.categoryId, categoryLocked: locked, needsReview: !locked };
        }
        return { ...tx, categoryId: "exp_057", categoryLocked: false, needsReview: true };
      });
      setAssignments(next);
      setNeedsReview(next.filter(tx => tx.needsReview).map(tx => tx.id));
    } catch (e) {
      setError(aiErrorMsg(e));
      setAssignments(pending.map(tx => ({ ...tx, categoryId:"exp_057", categoryLocked:false, needsReview:true })));
      setNeedsReview(pending.map(tx => tx.id));
    }
    setAiLoading(false);
    setAiDone(true);
  }

  function changeCategory(id, categoryId) {
    setAssignments(prev => prev.map(tx => tx.id === id ? { ...tx, categoryId, categoryLocked:true, needsReview:false } : tx));
    setNeedsReview(prev => prev.filter(rid => rid !== id));
  }

  return (
    <div>
      <StepDots step={5} total={5} />
      <div style={{ fontWeight:800,fontSize:17,color:t.tx1,marginBottom:4 }}>AI Categorization</div>
      <div style={{ fontSize:13,color:t.tx2,marginBottom:16 }}>{pending.length} transactions to categorize.</div>

      {!aiDone && !aiLoading && (
        <div>
          <button onClick={runAI} style={{ width:"100%",background:COLOR.purple,border:"none",borderRadius:10,padding:"11px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14,marginBottom:10 }}>
            ✨ AI Categorize All
          </button>
          <button onClick={() => { setAssignments(pending.map(tx=>({...tx,categoryId:"exp_057",categoryLocked:false}))); setAiDone(true); setNeedsReview(pending.map(tx=>tx.id)); }}
            style={{ width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx2,cursor:"pointer",fontWeight:600,fontSize:13 }}>
            Skip — I'll categorize manually
          </button>
        </div>
      )}

      {aiLoading && (
        <div style={{ textAlign:"center",padding:"24px 0" }}>
          <div style={{ width:36,height:36,border:"3px solid #6366f1",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 12px" }} />
          <div style={{ fontSize:14,color:t.tx2 }}>Analyzing {pending.length} transactions…</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {aiDone && (
        <div>
          {error && <div style={{ background:COLOR.warning+"18",border:`1px solid ${COLOR.warning}44`,borderRadius:8,padding:"8px 12px",fontSize:12,color:COLOR.warning,marginBottom:12 }}>{error}</div>}
          <div style={{ display:"flex",gap:10,marginBottom:12 }}>
            <div style={{ flex:1,background:t.surf,borderRadius:10,padding:"10px",textAlign:"center" }}>
              <div style={{ fontSize:20,fontWeight:800,color:COLOR.success }}>{assignments.length - needsReview.length}</div>
              <div style={{ fontSize:11,color:t.tx2 }}>Categorized</div>
            </div>
            <div style={{ flex:1,background:t.surf,borderRadius:10,padding:"10px",textAlign:"center" }}>
              <div style={{ fontSize:20,fontWeight:800,color:COLOR.warning }}>{needsReview.length}</div>
              <div style={{ fontSize:11,color:t.tx2 }}>Needs review</div>
            </div>
          </div>
          {needsReview.length > 0 && (
            <div style={{ maxHeight:200,overflowY:"auto",marginBottom:12 }}>
              {assignments.filter(tx => needsReview.includes(tx.id)).map(tx => (
                <div key={tx.id} style={{ padding:"8px 0",borderBottom:`1px solid ${t.border}` }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                    <span style={{ fontSize:13,color:t.tx1,maxWidth:"60%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{tx.description}</span>
                    <span style={{ fontFamily:"monospace",fontSize:13,color:tx.amount<0?COLOR.danger:COLOR.success }}>{fmt$(tx.amount)}</span>
                  </div>
                  <select value={tx.categoryId||"exp_057"} onChange={e => changeCategory(tx.id,e.target.value)}
                    style={{ width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:7,padding:"5px 8px",color:t.tx1,fontSize:12 }}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
          <div style={{ display:"flex",gap:10 }}>
            <button onClick={onBack} style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>← Back</button>
            <button onClick={() => onComplete(assignments)} style={{ flex:2,background:COLOR.success,border:"none",borderRadius:10,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14 }}>
              ✓ Import {assignments.length} Transactions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ImportSummaryScreen ──────────────────────────────────────────────────────
function ImportSummaryScreen({ t, results, onClose }) {
  const totalImported = results.reduce((s,r) => s+r.imported, 0);
  const totalSkipped  = results.reduce((s,r) => s+r.skipped, 0);
  const totalConflicts= results.reduce((s,r) => s+r.conflicts, 0);
  const totalReview   = results.reduce((s,r) => s+r.needsReview, 0);
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:32,marginBottom:8 }}>✅</div>
      <div style={{ fontWeight:800,fontSize:18,color:t.tx1,marginBottom:4 }}>Import Complete</div>
      <div style={{ fontSize:13,color:t.tx2,marginBottom:20 }}>{results.length} file{results.length>1?"s":""} processed</div>
      <div style={{ display:"flex",gap:8,marginBottom:16,flexWrap:"wrap" }}>
        <div style={{ flex:1,background:COLOR.success+"18",border:`1px solid ${COLOR.success}44`,borderRadius:12,padding:"12px" }}>
          <div style={{ fontSize:24,fontWeight:800,color:COLOR.success }}>{totalImported}</div>
          <div style={{ fontSize:11,color:t.tx2 }}>Imported</div>
        </div>
        <div style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px" }}>
          <div style={{ fontSize:24,fontWeight:800,color:t.tx3 }}>{totalSkipped}</div>
          <div style={{ fontSize:11,color:t.tx2 }}>Skipped</div>
        </div>
        {totalConflicts > 0 && (
          <div style={{ flex:1,background:COLOR.warning+"18",border:`1px solid ${COLOR.warning}44`,borderRadius:12,padding:"12px" }}>
            <div style={{ fontSize:24,fontWeight:800,color:COLOR.warning }}>{totalConflicts}</div>
            <div style={{ fontSize:11,color:t.tx2 }}>Conflicts</div>
          </div>
        )}
        {totalReview > 0 && (
          <div style={{ flex:1,background:COLOR.warning+"18",border:`1px solid ${COLOR.warning}44`,borderRadius:12,padding:"12px" }}>
            <div style={{ fontSize:24,fontWeight:800,color:COLOR.warning }}>{totalReview}</div>
            <div style={{ fontSize:11,color:t.tx2 }}>Need review</div>
          </div>
        )}
      </div>
      {results.length > 1 && (
        <div style={{ marginBottom:16,textAlign:"left" }}>
          {results.map((r,i) => (
            <div key={i} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${t.border}`,fontSize:12 }}>
              <span style={{ color:t.tx2,maxWidth:"55%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.fileName}</span>
              <span style={{ color:t.tx1,fontWeight:600 }}>{r.imported} imported · {r.skipped} skipped</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize:12,color:t.tx2,marginBottom:12 }}>
        {totalReview > 0 ? `${totalReview} transaction${totalReview>1?"s":""} flagged for review in Transactions tab.` : "All transactions categorized."}
      </div>
      <button onClick={onClose} style={{ width:"100%",background:COLOR.primary,border:"none",borderRadius:10,padding:"11px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14 }}>Done</button>
    </div>
  );
}

// ─── ImportWizard ─────────────────────────────────────────────────────────────
function ImportWizard({ t, accounts, categories, rules, transactions, apiKey, onComplete, onClose, onUpdateAccounts, initialAccountId }) {
  const [step,           setStep]           = useState(1);
  const [accountId,      setAccountId]      = useState(initialAccountId || accounts[0]?.id||"");
  const [csvHeaders,     setCsvHeaders]     = useState([]);
  const [csvRows,        setCsvRows]        = useState([]);
  const [colMap,         setColMap]         = useState({});
  const [flipSign,       setFlipSign]       = useState(false);
  const [dedupData,      setDedupData]      = useState(null);
  const [toImport,       setToImport]       = useState([]);
  const [fileQueue,      setFileQueue]      = useState([]);
  const [currentFileIdx, setCurrentFileIdx] = useState(0);
  const [importResults,  setImportResults]  = useState([]);
  const [showSummary,    setShowSummary]    = useState(false);
  const [showAccForm,    setShowAccForm]    = useState(false);
  const accountRef = useRef(accountId);
  useEffect(() => { accountRef.current = accountId; }, [accountId]);

  function loadFile(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      const { headers, rows } = parseCSV(ev.target.result);
      setCsvHeaders(headers);
      setCsvRows(rows);
      const auto = autoDetectColumns(headers);
      const acc = accounts.find(a => a.id === accountRef.current);
      setColMap(acc?.columnMap && Object.keys(acc.columnMap).length ? acc.columnMap : auto);
      setFlipSign(acc?.flipSign||false);
      setStep(2);
    };
    reader.readAsText(file);
  }

  function handleFiles(e) {
    const files = Array.from(e.target.files||[]);
    if (!files.length) return;
    setFileQueue(files);
    setCurrentFileIdx(0);
    setImportResults([]);
    setShowSummary(false);
    loadFile(files[0]);
  }

  function buildDedupData() {
    const existing = transactions || [];
    const newTxns = [], dupes = [], conflicts = [];
    for (const row of csvRows) {
      const rawDate = colMap.date ? row[csvHeaders.indexOf(colMap.date)] : null;
      const rawDesc = colMap.description ? row[csvHeaders.indexOf(colMap.description)] : null;
      let amt = null;
      if (colMap.amount) amt = parseAmount(row[csvHeaders.indexOf(colMap.amount)]);
      else if (colMap.debit && colMap.credit) {
        const d = parseAmount(row[csvHeaders.indexOf(colMap.debit)]);
        const c = parseAmount(row[csvHeaders.indexOf(colMap.credit)]);
        if (d && d > 0) amt = -Math.abs(d);
        else if (c && c > 0) amt = Math.abs(c);
      }
      const date = normalizeDate(rawDate);
      const description = (rawDesc||"").trim();
      if (!date || !description || amt === null) continue;
      const finalAmt = flipSign ? -amt : amt;
      const theirCat = colMap.category ? row[csvHeaders.indexOf(colMap.category)] : "";

      const exactMatch = existing.find(ex =>
        ex.date === date &&
        ex.description.toLowerCase() === description.toLowerCase() &&
        Math.abs(ex.amount - finalAmt) < 0.01
      );
      if (exactMatch) {
        dupes.push({ parsed: { id: generateId(), date, description, amount: finalAmt }, existing: exactMatch });
        continue;
      }

      const conflictMatch = existing.find(ex =>
        ex.date === date &&
        ex.description.toLowerCase() === description.toLowerCase()
      );

      const matchedRule = applyRules(description, rules);
      const parsed = {
        id: generateId(), accountId, date, description, amount: finalAmt,
        categoryId: matchedRule ? matchedRule.categoryId : (theirCat ? null : "exp_057"),
        categoryLocked: !!matchedRule, ruleId: matchedRule?.id||null,
        theirCategory: theirCat||null, notes: "", isSinkingFundCandidate: false,
        recurrencePattern: null, recurrenceType: null,
        importedAt: new Date().toISOString(),
        entryMethod: "csv_import",
      };

      if (conflictMatch) {
        conflicts.push({ parsed, existing: conflictMatch });
        continue;
      }
      newTxns.push(parsed);
    }
    return { newTxns, dupes, conflicts };
  }

  function goToStep4() {
    const data = buildDedupData();
    setDedupData(data);
    // Persist column map back to account
    if (onUpdateAccounts) {
      const acc = accounts.find(a => a.id === accountId);
      if (acc) {
        const updAcc = { ...acc, columnMap: colMap, flipSign };
        onUpdateAccounts(accounts.map(a => a.id === updAcc.id ? updAcc : a));
      }
    }
    setStep(4);
  }

  function handleStep4Next(filtered) {
    setToImport(filtered);
    setStep(5);
  }

  function handleStep5Complete(categorized) {
    const fileObj = fileQueue[currentFileIdx];
    const result = {
      fileName: fileObj?.name || `File ${currentFileIdx+1}`,
      imported: categorized.length,
      skipped: dedupData?.dupes?.length||0,
      conflicts: dedupData?.conflicts?.length||0,
      needsReview: categorized.filter(tx => tx.needsReview).length,
      txns: categorized,
    };
    const allResults = [...importResults, result];
    setImportResults(allResults);

    const nextIdx = currentFileIdx + 1;
    if (nextIdx < fileQueue.length) {
      setCurrentFileIdx(nextIdx);
      setDedupData(null);
      setToImport([]);
      loadFile(fileQueue[nextIdx]);
    } else {
      const allTxns = allResults.flatMap(r => r.txns);
      onComplete(allTxns);
      setShowSummary(true);
    }
  }

  if (showAccForm) {
    return (
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2100,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
        <AccountModal t={t} account={null}
          onSave={acc => {
            if (onUpdateAccounts) onUpdateAccounts([...accounts, acc]);
            setAccountId(acc.id);
            setShowAccForm(false);
          }}
          onClose={() => setShowAccForm(false)} />
      </div>
    );
  }

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto" }}>
      <div style={{ background:t.panelBg,borderRadius:20,width:"100%",maxWidth:480,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto",position:"relative" }}>
        <button onClick={onClose} style={{ position:"absolute",top:16,right:16,background:"transparent",border:"none",color:t.tx3,cursor:"pointer",fontSize:18 }}>×</button>

        {fileQueue.length > 1 && step > 1 && !showSummary && (
          <div style={{ textAlign:"center",fontSize:12,color:t.tx2,marginBottom:8,background:t.surf,borderRadius:8,padding:"4px 12px",marginRight:28 }}>
            File {currentFileIdx+1} of {fileQueue.length}: {fileQueue[currentFileIdx]?.name}
          </div>
        )}

        {showSummary ? (
          <ImportSummaryScreen t={t} results={importResults} onClose={onClose} />
        ) : step === 1 ? (
          <>
            <ImportStep1
              t={t} accounts={accounts} selectedAccountId={accountId}
              onSelect={id => setAccountId(id)}
              onNewAccount={() => setShowAccForm(true)}
              onNext={() => { const el = document.getElementById("csv-multi-input"); if (el) { el.value=""; el.click(); } }}
            />
            <input id="csv-multi-input" type="file" accept=".csv,.txt" multiple style={{ display:"none" }} onChange={handleFiles} />
          </>
        ) : step === 2 ? (
          <ImportStep2 t={t} headers={csvHeaders} colMap={colMap} onColMap={setColMap} onBack={() => setStep(1)} onNext={() => setStep(3)} />
        ) : step === 3 ? (
          <ImportStep3
            t={t} flipSign={flipSign} onFlipSign={setFlipSign}
            previewRows={csvRows.slice(0,3).map(row => { const o={}; csvHeaders.forEach((h,i) => { o[h]=row[i]; }); return o; })}
            colMap={colMap} onBack={() => setStep(2)} onNext={goToStep4}
          />
        ) : step === 4 ? (
          <ImportStep4 t={t} dedupData={dedupData} onBack={() => setStep(3)} onNext={handleStep4Next} />
        ) : step === 5 ? (
          <ImportStep5 t={t} pending={toImport} categories={categories} apiKey={apiKey} onComplete={handleStep5Complete} onBack={() => setStep(4)} />
        ) : null}
      </div>
    </div>
  );
}

// ─── FirstRunSetup ────────────────────────────────────────────────────────────
function FirstRunSetup({ t, onComplete }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [pin, setPin] = useState("");

  function handleCreate() {
    if (!name.trim()) return;
    const stableId = pin.trim()
      ? "pin_" + pin.trim().toLowerCase().replace(/\s+/g, "_")
      : generateId();
    onComplete({ id: stableId, name: name.trim(), avatarColor: color, pin: pin.trim(), avatar: name.trim().charAt(0).toUpperCase() });
  }

  return (
    <div style={{ minHeight:"100vh",background:t.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
      <div style={{ background:t.panelBg,borderRadius:20,width:"100%",maxWidth:400,padding:32,boxShadow:"0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ textAlign:"center",marginBottom:24 }}>
          <div style={{ fontSize:40,marginBottom:8 }}>📊</div>
          <div style={{ fontWeight:800,fontSize:22,color:t.tx1,marginBottom:6 }}>Spending Tracker</div>
          <div style={{ fontSize:14,color:t.tx2 }}>Create your first profile to get started.</div>
        </div>
        <label style={{ fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600 }}>YOUR NAME</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Carter" style={{ width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx1,fontSize:14,boxSizing:"border-box",marginBottom:16 }} />
        <label style={{ fontSize:11,color:t.tx2,display:"block",marginBottom:8,fontWeight:600 }}>AVATAR COLOR</label>
        <div style={{ display:"flex",gap:8,marginBottom:16,flexWrap:"wrap" }}>
          {AVATAR_COLORS.map(c => (
            <div key={c} onClick={() => setColor(c)} style={{ width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:color===c?"3px solid #fff":"2px solid transparent",boxSizing:"border-box" }} />
          ))}
        </div>
        <label style={{ fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600 }}>RECOVERY PIN <span style={{ color:t.tx3,fontWeight:400 }}>(optional)</span></label>
        <input value={pin} onChange={e => setPin(e.target.value)} placeholder="e.g. smithfamily or john2024" style={{ width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx1,fontSize:14,boxSizing:"border-box",marginBottom:16 }} />
        <button onClick={handleCreate} disabled={!name.trim()} style={{ width:"100%",background: name.trim() ? COLOR.primary : t.surf,border:"none",borderRadius:10,padding:"11px 0",color: name.trim() ? "#fff" : t.tx3,cursor: name.trim() ? "pointer" : "default",fontWeight:700,fontSize:15 }}>
          Get Started
        </button>
      </div>
    </div>
  );
}

// ─── TransactionRow ───────────────────────────────────────────────────────────
function TransactionRow({ t, transaction, account, category, selectMode, selected, onToggle, onEdit, onDelete }) {
  const flagged = transaction.needsReview === true;
  return (
    <div style={{ display:"grid", gridTemplateColumns: selectMode ? "32px 90px 1fr 100px" : "90px 1fr 100px", gap:8, padding:"10px 0",
      paddingLeft: flagged && !selectMode ? 10 : 0,
      borderBottom:`1px solid ${t.border}`,
      borderLeft: flagged && !selectMode ? `3px solid ${COLOR.warning}` : "none",
      alignItems:"center" }}>
      {selectMode && (
        <div onClick={() => onToggle && onToggle(transaction.id)}
          style={{ display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:"0 4px" }}>
          <input type="checkbox" readOnly checked={!!selected}
            style={{ width:15,height:15,accentColor:COLOR.primary,cursor:"pointer",pointerEvents:"none" }} />
        </div>
      )}
      <div>
        <div style={{ fontSize:12,color:t.tx2,fontFamily:"monospace" }}>{transaction.date}</div>
        {account && <div style={{ fontSize:10,color:t.tx2,marginTop:2 }}>{account.nickname}</div>}
      </div>
      <div style={{ minWidth:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:3 }}>
          <span style={{ fontSize:13,color:t.tx1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{transaction.description}</span>
          {flagged && <span style={{ fontSize:9,fontWeight:700,color:COLOR.warning,background:COLOR.warning+"22",border:`1px solid ${COLOR.warning}55`,borderRadius:4,padding:"1px 5px",whiteSpace:"nowrap",flexShrink:0 }}>REVIEW</span>}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:5,flexWrap:"wrap" }}>
          {transaction.isSplit && Array.isArray(transaction.splits) && transaction.splits.length > 0 ? (
            <span
              title={`Split transaction — ${transaction.splits.length} items`}
              style={{ display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,color:t.tx2,background:t.surf,border:`1px solid ${t.border2}`,borderRadius:10,padding:"2px 8px",whiteSpace:"nowrap" }}>
              ⎇ Split ({transaction.splits.length})
            </span>
          ) : (
            <CategoryPill category={category} />
          )}
          {transaction.recurrenceType && (
            <span style={{ fontSize:10,color:t.tx2,background:t.surf,border:`1px solid ${t.border2}`,borderRadius:4,padding:"2px 6px",whiteSpace:"nowrap" }}>
              {{"monthly":"Monthly","quarterly":"Quarterly","biannual":"Semi-Annual","annual":"Annual","one-time":"One-Time"}[transaction.recurrenceType]}
            </span>
          )}
        </div>
        {transaction.notes && <div style={{ fontSize:11,color:t.tx3,marginTop:2 }}>{transaction.notes}</div>}
      </div>
      <div style={{ textAlign:"right" }}>
        <div style={{ fontFamily:"monospace",fontSize:14,fontWeight:700,color: transaction.amount<0?COLOR.danger:COLOR.success }}>
          {fmt$(transaction.amount)}
        </div>
        {!selectMode && (
          <div style={{ display:"flex",gap:4,justifyContent:"flex-end",marginTop:4 }}>
            <button onClick={() => onEdit(transaction)} style={{ background:"transparent",border:`1px solid ${t.border}`,borderRadius:5,padding:"2px 7px",color:t.tx2,cursor:"pointer",fontSize:11 }}>Edit</button>
            <button onClick={() => onDelete(transaction.id)} style={{ background:"transparent",border:`1px solid ${COLOR.danger}33`,borderRadius:5,padding:"2px 7px",color:COLOR.danger,cursor:"pointer",fontSize:11 }}>×</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TransactionsTab ──────────────────────────────────────────────────────────
function TransactionsTab({ t, transactions, accounts, categories, rules, apiKey, presetCatId, range, onRangeChange, onUpdateTransactions, onUpdateAccounts, onUpdateRules, onUpdateCategories }) {
  const bp = useBreakpoint();
  const [search,          setSearch]          = useState("");
  const [filterAccId,     setFilterAccId]     = useState("all");
  const [filterCatIds,    setFilterCatIds]    = useState(() => presetCatId ? [presetCatId] : []);
  const [dcFilter,        setDcFilter]        = useState("all");
  const [editTx,          setEditTx]          = useState(null);
  const [showImport,      setShowImport]      = useState(false);
  const [confirmId,       setConfirmId]       = useState(null);
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const [selectMode,      setSelectMode]      = useState(false);
  const [selectedIds,     setSelectedIds]     = useState(new Set());
  const [confirmBatch,    setConfirmBatch]    = useState(false);
  const [sinkingFilter,   setSinkingFilter]   = useState(false);
  const [scanModalOpen,   setScanModalOpen]   = useState(false);
  const [dupCheckState,   setDupCheckState]   = useState(null);

  useEffect(() => { if (presetCatId) setFilterCatIds([presetCatId]); }, [presetCatId]);

  const catMap = Object.fromEntries(categories.map(c => [c.id,c]));
  const accMap = Object.fromEntries(accounts.map(a => [a.id,a]));

  const needsReviewCount = transactions.filter(tx =>
    txInRange(tx, range) && tx.needsReview === true
  ).length;

  const filtered = transactions.filter(tx => {
    if (!txInRange(tx, range)) return false;
    if (filterAccId !== "all" && tx.accountId !== filterAccId) return false;
    if (filterCatIds.length > 0 && !filterCatIds.includes(tx.categoryId)) return false;
    if (dcFilter === "debit"  && tx.amount >= 0) return false;
    if (dcFilter === "credit" && tx.amount <= 0) return false;
    if (sinkingFilter && !tx.isSinkingFundCandidate) return false;
    if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a,b) => b.date.localeCompare(a.date));

  const totalIncome  = filtered.filter(tx => tx.amount > 0).reduce((s,tx) => s+tx.amount, 0);
  const totalExpense = filtered.filter(tx => tx.amount < 0).reduce((s,tx) => s+Math.abs(tx.amount), 0);

  function toggleSelectMode() {
    setSelectMode(m => !m);
    setSelectedIds(new Set());
  }

  function toggleRow(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(tx => tx.id)));
    }
  }

  function handleBatchDelete() {
    onUpdateTransactions(transactions.filter(tx => !selectedIds.has(tx.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    setConfirmBatch(false);
  }

  function handleSaveTx(tx) {
    const orig = transactions.find(t2 => t2.id === tx.id);
    const wasNeedsReview = orig?.needsReview === true;
    const saved = { ...tx, needsReview: false };
    let nextTxns = transactions.find(t2 => t2.id === saved.id)
      ? transactions.map(t2 => t2.id === saved.id ? saved : t2)
      : [...transactions, saved];
    if (wasNeedsReview && saved.description && saved.categoryId && saved.categoryId !== "exp_057") {
      const kw = saved.description.toLowerCase();
      const alreadyExists = rules.find(r => r.keyword.toLowerCase() === kw);
      if (!alreadyExists) {
        const newRule = { id: generateId(), keyword: saved.description, matchType: "contains", categoryId: saved.categoryId, priority: 10 };
        const nextRules = [...rules, newRule];
        onUpdateRules(nextRules);
        nextTxns = nextTxns.map(t2 => {
          if (t2.id === saved.id || t2.categoryLocked) return t2;
          const matched = applyRules(t2.description, nextRules);
          if (matched) return { ...t2, categoryId: matched.categoryId, ruleId: matched.id, needsReview: false };
          return t2;
        });
      }
    }
    onUpdateTransactions(nextTxns);
    setEditTx(null);
  }

  function handleSaveRuleFromModal(rule) {
    const nextRules = rules.find(r => r.id === rule.id)
      ? rules.map(r => r.id === rule.id ? rule : r)
      : [...rules, { ...rule, id: rule.id || generateId() }];
    onUpdateRules(nextRules);
    let count = 0;
    const nextTxns = transactions.map(tx => {
      if (tx.categoryLocked) return tx;
      const matched = applyRules(tx.description, nextRules);
      if (matched && matched.categoryId !== tx.categoryId) { count++; return { ...tx, categoryId: matched.categoryId, ruleId: matched.id, needsReview: false }; }
      return tx;
    });
    if (count > 0) onUpdateTransactions(nextTxns);
  }

  function handleSaveCategoryFromModal(newCat) { onUpdateCategories([...categories, newCat]); }
  function handleDelete(id) { setConfirmId(id); }
  function doDelete(id) { onUpdateTransactions(transactions.filter(t2 => t2.id !== id)); setConfirmId(null); }

  function handleImportComplete(newTxns) {
    const merged = [...transactions];
    for (const tx of newTxns) {
      const clean = { ...tx };
      const replaceId = clean._replaceId;
      delete clean._replaceId;
      if (replaceId) {
        const idx = merged.findIndex(ex => ex.id === replaceId);
        if (idx >= 0) merged[idx] = clean;
        else merged.push(clean);
      } else {
        const dupeIdx = merged.findIndex(ex =>
          ex.date===tx.date &&
          ex.description.toLowerCase()===tx.description.toLowerCase() &&
          Math.abs(ex.amount-tx.amount)<0.01
        );
        if (dupeIdx >= 0) merged[dupeIdx] = clean;
        else merged.push(clean);
      }
    }
    onUpdateTransactions(merged);
    if (newTxns.some(tx => tx.needsReview)) setReviewDismissed(false);
    setShowImport(false);
  }

  function buildScannedTx(receipt, options = {}) {
    return {
      id: generateId(),
      accountId: null,
      date: receipt.date,
      description: receipt.merchant,
      amount: -(Math.abs(parseFloat(receipt.total) || 0)),
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
  }

  function saveScannedTxToList(receipt, currentTxns, options = {}) {
    const newTx = buildScannedTx(receipt, options);
    const updated = [...currentTxns, newTx];
    onUpdateTransactions(updated);
    return updated;
  }

  function processNextReceipt(queue, currentTxns) {
    if (queue.length === 0) return;
    const [receipt, ...rest] = queue;
    const match = findDuplicate(receipt, currentTxns);
    if (match) {
      setDupCheckState({ receipt, match, queue: rest, currentTxns });
    } else {
      const updated = saveScannedTxToList(receipt, currentTxns);
      processNextReceipt(rest, updated);
    }
  }

  function handleScanConfirm(confirmedReceipts) {
    setScanModalOpen(false);
    processNextReceipt(confirmedReceipts, [...transactions]);
  }

  function handleDupSkip() {
    const { match, queue, currentTxns } = dupCheckState;
    const base = currentTxns || transactions;
    const updated = base.map(tx =>
      tx.id === match.id ? { ...tx, reconciled: true, reconciledWith: 'scan' } : tx
    );
    onUpdateTransactions(updated);
    setDupCheckState(null);
    processNextReceipt(queue, updated);
  }

  function handleDupReplace() {
    const { receipt, match, queue, currentTxns } = dupCheckState;
    const base = currentTxns || transactions;
    const filtered = base.filter(tx => tx.id !== match.id);
    setDupCheckState(null);
    const newTx = buildScannedTx(receipt, { reconciled: true, reconciledWith: match.id });
    const updated = [...filtered, newTx];
    onUpdateTransactions(updated);
    processNextReceipt(queue, updated);
  }

  function handleDupKeepBoth() {
    const { receipt, queue, currentTxns } = dupCheckState;
    setDupCheckState(null);
    const updated = saveScannedTxToList(receipt, currentTxns || transactions);
    processNextReceipt(queue, updated);
  }

  const dcBtnStyle = (active) => ({
    background: active ? COLOR.primary : t.surf,
    color: active ? "#fff" : t.tx2,
    border: `1px solid ${active ? COLOR.primary : t.border}`,
    borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontWeight: 600, fontSize: 12,
  });

  const allVisibleSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <div style={{ paddingBottom: selectMode && selectedIds.size > 0 ? 72 : 0 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8 }}>
        <DateRangeSelector t={t} range={range} onChange={onRangeChange} />
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          <button onClick={toggleSelectMode} title={selectMode ? "Exit select mode" : "Select mode"}
            style={{ background:selectMode?COLOR.primary:t.surf,border:`1px solid ${selectMode?COLOR.primary:t.border}`,borderRadius:8,padding:"7px 10px",color:selectMode?"#fff":t.tx1,cursor:"pointer",fontSize:14 }}>☑</button>
          <button onClick={() => setScanModalOpen(true)} title="Scan Receipt"
            style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 10px",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13,whiteSpace:"nowrap" }}>
            {bp.isMobile ? "📷" : "📷 Scan Receipt"}
          </button>
          <button onClick={() => setShowImport(true)} style={{ background:COLOR.primary,border:"none",borderRadius:8,padding:"7px 14px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13 }}>+ Import CSV</button>
          <button onClick={() => setEditTx({})} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 14px",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>+ Add</button>
        </div>
      </div>

      {needsReviewCount > 0 && !reviewDismissed && (
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",background:COLOR.warning+"18",border:`1px solid ${COLOR.warning}55`,borderRadius:10,padding:"10px 14px",marginBottom:12 }}>
          <div>
            <span style={{ fontWeight:700,fontSize:13,color:COLOR.warning }}>⚠ {needsReviewCount} transaction{needsReviewCount>1?"s":""} need review</span>
            <span style={{ fontSize:12,color:t.tx2,marginLeft:8 }}>AI low-confidence — click Edit on flagged rows to confirm</span>
          </div>
          <button onClick={() => setReviewDismissed(true)} style={{ background:"transparent",border:"none",color:t.tx3,cursor:"pointer",fontSize:16,lineHeight:1,padding:"0 4px" }}>×</button>
        </div>
      )}

      <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap" }}>
        <div style={{ background:COLOR.success+"18",border:`1px solid ${COLOR.success}33`,borderRadius:10,padding:"8px 16px" }}>
          <div style={{ fontSize:11,color:COLOR.success,fontWeight:600 }}>INCOME</div>
          <div style={{ fontFamily:"monospace",fontWeight:800,fontSize:16,color:COLOR.success }}>{fmt$(totalIncome)}</div>
        </div>
        <div style={{ background:COLOR.danger+"18",border:`1px solid ${COLOR.danger}33`,borderRadius:10,padding:"8px 16px" }}>
          <div style={{ fontSize:11,color:COLOR.danger,fontWeight:600 }}>EXPENSES</div>
          <div style={{ fontFamily:"monospace",fontWeight:800,fontSize:16,color:COLOR.danger }}>{fmt$(totalExpense)}</div>
        </div>
        <div style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"8px 16px" }}>
          <div style={{ fontSize:11,color:t.tx2,fontWeight:600 }}>NET</div>
          <div style={{ fontFamily:"monospace",fontWeight:800,fontSize:16,color:totalIncome-totalExpense>=0?COLOR.success:COLOR.danger }}>{fmt$(totalIncome-totalExpense)}</div>
        </div>
      </div>

      <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center" }}>
        {selectMode && (
          <label style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:t.tx1,padding:"7px 10px",background:t.surf,borderRadius:8,border:`1px solid ${t.border}` }}>
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll}
              style={{ width:15,height:15,accentColor:COLOR.primary,cursor:"pointer" }} />
            Select All
          </label>
        )}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          style={{ flex:1,minWidth:120,background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 12px",color:t.tx1,fontSize:13 }} />
        <select value={filterAccId} onChange={e => setFilterAccId(e.target.value)}
          style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 10px",color:t.tx1,fontSize:13 }}>
          <option value="all">All accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.nickname}</option>)}
        </select>
        <CategoryMultiSelect t={t} categories={categories} selectedIds={filterCatIds} onChange={setFilterCatIds} />
        <div style={{ display:"flex",gap:4 }}>
          <button style={dcBtnStyle(dcFilter==="all")}    onClick={() => setDcFilter("all")}>All</button>
          <button style={dcBtnStyle(dcFilter==="debit")}  onClick={() => setDcFilter("debit")}>Debit</button>
          <button style={dcBtnStyle(dcFilter==="credit")} onClick={() => setDcFilter("credit")}>Credit</button>
        </div>
        <button
          onClick={() => setSinkingFilter(f => !f)}
          style={{ background:sinkingFilter?COLOR.warning:t.surf, color:sinkingFilter?"#fff":t.tx2, border:`1px solid ${sinkingFilter?COLOR.warning:t.border}`, borderRadius:7, padding:"5px 12px", cursor:"pointer", fontWeight:600, fontSize:12, whiteSpace:"nowrap" }}>
          Sinking Funds 🎯
        </button>
      </div>

      <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,padding:"0 16px" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign:"center",padding:"32px 0",color:t.tx2,fontSize:13 }}>No transactions found.</div>
        )}
        {filtered.map(tx => (
          <TransactionRow key={tx.id} t={t} transaction={tx} account={accMap[tx.accountId]} category={catMap[tx.categoryId]}
            selectMode={selectMode} selected={selectedIds.has(tx.id)} onToggle={toggleRow}
            onEdit={tx2 => setEditTx(tx2)} onDelete={handleDelete} />
        ))}
      </div>

      {selectMode && selectedIds.size > 0 && (
        <div style={{ position:"fixed",bottom:0,left:0,right:0,background:t.panelBg,borderTop:`1px solid ${t.border}`,padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",zIndex:200,boxShadow:"0 -4px 20px rgba(0,0,0,.25)" }}>
          <span style={{ fontSize:13,color:t.tx1,fontWeight:600 }}>{selectedIds.size} selected</span>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
              style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 16px",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Cancel</button>
            <button onClick={() => setConfirmBatch(true)}
              style={{ background:COLOR.danger,border:"none",borderRadius:8,padding:"7px 16px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13 }}>
              Delete {selectedIds.size}
            </button>
          </div>
        </div>
      )}

      {editTx !== null && (
        <TransactionModal t={t} transaction={editTx.id ? editTx : null} accounts={accounts} categories={categories}
          rules={rules} onSave={handleSaveTx} onSaveRule={handleSaveRuleFromModal}
          onSaveCategory={handleSaveCategoryFromModal} onClose={() => setEditTx(null)} />
      )}
      {showImport && (
        <ImportWizard t={t} accounts={accounts} categories={categories} rules={rules}
          transactions={transactions} apiKey={apiKey}
          onComplete={handleImportComplete} onClose={() => setShowImport(false)}
          onUpdateAccounts={onUpdateAccounts} />
      )}
      {confirmId && <ConfirmModal t={t} message="Delete this transaction?" onConfirm={() => doDelete(confirmId)} onCancel={() => setConfirmId(null)} />}
      {confirmBatch && <ConfirmModal t={t} message={`Delete ${selectedIds.size} selected transaction${selectedIds.size>1?"s":""}? This cannot be undone.`} onConfirm={handleBatchDelete} onCancel={() => setConfirmBatch(false)} />}
      {scanModalOpen && (
        <ReceiptScanModal
          open={scanModalOpen}
          onClose={() => setScanModalOpen(false)}
          onConfirm={handleScanConfirm}
          apiKey={apiKey}
          categories={categories}
          t={t}
          isMobile={bp.isMobile}
        />
      )}
      {dupCheckState && (
        <DuplicateCheckModal
          open={!!dupCheckState}
          receipt={dupCheckState?.receipt}
          match={dupCheckState?.match}
          onSkip={handleDupSkip}
          onReplace={handleDupReplace}
          onKeepBoth={handleDupKeepBoth}
          t={t}
        />
      )}
    </div>
  );
}

// ─── RollupPanel ──────────────────────────────────────────────────────────────
function RollupPanel({ t, transactions, range, onNavigateMonth }) {
  const refMonth = range.mode === "month" ? range.month : range.end;
  const months = [refMonth, prevMonth(refMonth), prevMonth(prevMonth(refMonth))];
  const labels = ["Current", "Prior Month", "2 Months Ago"];

  const cols = months.map(m => {
    const txs = transactions.filter(tx => tx.date?.startsWith(m));
    const inc = txs.filter(tx => tx.amount > 0).reduce((s,tx) => s+tx.amount, 0);
    const exp = txs.filter(tx => tx.amount < 0).reduce((s,tx) => s+Math.abs(tx.amount), 0);
    return { month: m, income: inc, expenses: exp, net: inc - exp, hasData: txs.length > 0 };
  });

  function trendIcon(curr, prev, higherIsBetter) {
    if (!prev) return null;
    const improved = higherIsBetter ? curr >= prev : curr <= prev;
    return <span style={{ color: improved ? COLOR.success : COLOR.danger, fontSize: 11 }}>{curr >= prev ? " ▲" : " ▼"}</span>;
  }

  return (
    <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,padding:16,marginBottom:16 }}>
      <div style={{ fontSize:11,color:t.tx2,fontWeight:700,marginBottom:12,letterSpacing:0.5 }}>3-MONTH ROLLUP</div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8 }}>
        {cols.map((col,i) => {
          const prevCol = i < cols.length-1 ? cols[i+1] : null;
          return (
            <div key={col.month} onClick={() => onNavigateMonth && onNavigateMonth(col.month)}
              style={{ background:i===0?COLOR.primary+"15":t.surf,border:`2px solid ${i===0?COLOR.primary:t.border}`,borderRadius:12,padding:"12px 8px",cursor:"pointer",textAlign:"center",transition:"all .15s" }}>
              <div style={{ fontSize:9,color:i===0?COLOR.primary:t.tx3,fontWeight:700,marginBottom:2,textTransform:"uppercase",letterSpacing:0.5 }}>{labels[i]}</div>
              <div style={{ fontSize:10,color:t.tx2,marginBottom:8 }}>{getMonthLabel(col.month)}</div>
              {!col.hasData ? (
                <div style={{ fontSize:11,color:t.tx3,padding:"8px 0" }}>No data</div>
              ) : (
                <>
                  <div style={{ fontSize:11,fontFamily:"monospace",color:COLOR.success,fontWeight:700,marginBottom:3 }}>
                    {fmt$(col.income)}{prevCol && trendIcon(col.income, prevCol.income, true)}
                  </div>
                  <div style={{ fontSize:11,fontFamily:"monospace",color:COLOR.danger,fontWeight:700,marginBottom:6 }}>
                    {fmt$(col.expenses)}{prevCol && trendIcon(col.expenses, prevCol.expenses, false)}
                  </div>
                  <div style={{ height:1,background:t.border,margin:"0 0 6px" }} />
                  <div style={{ fontSize:13,fontFamily:"monospace",fontWeight:800,color:col.net>=0?COLOR.success:COLOR.danger }}>
                    {fmt$(col.net)}
                  </div>
                  <div style={{ fontSize:9,color:t.tx3,marginTop:2,letterSpacing:0.5 }}>NET</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── EssentialTagsModal ───────────────────────────────────────────────────────
function EssentialTagsModal({ t, categories, onUpdateCategories, onRecalcBaseline, onClose }) {
  const taggable = categories.filter(c => c.section !== "Income" && c.id !== "trn_001");
  function toggle(catId) {
    const updated = categories.map(c => c.id === catId ? { ...c, isEssential: !c.isEssential } : c);
    onUpdateCategories(updated);
    onRecalcBaseline(updated);
  }
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:16 }}>
      <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:18,padding:24,width:"100%",maxWidth:520,maxHeight:"80vh",display:"flex",flexDirection:"column",gap:0 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontWeight:700,fontSize:15,color:t.tx1 }}>Edit Essential Tags</div>
          <button onClick={onClose} style={{ background:"transparent",border:"none",color:t.tx2,cursor:"pointer",fontSize:20,lineHeight:1,padding:"0 4px" }}>×</button>
        </div>
        <div style={{ fontSize:12,color:t.tx2,marginBottom:12 }}>Toggle which categories count toward your minimum cost of living baseline.</div>
        <div style={{ overflowY:"auto",flex:1 }}>
          {taggable.map(c => (
            <div key={c.id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 4px",borderBottom:`1px solid ${t.border}` }}>
              <span style={{ fontSize:13,color:t.tx1 }}>{c.icon} {c.name}</span>
              <button onClick={() => toggle(c.id)} style={{
                background: c.isEssential ? "#10b981" : t.surf,
                color: c.isEssential ? "#fff" : t.tx2,
                border: `1px solid ${c.isEssential ? "#10b981" : t.border2}`,
                borderRadius: 20, padding: "3px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
              }}>{c.isEssential ? "Essential" : "Discretionary"}</button>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop:16,background:COLOR.primary,border:"none",borderRadius:10,padding:"10px 0",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer" }}>Done</button>
      </div>
    </div>
  );
}

// ─── AiTagModal ───────────────────────────────────────────────────────────────
function AiTagModal({ t, categories, apiKey, onUpdateCategories, onRecalcBaseline, onClose }) {
  const [stage, setStage] = useState("confirm"); // "confirm" | "loading" | "review" | "error"
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [errMsg, setErrMsg] = useState(null);

  async function runAnalysis() {
    if (!apiKey) { setErrMsg("No API key configured."); setStage("error"); return; }
    setStage("loading");
    try {
      const taggable = categories.filter(c => c.section !== "Income" && c.id !== "trn_001");
      const systemPrompt = `You are a personal finance assistant. The user has a list of spending categories. Your job is to classify each one as "essential" (minimum cost of living — housing, utilities, food, insurance, required debt payments) or "discretionary" (nice-to-have, reducible in a financial emergency). Return ONLY a JSON array. No explanation. Format: [{"id":"exp_001","essential":true}, ...]`;
      const userPrompt = `Classify these spending categories:\n${taggable.map(c => `{"id":"${c.id}","name":"${c.name}","section":"${c.section}"}`).join("\n")}`;
      const res = await callClaude(apiKey, {
        model: MODEL, max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("no JSON array in response");
      const parsed = JSON.parse(jsonMatch[0]);
      const diffs = parsed.filter(item => {
        const cat = categories.find(c => c.id === item.id);
        return cat && cat.isEssential !== item.essential;
      }).map(item => {
        const cat = categories.find(c => c.id === item.id);
        return { id: item.id, name: cat.name, icon: cat.icon, current: cat.isEssential, suggested: item.essential };
      });
      setSuggestions(diffs);
      setSelected(new Set(diffs.map(d => d.id)));
      setStage("review");
    } catch(e) {
      setErrMsg(e.message.includes("no JSON") ? "Couldn't parse AI response. Try again." : `AI error: ${e.message}`);
      setStage("error");
    }
  }

  function applySelected() {
    const updated = categories.map(c => {
      const s = suggestions.find(d => d.id === c.id && selected.has(c.id));
      return s ? { ...c, isEssential: s.suggested } : c;
    });
    onUpdateCategories(updated);
    onRecalcBaseline(updated);
    onClose();
  }

  if (stage === "confirm") return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:16 }}>
      <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:18,padding:28,width:"100%",maxWidth:420 }}>
        <div style={{ fontWeight:700,fontSize:15,color:t.tx1,marginBottom:10 }}>Let AI review your categories</div>
        <div style={{ fontSize:13,color:t.tx2,marginBottom:20,lineHeight:1.6 }}>Claude will look at your category names and suggest which ones are essential (minimum cost of living) vs. discretionary. You review and confirm before anything changes.</div>
        <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:9,padding:"8px 20px",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Cancel</button>
          <button onClick={runAnalysis} style={{ background:COLOR.primary,border:"none",borderRadius:9,padding:"8px 20px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13 }}>Analyze My Categories</button>
        </div>
      </div>
    </div>
  );

  if (stage === "loading") return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400 }}>
      <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:18,padding:36,display:"flex",flexDirection:"column",alignItems:"center",gap:16 }}>
        <div style={{ width:36,height:36,border:"3px solid #6366f1",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite" }} />
        <div style={{ color:t.tx2,fontSize:13 }}>Analyzing categories…</div>
      </div>
    </div>
  );

  if (stage === "error") return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:16 }}>
      <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:18,padding:28,width:"100%",maxWidth:380 }}>
        <div style={{ color:COLOR.danger,fontWeight:700,marginBottom:12 }}>{errMsg}</div>
        <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:9,padding:"8px 20px",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Close</button>
          <button onClick={() => setStage("confirm")} style={{ background:COLOR.primary,border:"none",borderRadius:9,padding:"8px 20px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13 }}>Try Again</button>
        </div>
      </div>
    </div>
  );

  // stage === "review"
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:16 }}>
      <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:18,padding:24,width:"100%",maxWidth:560,maxHeight:"80vh",display:"flex",flexDirection:"column" }}>
        <div style={{ fontWeight:700,fontSize:15,color:t.tx1,marginBottom:4 }}>Review AI Suggestions</div>
        <div style={{ fontSize:12,color:t.tx2,marginBottom:12 }}>{suggestions.length} change{suggestions.length!==1?"s":""} suggested — select which to apply</div>
        {suggestions.length === 0 ? (
          <div style={{ color:t.tx2,fontSize:13,padding:"16px 0" }}>No changes suggested — your tags look good!</div>
        ) : (
          <div style={{ overflowY:"auto",flex:1,marginBottom:12 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr auto auto",gap:"6px 12px",fontSize:12,color:t.tx3,fontWeight:700,padding:"4px 4px 8px",borderBottom:`1px solid ${t.border}` }}>
              <span>Category</span><span>Current</span><span>AI Suggests</span>
            </div>
            {suggestions.map(s => (
              <div key={s.id} onClick={() => setSelected(sel => { const n = new Set(sel); n.has(s.id)?n.delete(s.id):n.add(s.id); return n; })}
                style={{ display:"grid",gridTemplateColumns:"1fr auto auto",gap:"6px 12px",alignItems:"center",padding:"8px 4px",borderBottom:`1px solid ${t.border}`,cursor:"pointer",background:selected.has(s.id)?COLOR.primary+"12":"transparent" }}>
                <span style={{ fontSize:13,color:t.tx1 }}><input type="checkbox" readOnly checked={selected.has(s.id)} style={{ accentColor:COLOR.primary,marginRight:8,pointerEvents:"none" }} />{s.icon} {s.name}</span>
                <span style={{ fontSize:11,color:s.current?"#10b981":t.tx3,fontWeight:600 }}>{s.current?"Essential":"Discret."}</span>
                <span style={{ fontSize:11,color:s.suggested?"#10b981":t.tx3,fontWeight:700 }}>→ {s.suggested?"Essential":"Discret."}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap" }}>
          <button onClick={onClose} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:9,padding:"8px 16px",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Cancel</button>
          {suggestions.length > 0 && (
            <>
              <button onClick={() => setSelected(new Set(suggestions.map(s=>s.id)))} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:9,padding:"8px 16px",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Select All</button>
              <button onClick={applySelected} disabled={selected.size===0} style={{ background:selected.size>0?COLOR.primary:"#334155",border:"none",borderRadius:9,padding:"8px 16px",color:"#fff",cursor:selected.size>0?"pointer":"default",fontWeight:700,fontSize:13 }}>Apply {selected.size > 0 ? `(${selected.size})` : ""}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── BaselinePanel ────────────────────────────────────────────────────────────
function BaselinePanel({ t, transactions, categories, apiKey, onUpdateCategories, onRecalcBaseline }) {
  const [showTags, setShowTags]   = useState(false);
  const [showAi, setShowAi]       = useState(false);
  const [expanded, setExpanded]   = useState(false);

  const baseline = computeBaseline(transactions, categories);
  const { amount, breakdown } = baseline;
  const top5 = breakdown.slice(0, 5);
  const rest = breakdown.slice(5);

  return (
    <div style={{ background:t.panelBg,border:`1px solid ${"#10b981"}44`,borderRadius:14,padding:16,marginBottom:16 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:amount>0?14:0 }}>
        <div>
          <div style={{ fontSize:11,color:"#10b981",fontWeight:700,letterSpacing:0.5 }}>BASELINE MONTHLY EXPENSES</div>
          <div style={{ fontSize:10,color:t.tx3,marginTop:1 }}>Estimated minimum cost of living · 3-month rolling avg · essential categories</div>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={() => setShowTags(true)} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"5px 12px",color:t.tx1,cursor:"pointer",fontSize:12,fontWeight:600 }}>Edit Essential Tags</button>
          <button onClick={() => setShowAi(true)} style={{ background:"#10b981"+"18",border:`1px solid ${"#10b981"}44`,borderRadius:8,padding:"5px 12px",color:"#10b981",cursor:"pointer",fontSize:12,fontWeight:600 }}>AI Tag Help</button>
        </div>
      </div>

      {amount === 0 ? (
        <div style={{ fontSize:13,color:t.tx2,padding:"8px 0" }}>No essential expense data in the last 3 months. Add transactions or adjust your essential category tags.</div>
      ) : (
        <>
          <div style={{ fontFamily:"monospace",fontWeight:800,fontSize:26,color:"#10b981",marginBottom:14 }}>{fmt$(amount)}<span style={{ fontSize:12,fontWeight:400,color:t.tx2,marginLeft:6 }}>/ mo</span></div>
          <div>
            {top5.map(item => (
              <div key={item.catId} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                <span style={{ fontSize:13,minWidth:20 }}>{item.icon}</span>
                <span style={{ fontSize:12,color:t.tx1,minWidth:140,flexShrink:0 }}>{item.catName}</span>
                <div style={{ flex:1,background:t.surf,borderRadius:4,height:6,overflow:"hidden" }}>
                  <div style={{ width:`${Math.min((item.avg/amount)*100,100)}%`,height:"100%",background:item.color||"#10b981",borderRadius:4 }} />
                </div>
                <span style={{ fontSize:12,fontFamily:"monospace",color:t.tx2,minWidth:64,textAlign:"right" }}>{fmt$(item.avg)}</span>
              </div>
            ))}
            {rest.length > 0 && expanded && rest.map(item => (
              <div key={item.catId} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                <span style={{ fontSize:13,minWidth:20 }}>{item.icon}</span>
                <span style={{ fontSize:12,color:t.tx1,minWidth:140,flexShrink:0 }}>{item.catName}</span>
                <div style={{ flex:1,background:t.surf,borderRadius:4,height:6,overflow:"hidden" }}>
                  <div style={{ width:`${Math.min((item.avg/amount)*100,100)}%`,height:"100%",background:item.color||"#10b981",borderRadius:4 }} />
                </div>
                <span style={{ fontSize:12,fontFamily:"monospace",color:t.tx2,minWidth:64,textAlign:"right" }}>{fmt$(item.avg)}</span>
              </div>
            ))}
            {rest.length > 0 && (
              <button onClick={() => setExpanded(e => !e)} style={{ background:"transparent",border:"none",color:t.tx3,cursor:"pointer",fontSize:12,padding:"4px 0" }}>
                {expanded ? "Show less ▲" : `Show all ${breakdown.length} ▼`}
              </button>
            )}
          </div>
        </>
      )}

      {showTags && (
        <EssentialTagsModal t={t} categories={categories} onUpdateCategories={onUpdateCategories} onRecalcBaseline={onRecalcBaseline} onClose={() => setShowTags(false)} />
      )}
      {showAi && (
        <AiTagModal t={t} categories={categories} apiKey={apiKey} onUpdateCategories={onUpdateCategories} onRecalcBaseline={onRecalcBaseline} onClose={() => setShowAi(false)} />
      )}
    </div>
  );
}

// ─── SummaryTab ───────────────────────────────────────────────────────────────
function SummaryTab({ t, transactions, categories, range, onRangeChange, onNavigateToCategory, onNavigateMonth, apiKey, onUpdateCategories, onRecalcBaseline }) {
  const catMap = Object.fromEntries(categories.map(c => [c.id,c]));
  const refMonth = range.mode === "month" ? range.month : range.end;

  const visibleTxns = transactions.filter(tx => txInRange(tx, range));

  const incomeBycat = {};
  const expBycat = {};
  for (const tx of visibleTxns) {
    if (tx.amount > 0) accumulateTx(tx, incomeBycat);
    else if (tx.amount < 0) accumulateTx(tx, expBycat);
  }

  const totalMonthlyIncome  = Object.values(incomeBycat).reduce((s,v) => s+v, 0);
  const totalMonthlyExpense = Object.values(expBycat).reduce((s,v) => s+v, 0);
  const bp = useBreakpoint();
  const barBase = totalMonthlyIncome > 0 ? totalMonthlyIncome : totalMonthlyExpense;

  const incomeRows = Object.entries(incomeBycat)
    .map(([catId, amount]) => ({ catId, amount, avg: computeRollingAvgIncome(transactions, catId, refMonth, 3) }))
    .sort((a,b) => b.amount - a.amount);

  const expenseRows = Object.entries(expBycat)
    .map(([catId, spent]) => ({ catId, spent, avg: computeRollingAvg(transactions, catId, refMonth, 3) }))
    .sort((a,b) => b.spent - a.spent);

  const totalExpense    = expenseRows.reduce((s,r) => s+r.spent, 0);
  const totalExpenseAvg = expenseRows.reduce((s,r) => s+r.avg, 0);

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8 }}>
        <DateRangeSelector t={t} range={range} onChange={onRangeChange} />
        <div style={{ fontSize:12,color:t.tx2 }}>— avg marker · click category to filter transactions</div>
      </div>

      <RollupPanel t={t} transactions={transactions} range={range} onNavigateMonth={onNavigateMonth} />

      <div style={{ display:"grid",gridTemplateColumns:bp.isMobile?"1fr 1fr":"1fr 1fr 1fr",gap:10,marginBottom:16 }}>
        <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 16px" }}>
          <div style={{ fontSize:11,color:t.tx2,fontWeight:600 }}>INCOME</div>
          <div style={{ fontFamily:"monospace",fontWeight:800,fontSize:20,color:COLOR.success }}>{fmt$(totalMonthlyIncome)}</div>
        </div>
        <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 16px" }}>
          <div style={{ fontSize:11,color:t.tx2,fontWeight:600 }}>EXPENSES</div>
          <div style={{ fontFamily:"monospace",fontWeight:800,fontSize:20,color:COLOR.danger }}>{fmt$(totalMonthlyExpense)}</div>
        </div>
        <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 16px",gridColumn:bp.isMobile?"1 / -1":"auto" }}>
          <div style={{ fontSize:11,color:t.tx2,fontWeight:600 }}>3-MO AVG EXP</div>
          <div style={{ fontFamily:"monospace",fontWeight:800,fontSize:20,color:t.tx1 }}>{fmt$(totalExpenseAvg)}</div>
        </div>
      </div>

      <BaselinePanel t={t} transactions={transactions} categories={categories} apiKey={apiKey} onUpdateCategories={onUpdateCategories} onRecalcBaseline={onRecalcBaseline} />

      {incomeRows.length > 0 && (
        <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,overflow:"hidden",marginBottom:16 }}>
          <div style={{ display:"flex",alignItems:"center",padding:"8px 16px",borderBottom:`1px solid ${t.border}`,background:COLOR.success+"12" }}>
            <span style={{ fontSize:11,color:COLOR.success,fontWeight:700 }}>INCOME CATEGORIES</span>
            <div style={{ flex:1 }} />
            <span style={{ fontSize:10,color:t.tx2 }}>— avg</span>
          </div>
          {incomeRows.map(r => (
            <CategoryBarRow key={r.catId} t={t} cat={catMap[r.catId]} value={r.amount} avg={r.avg} barBase={barBase} isIncome={true}
              onClick={() => onNavigateToCategory && onNavigateToCategory(r.catId)} />
          ))}
        </div>
      )}

      <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,overflow:"hidden" }}>
        <div style={{ display:"flex",alignItems:"center",padding:"8px 16px",borderBottom:`1px solid ${t.border}`,background:COLOR.danger+"12" }}>
          <span style={{ fontSize:11,color:COLOR.danger,fontWeight:700 }}>EXPENSE CATEGORIES</span>
          <div style={{ flex:1 }} />
          <span style={{ fontSize:10,color:t.tx2 }}>— avg</span>
        </div>
        {expenseRows.length === 0 && (
          <div style={{ textAlign:"center",padding:"24px 0",color:t.tx2,fontSize:13 }}>No spending this period.</div>
        )}
        {expenseRows.map(r => (
          <CategoryBarRow key={r.catId} t={t} cat={catMap[r.catId]} value={r.spent} avg={r.avg} barBase={barBase} isIncome={false}
            onClick={() => onNavigateToCategory && onNavigateToCategory(r.catId)} />
        ))}
      </div>
    </div>
  );
}

// ─── RulesTab ─────────────────────────────────────────────────────────────────
function RulesTab({ t, rules, categories, transactions, apiKey, onUpdateRules, onUpdateTransactions }) {
  const [editRule,     setEditRule]     = useState(null);
  const [confirmId,    setConfirmId]    = useState(null);
  const [suggesting,   setSuggesting]   = useState(false);
  const [suggestErr,   setSuggestErr]   = useState(null);
  const [applyMsg,     setApplyMsg]     = useState(null);

  const catMap = Object.fromEntries(categories.map(c => [c.id,c]));

  async function handleSuggestRules() {
    if (!apiKey) { setSuggestErr("No API key configured."); return; }
    setSuggesting(true);
    setSuggestErr(null);
    try {
      const sample = transactions
        .filter(tx => tx.amount < 0 && !tx.categoryLocked)
        .slice(0, 60)
        .map(tx => tx.description);
      if (sample.length === 0) { setSuggestErr("No uncategorized transactions to learn from."); setSuggesting(false); return; }
      const catList = categories.map(c => `${c.id}: ${c.name}`).join("\n");
      const prompt = `You are a personal finance assistant. Suggest categorization rules based on these transaction descriptions.

Available categories:
${catList}

Transaction descriptions:
${[...new Set(sample)].slice(0,60).map((d,i) => `${i}: "${d}"`).join("\n")}

Return up to 15 rules as JSON array, no explanation:
[{"keyword":"amazon","matchType":"contains","categoryId":"exp_034","priority":10}]

matchType: "contains" | "startsWith" | "exact"
Only suggest rules you're confident about.`;

      const res = await callClaude(apiKey, {
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role:"user", content: prompt }]
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || "[]";
      const match = text.match(/\[[\s\S]*\]/);
      const suggested = match ? JSON.parse(match[0]) : [];
      const newRules = suggested
        .filter(r => r.keyword && r.categoryId && categories.find(c => c.id === r.categoryId))
        .filter(r => !rules.find(ex => ex.keyword.toLowerCase() === r.keyword.toLowerCase()))
        .map(r => ({ ...r, id: generateId() }));
      if (newRules.length === 0) {
        setSuggestErr("No new rules suggested.");
      } else {
        onUpdateRules([...rules, ...newRules]);
        setSuggestErr(`Added ${newRules.length} new rule${newRules.length>1?"s":""}.`);
      }
    } catch (e) {
      setSuggestErr(aiErrorMsg(e));
    }
    setSuggesting(false);
  }

  function applyRulesRetroactive(updatedRules) {
    let count = 0;
    const next = transactions.map(tx => {
      if (tx.categoryLocked) return tx;
      const matched = applyRules(tx.description, updatedRules);
      if (matched && matched.categoryId !== tx.categoryId) {
        count++;
        return { ...tx, categoryId: matched.categoryId, ruleId: matched.id, needsReview: false };
      }
      return tx;
    });
    if (count > 0) {
      onUpdateTransactions(next);
      setApplyMsg(`Rule applied — ${count} transaction${count > 1 ? "s" : ""} updated`);
      setTimeout(() => setApplyMsg(null), 4000);
    }
  }

  function handleSaveRule(rule) {
    let nextRules;
    const idx = rules.findIndex(r => r.id === rule.id);
    if (idx >= 0) {
      nextRules = [...rules]; nextRules[idx] = rule;
    } else {
      nextRules = [...rules, rule];
    }
    onUpdateRules(nextRules);
    setEditRule(null);
    applyRulesRetroactive(nextRules);
  }

  function doDelete(id) {
    onUpdateRules(rules.filter(r => r.id !== id));
    setConfirmId(null);
  }

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8 }}>
        <div style={{ fontWeight:700,fontSize:15,color:t.tx1 }}>Auto-Categorization Rules</div>
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={handleSuggestRules} disabled={suggesting}
            style={{ background:COLOR.purple,border:"none",borderRadius:8,padding:"7px 14px",color:"#fff",cursor:suggesting?"default":"pointer",fontWeight:700,fontSize:13,opacity:suggesting?0.7:1 }}>
            {suggesting ? "Thinking…" : "✨ AI Suggest"}
          </button>
          <button onClick={() => setEditRule({})} style={{ background:COLOR.primary,border:"none",borderRadius:8,padding:"7px 14px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13 }}>+ Add Rule</button>
        </div>
      </div>
      {suggestErr && (
        <div style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:t.tx2,marginBottom:12 }}>{suggestErr}</div>
      )}
      {applyMsg && (
        <div style={{ background:COLOR.success+"18",border:`1px solid ${COLOR.success}44`,borderRadius:8,padding:"8px 12px",fontSize:13,color:COLOR.success,fontWeight:600,marginBottom:12 }}>✓ {applyMsg}</div>
      )}
      <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,overflow:"hidden" }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 80px 1fr 50px 80px",padding:"8px 16px",borderBottom:`1px solid ${t.border}`,gap:8 }}>
          <span style={{ fontSize:11,color:t.tx2,fontWeight:600 }}>KEYWORD</span>
          <span style={{ fontSize:11,color:t.tx2,fontWeight:600 }}>MATCH</span>
          <span style={{ fontSize:11,color:t.tx2,fontWeight:600 }}>CATEGORY</span>
          <span style={{ fontSize:11,color:t.tx2,fontWeight:600 }}>PRI</span>
          <span style={{ fontSize:11,color:t.tx2,fontWeight:600 }}></span>
        </div>
        {rules.length === 0 && (
          <div style={{ textAlign:"center",padding:"24px 0",color:t.tx2,fontSize:13 }}>No rules yet. Add one or use AI Suggest.</div>
        )}
        {[...rules].sort((a,b) => (a.priority||0)-(b.priority||0)).map(rule => (
          <div key={rule.id} style={{ display:"grid",gridTemplateColumns:"1fr 80px 1fr 50px 80px",padding:"10px 16px",borderBottom:`1px solid ${t.border}`,gap:8,alignItems:"center" }}>
            <span style={{ fontSize:13,color:t.tx1,fontWeight:600 }}>{rule.keyword}</span>
            <span style={{ fontSize:11,color:t.tx2 }}>{rule.matchType||"contains"}</span>
            <CategoryPill category={catMap[rule.categoryId]} />
            <span style={{ fontSize:12,color:t.tx3,textAlign:"center" }}>{rule.priority||0}</span>
            <div style={{ display:"flex",gap:4 }}>
              <button onClick={() => setEditRule(rule)} style={{ background:"transparent",border:`1px solid ${t.border}`,borderRadius:5,padding:"3px 7px",color:t.tx2,cursor:"pointer",fontSize:11 }}>Edit</button>
              <button onClick={() => setConfirmId(rule.id)} style={{ background:"transparent",border:`1px solid ${COLOR.danger}33`,borderRadius:5,padding:"3px 7px",color:COLOR.danger,cursor:"pointer",fontSize:11 }}>×</button>
            </div>
          </div>
        ))}
      </div>
      {editRule !== null && <RuleModal t={t} rule={editRule.id ? editRule : null} categories={categories} onSave={handleSaveRule} onClose={() => setEditRule(null)} />}
      {confirmId && <ConfirmModal t={t} message="Delete this rule?" onConfirm={() => doDelete(confirmId)} onCancel={() => setConfirmId(null)} />}
    </div>
  );
}

// ─── TrendsTab ────────────────────────────────────────────────────────────────
function TrendsTab({ t, transactions, categories, range, onNavigateToTxMonth }) {
  const [windowSize,   setWindowSize]   = useState(3);
  const [windowOffset, setWindowOffset] = useState(0);

  const refMonth = range.mode === "month" ? range.month : range.end;
  const CHART_COLORS = [COLOR.primary, COLOR.pink, COLOR.orange, COLOR.teal, COLOR.purple, COLOR.blue];

  // Build display months: windowSize months ending at refMonth - windowOffset
  const endMonth = (function() {
    let m = refMonth;
    for (let i = 0; i < windowOffset; i++) m = prevMonth(m);
    return m;
  })();
  const displayMonths = [];
  let cur = endMonth;
  for (let i = 0; i < windowSize; i++) { displayMonths.unshift(cur); cur = prevMonth(cur); }

  const catMap = Object.fromEntries(categories.map(c => [c.id,c]));

  const monthData = displayMonths.map(m => {
    const txs = transactions.filter(tx => tx.date?.startsWith(m));
    const totalExpense = txs.filter(tx => tx.amount < 0).reduce((s,tx) => s+Math.abs(tx.amount), 0);
    const totalIncome  = txs.filter(tx => tx.amount > 0).reduce((s,tx) => s+tx.amount, 0);
    const byCat = {};
    for (const tx of txs.filter(tx => tx.amount < 0)) {
      accumulateTx(tx, byCat);
    }
    return { month: m, totalExpense, totalIncome, byCat };
  });

  const catTotals = {};
  for (const md of monthData) {
    for (const [cid, amt] of Object.entries(md.byCat)) {
      catTotals[cid] = (catTotals[cid]||0) + amt;
    }
  }
  const topCats = Object.entries(catTotals).sort((a,b) => b[1]-a[1]).slice(0,6).map(([id]) => id);
  const hasOther = Object.keys(catTotals).length > 6;

  const svgW = 520, svgH = 160, padL = 56, padR = 16, padT = 12, padB = 36;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;
  const maxExp = Math.max(...monthData.map(d => d.totalExpense), 1);

  function xPos(i) { return padL + (displayMonths.length > 1 ? (chartW / (displayMonths.length-1)) * i : chartW / 2); }
  function yPos(val) { return padT + chartH - (val / maxExp) * chartH; }

  const barSvgH = 180, barPadT = 12, barPadB = 36, barPadL = 56, barPadR = 16;
  const barChartW = svgW - barPadL - barPadR;
  const barChartH = barSvgH - barPadT - barPadB;
  const maxBarTotal = Math.max(...monthData.map(d => d.totalExpense), 1);
  const barGroupW = barChartW / Math.max(displayMonths.length, 1);
  const totalBars = topCats.length + (hasOther ? 1 : 0);
  const barW = Math.min(barGroupW * 0.8 / Math.max(totalBars, 1), 22);

  function shortMonth(ym) {
    const [y,m] = ym.split("-");
    return new Date(+y,+m-1,1).toLocaleString("en-US",{month:"short"}) + " '" + y.slice(2);
  }

  function fmtShort(n) {
    if (n >= 1000) return "$" + (n/1000).toFixed(1) + "k";
    return "$" + Math.round(n);
  }

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8 }}>
        <div style={{ fontWeight:700,fontSize:15,color:t.tx1 }}>Spending Trends</div>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <button onClick={() => setWindowOffset(o => o+1)}
            style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 11px",color:t.tx1,cursor:"pointer",fontSize:14 }}>‹</button>
          <select value={windowSize} onChange={e => setWindowSize(Number(e.target.value))}
            style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 10px",color:t.tx1,fontSize:13 }}>
            {[3,6,9,12].map(n => <option key={n} value={n}>{n} months</option>)}
          </select>
          <button onClick={() => setWindowOffset(o => Math.max(0,o-1))} disabled={windowOffset===0}
            style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 11px",color:t.tx1,cursor:windowOffset>0?"pointer":"default",fontSize:14,opacity:windowOffset>0?1:0.4 }}>›</button>
        </div>
      </div>

      {/* Total Spending Line Chart */}
      <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,padding:16,marginBottom:16 }}>
        <div style={{ fontSize:11,color:t.tx2,fontWeight:700,marginBottom:8 }}>MONTHLY TOTAL EXPENSES</div>
        <div style={{ overflowX:"auto" }}>
          <svg width={svgW} height={svgH} style={{ display:"block",minWidth:280 }}>
            {[0,0.25,0.5,0.75,1].map(frac => {
              const y = padT + chartH - frac * chartH;
              return (
                <g key={frac}>
                  <line x1={padL} y1={y} x2={svgW-padR} y2={y} stroke={t.border} strokeWidth={1} />
                  <text x={padL-4} y={y+4} textAnchor="end" fontSize={9} fill={t.tx3}>{fmtShort(maxExp * frac)}</text>
                </g>
              );
            })}
            {displayMonths.length > 1 && (
              <polyline
                points={monthData.map((d,i) => `${xPos(i)},${yPos(d.totalExpense)}`).join(" ")}
                fill="none" stroke={COLOR.danger} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
              />
            )}
            {monthData.map((d,i) => (
              <g key={d.month} style={{ cursor:"pointer" }} onClick={() => onNavigateToTxMonth && onNavigateToTxMonth(d.month)}>
                <circle cx={xPos(i)} cy={yPos(d.totalExpense)} r={6} fill={COLOR.danger} stroke={t.panelBg} strokeWidth={2} />
                <text x={xPos(i)} y={svgH-padB+14} textAnchor="middle" fontSize={10} fill={t.tx2}>{shortMonth(d.month)}</text>
                <title>{shortMonth(d.month)}: {fmt$(d.totalExpense)}</title>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Category Breakdown Bar Chart */}
      <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,padding:16,marginBottom:16 }}>
        <div style={{ fontSize:11,color:t.tx2,fontWeight:700,marginBottom:8 }}>CATEGORY BREAKDOWN (Top 6)</div>
        <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:12 }}>
          {topCats.map((cid,ci) => (
            <div key={cid} style={{ display:"flex",alignItems:"center",gap:4 }}>
              <div style={{ width:10,height:10,borderRadius:2,background:CHART_COLORS[ci%CHART_COLORS.length],flexShrink:0 }} />
              <span style={{ fontSize:11,color:t.tx2 }}>{catMap[cid]?.icon} {catMap[cid]?.name||cid}</span>
            </div>
          ))}
          {hasOther && (
            <div style={{ display:"flex",alignItems:"center",gap:4 }}>
              <div style={{ width:10,height:10,borderRadius:2,background:"#94a3b8",flexShrink:0 }} />
              <span style={{ fontSize:11,color:t.tx2 }}>Other</span>
            </div>
          )}
        </div>
        <div style={{ overflowX:"auto" }}>
          <svg width={svgW} height={barSvgH} style={{ display:"block",minWidth:280 }}>
            {[0,0.25,0.5,0.75,1].map(frac => {
              const y = barPadT + barChartH - frac * barChartH;
              return (
                <g key={frac}>
                  <line x1={barPadL} y1={y} x2={svgW-barPadR} y2={y} stroke={t.border} strokeWidth={1} />
                  <text x={barPadL-4} y={y+4} textAnchor="end" fontSize={9} fill={t.tx3}>{fmtShort(maxBarTotal * frac)}</text>
                </g>
              );
            })}
            {monthData.map((md,mi) => {
              const groupCenterX = barPadL + barGroupW * mi + barGroupW / 2;
              const groupStartX = groupCenterX - (totalBars * barW) / 2;
              const otherAmt = Math.max(md.totalExpense - topCats.reduce((s,cid) => s+(md.byCat[cid]||0), 0), 0);
              const barsData = [
                ...topCats.map((cid,ci) => ({ amount: md.byCat[cid]||0, color: CHART_COLORS[ci%CHART_COLORS.length], label: catMap[cid]?.name||cid })),
                ...(hasOther ? [{ amount: otherAmt, color:"#94a3b8", label:"Other" }] : []),
              ];
              return (
                <g key={md.month} style={{ cursor:"pointer" }} onClick={() => onNavigateToTxMonth && onNavigateToTxMonth(md.month)}>
                  {barsData.map((bar,bi) => {
                    const barH = bar.amount > 0 ? Math.max((bar.amount / maxBarTotal) * barChartH, 2) : 0;
                    const barX = groupStartX + bi * barW;
                    const barY = barPadT + barChartH - barH;
                    return (
                      <rect key={bi} x={barX} y={barY} width={Math.max(barW-1,2)} height={barH}
                        fill={bar.color} rx={2} opacity={0.85}>
                        <title>{shortMonth(md.month)} · {bar.label}: {fmt$(bar.amount)}</title>
                      </rect>
                    );
                  })}
                  <text x={groupCenterX} y={barSvgH-barPadB+14} textAnchor="middle" fontSize={10} fill={t.tx2}>{shortMonth(md.month)}</text>
                </g>
              );
            })}
          </svg>
        </div>
        {monthData.every(d => d.totalExpense === 0) && (
          <div style={{ textAlign:"center",color:t.tx2,fontSize:13,padding:"16px 0" }}>No spending data in this range.</div>
        )}
      </div>
    </div>
  );
}

// ─── ReceiptCard ──────────────────────────────────────────────────────────────
function ReceiptCard({ t, draft, inp, onUpdate, onUpdateItem, onDiscard }) {
  const { merchant, date, total, items, selectedCategory, itemsExpanded } = draft;
  return (
    <div style={{ border:`1px solid ${t.border}`,borderRadius:14,marginBottom:14,overflow:"hidden",borderTop:`3px solid #6366f1` }}>
      <div style={{ padding:"12px 14px",background:t.surf }}>
        <div style={{ display:"flex",gap:8,marginBottom:8 }}>
          <input value={merchant} onChange={e => onUpdate({ merchant: e.target.value })}
            placeholder="Merchant" style={{ ...inp, flex:2 }} />
          <input type="date" value={date} onChange={e => onUpdate({ date: e.target.value })}
            style={{ ...inp, flex:1 }} />
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <label style={{ fontSize:11,color:t.tx2,fontWeight:600,whiteSpace:"nowrap" }}>TOTAL $</label>
          <input type="number" value={total} onChange={e => onUpdate({ total: e.target.value })}
            placeholder="0.00" style={{ ...inp, width:100 }} />
          <div style={{ flex:1 }} />
          <button onClick={onDiscard}
            style={{ background:"transparent",border:`1px solid ${COLOR.danger}44`,borderRadius:7,padding:"4px 10px",color:COLOR.danger,cursor:"pointer",fontSize:12 }}>
            Discard
          </button>
        </div>
      </div>
      {items && items.length > 0 ? (
        <div style={{ padding:"0 14px" }}>
          <button onClick={() => onUpdate({ itemsExpanded: !itemsExpanded })}
            style={{ width:"100%",background:"transparent",border:"none",padding:"10px 0",color:t.tx2,cursor:"pointer",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:6,textAlign:"left" }}>
            <span>{itemsExpanded ? "▲" : "▼"}</span>
            <span>{items.length} line item{items.length > 1 ? "s" : ""}</span>
          </button>
          {itemsExpanded && (
            <div style={{ paddingBottom:12 }}>
              {items.map((item, ii) => {
                const lowConf = !item.amount || !item.description;
                return (
                  <div key={ii} style={{ display:"grid",gridTemplateColumns:"1fr 70px 140px",gap:6,alignItems:"center",padding:"6px 0",
                    borderBottom:`1px solid ${t.border}`,
                    borderLeft: lowConf ? `3px solid ${COLOR.warning}` : "none",
                    paddingLeft: lowConf ? 8 : 0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <span style={{ fontSize:12,color:t.tx1 }}>{item.description || "—"}</span>
                      {lowConf && <span style={{ fontSize:9,fontWeight:700,color:COLOR.warning,background:COLOR.warning+"22",borderRadius:4,padding:"1px 5px",flexShrink:0 }}>Review</span>}
                    </div>
                    <span style={{ fontSize:12,fontFamily:"monospace",color:t.tx2,textAlign:"right" }}>{item.amount ? fmt$(item.amount) : "—"}</span>
                    <select value={item.selectedCategory || "Other"} onChange={e => onUpdateItem(ii, { selectedCategory: e.target.value })}
                      style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:6,padding:"4px 6px",color:t.tx1,fontSize:11,boxSizing:"border-box",width:"100%" }}>
                      {SCAN_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding:"10px 14px",display:"flex",alignItems:"center",gap:10 }}>
          <label style={{ fontSize:12,color:t.tx2,fontWeight:600,whiteSpace:"nowrap" }}>CATEGORY</label>
          <select value={selectedCategory || "Other"} onChange={e => onUpdate({ selectedCategory: e.target.value })}
            style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:7,padding:"6px 10px",color:t.tx1,fontSize:13,flex:1,boxSizing:"border-box" }}>
            {SCAN_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

// ─── ReceiptScanModal ─────────────────────────────────────────────────────────
function ReceiptScanModal({ open, onClose, onConfirm, apiKey, categories, t, isMobile }) {
  const fileInputRef = useRef(null);
  const [phase, setPhase] = useState("idle"); // "idle" | "loading" | "review" | "error" | "nokey"
  const [drafts, setDrafts] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (open) {
      if (!apiKey) { setPhase("nokey"); return; }
      setPhase("idle");
      setDrafts([]);
      setErrorMsg(null);
      setTimeout(() => { if (fileInputRef.current) fileInputRef.current.click(); }, 120);
    } else {
      setPhase("idle");
      setDrafts([]);
      setErrorMsg(null);
    }
  }, [open]);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPhase("loading");
    try {
      const results = await Promise.all(files.map(async file => {
        const { base64, mediaType } = await readFileAsBase64(file);
        return extractReceiptsFromImage(apiKey, base64, mediaType);
      }));
      const allReceipts = results.flat();
      if (allReceipts.length === 0) {
        setErrorMsg("No receipts found in this image. Try a clearer photo.");
        setPhase("error");
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      setDrafts(allReceipts.map(r => ({
        _id: generateId(),
        merchant: r.merchant || "",
        date: r.date || today,
        total: r.total != null ? String(r.total) : "",
        items: (r.items || []).map(item => ({ ...item, selectedCategory: item.suggestedCategory || "Other" })),
        selectedCategory: (!r.items || r.items.length === 0) ? "Other" : null,
        itemsExpanded: false,
      })));
      setPhase("review");
    } catch(err) {
      setErrorMsg(aiErrorMsg(err));
      setPhase("error");
    }
  }

  function updateDraft(idx, patch) {
    setDrafts(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  }

  function updateItem(draftIdx, itemIdx, patch) {
    setDrafts(prev => prev.map((d, di) => {
      if (di !== draftIdx) return d;
      const items = d.items.map((item, ii) => ii === itemIdx ? { ...item, ...patch } : item);
      return { ...d, items };
    }));
  }

  function discard(idx) {
    setDrafts(prev => prev.filter((_, i) => i !== idx));
  }

  function resolveCategory(name) {
    if (!name) return null;
    if (name.toLowerCase() === "other") return "exp_057";
    const lc = name.toLowerCase();
    return (
      categories.find(c => c.name.toLowerCase() === lc)?.id ||
      categories.find(c => c.name.toLowerCase().includes(lc))?.id ||
      categories.find(c => lc.includes(c.name.toLowerCase().split(" / ")[0].trim().toLowerCase()))?.id ||
      null
    );
  }

  function handleConfirm() {
    const confirmed = drafts.map(d => {
      let categoryId;
      if (d.items && d.items.length > 0) {
        categoryId = resolveCategory(d.items[0]?.selectedCategory);
      } else {
        categoryId = resolveCategory(d.selectedCategory);
      }
      return { merchant: d.merchant, date: d.date, total: parseFloat(d.total) || 0, categoryId, items: d.items };
    });
    onConfirm(confirmed);
  }

  if (!open) return null;

  const inp = { background:t.surf,border:`1px solid ${t.border}`,borderRadius:7,padding:"6px 10px",color:t.tx1,fontSize:13,boxSizing:"border-box" };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:3000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:16,overflowY:"auto" }}>
      <div style={{ background:t.panelBg,borderRadius:20,width:"100%",maxWidth:560,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)",marginTop:20,marginBottom:20 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontWeight:800,fontSize:17,color:t.tx1 }}>📷 Scan Receipt</div>
          <button onClick={onClose} style={{ background:"transparent",border:"none",color:t.tx3,cursor:"pointer",fontSize:20,lineHeight:1,padding:"0 4px" }}>×</button>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={handleFiles} />

        {phase === "nokey" && (
          <div style={{ padding:"24px 0",textAlign:"center",color:t.tx2,fontSize:13 }}>
            Add your API key first (🔑 in the toolbar)
          </div>
        )}

        {phase === "idle" && (
          <div style={{ padding:"24px 0",textAlign:"center",color:t.tx2,fontSize:13 }}>
            Opening file picker…
          </div>
        )}

        {phase === "loading" && (
          <div style={{ textAlign:"center",padding:"36px 0" }}>
            <div style={{ width:36,height:36,border:"3px solid #6366f1",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 12px" }} />
            <div style={{ fontSize:14,color:t.tx2 }}>Scanning receipts…</div>
          </div>
        )}

        {phase === "error" && (
          <div style={{ padding:"16px 0" }}>
            <div style={{ background:COLOR.warning+"18",border:`1px solid ${COLOR.warning}44`,borderRadius:10,padding:"12px 16px",fontSize:13,color:COLOR.warning,marginBottom:16 }}>
              {errorMsg}
            </div>
            <button onClick={() => { setPhase("idle"); setTimeout(() => { if (fileInputRef.current) { fileInputRef.current.value = ""; fileInputRef.current.click(); } }, 120); }}
              style={{ background:COLOR.primary,border:"none",borderRadius:10,padding:"9px 20px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13 }}>
              Try Again
            </button>
          </div>
        )}

        {phase === "review" && (
          <div>
            {drafts.length === 0 && (
              <div style={{ textAlign:"center",color:t.tx2,fontSize:13,padding:"16px 0" }}>All receipts discarded.</div>
            )}
            {drafts.map((draft, di) => (
              <ReceiptCard key={draft._id} t={t} draft={draft} inp={inp}
                onUpdate={patch => updateDraft(di, patch)}
                onUpdateItem={(ii, patch) => updateItem(di, ii, patch)}
                onDiscard={() => discard(di)} />
            ))}
            {drafts.length > 0 && (
              <button onClick={handleConfirm}
                style={{ width:"100%",background:COLOR.success,border:"none",borderRadius:10,padding:"11px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14,marginTop:8 }}>
                ✓ Confirm All ({drafts.length})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DuplicateCheckModal ──────────────────────────────────────────────────────
function DuplicateCheckModal({ open, receipt, match, onSkip, onReplace, onKeepBoth, t }) {
  if (!open || !receipt || !match) return null;
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:3500,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:t.panelBg,borderRadius:20,width:"100%",maxWidth:480,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ background:COLOR.warning,padding:"14px 20px" }}>
          <div style={{ fontWeight:800,fontSize:15,color:"#fff" }}>Possible Duplicate Found</div>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20 }}>
            <div style={{ background:t.surf,borderRadius:12,padding:14 }}>
              <div style={{ fontSize:10,color:t.tx3,fontWeight:700,marginBottom:8,letterSpacing:0.5 }}>EXISTING TRANSACTION</div>
              <div style={{ fontSize:13,color:t.tx1,fontWeight:600,marginBottom:4 }}>{match.description}</div>
              <div style={{ fontSize:12,color:t.tx2 }}>{match.date}</div>
              <div style={{ fontFamily:"monospace",fontSize:14,fontWeight:800,color:COLOR.danger,marginTop:6 }}>{fmt$(Math.abs(match.amount))}</div>
            </div>
            <div style={{ background:t.surf,borderRadius:12,padding:14 }}>
              <div style={{ fontSize:10,color:t.tx3,fontWeight:700,marginBottom:8,letterSpacing:0.5 }}>SCANNED RECEIPT</div>
              <div style={{ fontSize:13,color:t.tx1,fontWeight:600,marginBottom:4 }}>{receipt.merchant}</div>
              <div style={{ fontSize:12,color:t.tx2 }}>{receipt.date}</div>
              <div style={{ fontFamily:"monospace",fontSize:14,fontWeight:800,color:COLOR.danger,marginTop:6 }}>{fmt$(Math.abs(receipt.total))}</div>
            </div>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            <button onClick={onSkip}
              style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>
              Skip (don't save) — mark existing as reconciled
            </button>
            <button onClick={onReplace}
              style={{ background:COLOR.warning,border:"none",borderRadius:10,padding:"10px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13 }}>
              Replace existing with scanned receipt
            </button>
            <button onClick={onKeepBoth}
              style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>
              Keep Both
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EditProfileModal ─────────────────────────────────────────────────────────
function EditProfileModal({ t, profile, onSave, onClose }) {
  const [name,  setName]  = useState(profile?.name||"");
  const [color, setColor] = useState(profile?.avatarColor||AVATAR_COLORS[0]);
  const [pin,   setPin]   = useState(profile?.pin||"");
  function handleSave() {
    if (!name.trim()) return;
    onSave({ ...profile, name: name.trim(), avatarColor: color, pin: pin.trim() });
  }
  const inp = { width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx1,fontSize:13,boxSizing:"border-box" };
  const lbl = { fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600 };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:t.panelBg,borderRadius:20,width:"100%",maxWidth:380,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ fontWeight:800,fontSize:17,color:t.tx1,marginBottom:16 }}>Edit Profile</div>
        <label style={lbl}>NAME</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={{ ...inp,marginBottom:12 }} />
        <label style={{ ...lbl,marginBottom:8 }}>AVATAR COLOR</label>
        <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" }}>
          {AVATAR_COLORS.map(c => (
            <div key={c} onClick={() => setColor(c)} style={{ width:24,height:24,borderRadius:"50%",background:c,cursor:"pointer",border:color===c?"3px solid #fff":"2px solid transparent",boxSizing:"border-box" }} />
          ))}
        </div>
        <label style={lbl}>RECOVERY PIN <span style={{ color:t.tx3,fontWeight:400 }}>(optional)</span></label>
        <input value={pin} onChange={e => setPin(e.target.value)} placeholder="e.g. smithfamily" style={{ ...inp,marginBottom:16 }} />
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()} style={{ flex:1,background:name.trim()?COLOR.primary:t.surf,border:"none",borderRadius:10,padding:"9px 0",color:name.trim()?"#fff":t.tx3,cursor:name.trim()?"pointer":"default",fontWeight:700,fontSize:14 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
// ─── ReconciliationTab (v1.10-P2) ─────────────────────────────────────────────
function ReconcilePairRow({ t, tx, accounts, categories, isMobile }) {
  const acc = accounts.find(a => a.id === tx.accountId);
  const isSplit = tx.isSplit && Array.isArray(tx.splits) && tx.splits.length > 0;
  const cat = isSplit ? null : categories.find(c => c.id === tx.categoryId);
  const amount = parseFloat(tx.amount) || 0;
  const amountColor = amount < 0 ? COLOR.danger : COLOR.success;
  const method = tx.entryMethod === 'scan' ? 'scanned'
    : tx.entryMethod === 'csv_import' ? 'imported'
    : 'manual';
  return (
    <div style={{ flex:1, minWidth:0, background:t.surf, border:`1px solid ${t.border}`, borderRadius:10, padding:"10px 12px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:6 }}>
        <div style={{ fontSize:11, color:t.tx2, fontFamily:"monospace" }}>{tx.date}</div>
        <div style={{ fontSize:14, fontWeight:700, fontFamily:"monospace", color:amountColor }}>
          {amount < 0 ? "-" : ""}${Math.abs(amount).toFixed(2)}
        </div>
      </div>
      <div style={{ fontSize:13, color:t.tx1, fontWeight:600, marginBottom:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {tx.description || <span style={{ color:t.tx3, fontStyle:"italic" }}>(no description)</span>}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
        {isSplit && (
          <span style={{ fontSize:10, fontWeight:700, color:t.tx2, background:t.panelBg, border:`1px solid ${t.border2}`, borderRadius:5, padding:"2px 6px" }}>
            🧩 Split
          </span>
        )}
        {!isSplit && cat && (
          <span style={{ fontSize:10, fontWeight:700, color:t.tx2, background:t.panelBg, border:`1px solid ${t.border2}`, borderRadius:5, padding:"2px 6px" }}>
            {cat.icon} {cat.name}
          </span>
        )}
        {acc && (
          <span style={{ fontSize:10, color:t.tx2, background:t.panelBg, border:`1px solid ${t.border}`, borderRadius:5, padding:"2px 6px" }}>
            🏦 {acc.nickname}
          </span>
        )}
        <span style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".5px", color:t.tx3, background:t.panelBg, border:`1px solid ${t.border}`, borderRadius:5, padding:"2px 6px" }}>
          {method}
        </span>
      </div>
    </div>
  );
}

function ReconciliationTab({ t, pairs, transactions, accounts, categories, dismissedPairs, onSaveDismissed, onUpdateTransactions, bp }) {
  const [confirmKeep, setConfirmKeep] = useState(null); // { pair, keepId, deleteId }

  function dismissPair(pair) {
    const next = [...(dismissedPairs || []), { pairKey: pair.pairKey, dismissedAt: new Date().toISOString() }];
    onSaveDismissed(next);
  }

  function keepOne(pair, keepId) {
    const deleteId = keepId === pair.a.id ? pair.b.id : pair.a.id;
    const next = transactions
      .filter(tx => tx.id !== deleteId)
      .map(tx => tx.id === keepId ? { ...tx, reconciled: true, reconciledWith: deleteId } : tx);
    onUpdateTransactions(next);
    setConfirmKeep(null);
  }

  function keepBoth(pair) {
    const next = transactions.map(tx => {
      if (tx.id === pair.a.id) return { ...tx, reconciled: true, reconciledWith: pair.b.id };
      if (tx.id === pair.b.id) return { ...tx, reconciled: true, reconciledWith: pair.a.id };
      return tx;
    });
    onUpdateTransactions(next);
    dismissPair(pair);
  }

  const btnBase = { border:"none", borderRadius:8, padding:"7px 12px", cursor:"pointer", fontWeight:600, fontSize:12 };
  const btnDanger   = { ...btnBase, background:COLOR.danger+"18",  color:COLOR.danger,  border:`1px solid ${COLOR.danger}55` };
  const btnNeutral  = { ...btnBase, background:t.surf,              color:t.tx1,         border:`1px solid ${t.border2}` };
  const btnSuccess  = { ...btnBase, background:COLOR.success+"18", color:COLOR.success, border:`1px solid ${COLOR.success}55` };

  const stacked = bp && bp.isMobile;

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:15, color:t.tx1, marginBottom:4 }}>Duplicate review</div>
        <div style={{ fontSize:12, color:t.tx2 }}>
          {pairs.length} potential duplicate{pairs.length === 1 ? '' : 's'} found across {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
        </div>
      </div>

      {pairs.length === 0 && (
        <div style={{ background:t.panelBg, border:`1px solid ${t.border}`, borderRadius:14, padding:"32px 20px", textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>✨</div>
          <div style={{ fontSize:14, color:t.tx2, marginBottom:4 }}>No duplicates detected.</div>
          <div style={{ fontSize:12, color:t.tx3 }}>All transactions look unique.</div>
        </div>
      )}

      {pairs.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {pairs.map(pair => (
            <div key={pair.pairKey} style={{ background:t.panelBg, border:`1px solid ${t.border}`, borderRadius:14, padding:14 }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".5px", color:COLOR.warning, marginBottom:10 }}>
                ⚠ {pair.reason}
              </div>
              <div style={{ display:"flex", flexDirection:stacked?"column":"row", gap:10, alignItems:"stretch", marginBottom:12 }}>
                <ReconcilePairRow t={t} tx={pair.a} accounts={accounts} categories={categories} isMobile={stacked} />
                <ReconcilePairRow t={t} tx={pair.b} accounts={accounts} categories={categories} isMobile={stacked} />
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                <button style={btnDanger}  onClick={() => setConfirmKeep({ pair, keepId:pair.a.id, deleteId:pair.b.id })}>Keep A (delete B)</button>
                <button style={btnDanger}  onClick={() => setConfirmKeep({ pair, keepId:pair.b.id, deleteId:pair.a.id })}>Keep B (delete A)</button>
                <button style={btnNeutral} onClick={() => keepBoth(pair)}>Keep both</button>
                <button style={btnSuccess} onClick={() => dismissPair(pair)}>Not a duplicate</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmKeep && (
        <ConfirmModal
          t={t}
          message={`Delete the other transaction? This cannot be undone. The kept transaction will be marked reconciled.`}
          onConfirm={() => keepOne(confirmKeep.pair, confirmKeep.keepId)}
          onCancel={() => setConfirmKeep(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  const [loading,      setLoading]      = useState(true);
  const [darkMode,     setDarkMode]     = useState(() => localStorage.getItem("sp_dark") !== "false");
  const [apiKey,       setApiKey]       = useState("");
  const [profiles,     setProfiles]     = useState([]);
  const [activeProfile,setActiveProfile]= useState(null);
  const [accounts,     setAccounts]     = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories,   setCategories]   = useState([]);
  const [rules,        setRules]        = useState([]);
  const [tab,          setTab]          = useState("summary");
  const [txPresetCat,  setTxPresetCat]  = useState(null);
  const [range,        setRange]        = useState(defaultRange);
  const [dismissedPairs, setDismissedPairs] = useState([]);
  const [showApiKey,       setShowApiKey]       = useState(false);
  const [showBackup,       setShowBackup]       = useState(false);
  const [showAccounts,     setShowAccounts]     = useState(false);
  const [showProfileMenu,  setShowProfileMenu]  = useState(false);
  const [apiKeyStatus,     setApiKeyStatus]     = useState("unchecked");
  const [showEditProfile,  setShowEditProfile]  = useState(false);
  const [editingProfile,   setEditingProfile]   = useState(null);
  const [showImportFromApp,setShowImportFromApp]= useState(false);
  const [importInitAccId,  setImportInitAccId]  = useState(null);

  const t = useTheme(darkMode);
  const bp = useBreakpoint();

  useEffect(() => { localStorage.setItem("sp_dark", darkMode); }, [darkMode]);

  useEffect(() => {
    async function init() {
      const key = await storeGet("cc_apikey", true);
      if (key) {
        setApiKey(key);
        probeApiKey(key).then(status => setApiKeyStatus(status));
      }

      const profs = await storeGet("cc_profiles", true) || [];
      setProfiles(profs);

      const activeId = await storeGet("cc_active_profile", true);
      const profile = profs.find(p => p.id === activeId) || profs[0] || null;
      setActiveProfile(profile);

      if (profile) {
        const accs = await storeGet(`${MODULE_PREFIX}accounts_${profile.id}`) || [];
        setAccounts(accs);

        const txns = await storeGet(`${MODULE_PREFIX}transactions_${profile.id}`) || [];
        setTransactions(txns);

        let cats = await storeGet(`ffp_categories_${profile.id}`, true);
        if (!cats || cats.length === 0) {
          cats = DEFAULT_CATEGORIES;
          await storeSet(`ffp_categories_${profile.id}`, cats, true);
        } else if (!cats.find(c => c.id === "trn_001")) {
          const trnCat = DEFAULT_CATEGORIES.find(c => c.id === "trn_001");
          if (trnCat) { cats = [...cats, trnCat]; await storeSet(`ffp_categories_${profile.id}`, cats, true); }
        }
        // Migration: backfill isEssential on categories missing the field
        let migrated = false;
        cats = cats.map(c => {
          if (c.isEssential === undefined) { migrated = true; return { ...c, isEssential: ESSENTIAL_IDS.has(c.id) }; }
          return c;
        });
        if (migrated) await storeSet(`ffp_categories_${profile.id}`, cats, true);
        setCategories(cats);

        const baseline = computeBaseline(txns, cats);
        await storeSet(`ffp_baseline_${profile.id}`, baseline, true);

        const rs = await storeGet(`ffp_cat_rules_${profile.id}`, true) || [];
        setRules(rs);

        const dism = await storeGet(`${MODULE_PREFIX}dedup_dismissed_${profile.id}`) || [];
        setDismissedPairs(dism);

        const savedRange = await storeGet(`sp_selected_range_${profile.id}`);
        if (savedRange && savedRange.mode) {
          setRange(savedRange);
        } else if (txns.length > 0) {
          const latestMonth = txns
            .map(tx => tx.date && tx.date.slice(0,7))
            .filter(Boolean)
            .sort()
            .at(-1);
          if (latestMonth && latestMonth < currentYYYYMM()) {
            const r = { mode:"month", month:latestMonth, start:latestMonth, end:latestMonth };
            setRange(r);
          }
        }
      }

      setLoading(false);
    }
    init();
  }, []);

  const saveAccounts = useCallback(async (next) => {
    setAccounts(next);
    if (activeProfile) await storeSet(`${MODULE_PREFIX}accounts_${activeProfile.id}`, next);
  }, [activeProfile]);

  const recalcBaseline = useCallback(async (txns, cats) => {
    if (!activeProfile) return;
    const baseline = computeBaseline(txns, cats);
    await storeSet(`ffp_baseline_${activeProfile.id}`, baseline, true);
  }, [activeProfile]);

  const saveTransactions = useCallback(async (next) => {
    setTransactions(next);
    if (activeProfile) {
      await storeSet(`${MODULE_PREFIX}transactions_${activeProfile.id}`, next);
      await recalcBaseline(next, categories);
    }
  }, [activeProfile, categories, recalcBaseline]);

  const saveRules = useCallback(async (next) => {
    setRules(next);
    if (activeProfile) await storeSet(`ffp_cat_rules_${activeProfile.id}`, next, true);
  }, [activeProfile]);

  const saveCategories = useCallback(async (next) => {
    setCategories(next);
    if (activeProfile) {
      await storeSet(`ffp_categories_${activeProfile.id}`, next, true);
      await recalcBaseline(transactions, next);
    }
  }, [activeProfile, transactions, recalcBaseline]);

  const saveRange = useCallback(async (next) => {
    setRange(next);
    if (activeProfile) await storeSet(`sp_selected_range_${activeProfile.id}`, next);
  }, [activeProfile]);

  const saveDismissedPairs = useCallback(async (next) => {
    setDismissedPairs(next);
    if (activeProfile) await storeSet(`${MODULE_PREFIX}dedup_dismissed_${activeProfile.id}`, next);
  }, [activeProfile]);

  async function handleSaveApiKey(key) {
    setApiKey(key);
    await storeSet("cc_apikey", key, true);
    setShowApiKey(false);
    if (key) probeApiKey(key).then(status => setApiKeyStatus(status));
    else setApiKeyStatus("unchecked");
  }

  async function handleSaveProfile(updated) {
    const next = profiles.map(p => p.id === updated.id ? updated : p);
    setProfiles(next);
    setActiveProfile(updated);
    await storeSet("cc_profiles", next, true);
    setShowEditProfile(false);
    setEditingProfile(null);
  }

  async function handleImportFromApp(newTxns) {
    const merged = [...transactions];
    for (const tx of newTxns) {
      const clean = { ...tx };
      const replaceId = clean._replaceId;
      delete clean._replaceId;
      if (replaceId) {
        const idx = merged.findIndex(ex => ex.id === replaceId);
        if (idx >= 0) merged[idx] = clean; else merged.push(clean);
      } else {
        const dupeIdx = merged.findIndex(ex =>
          ex.date===tx.date && ex.description.toLowerCase()===tx.description.toLowerCase() && Math.abs(ex.amount-tx.amount)<0.01
        );
        if (dupeIdx >= 0) merged[dupeIdx] = clean; else merged.push(clean);
      }
    }
    await saveTransactions(merged);
    setShowImportFromApp(false);
  }

  async function handleImport(data) {
    const txns = data.transactions || [];
    const accs = data.accounts || accounts;
    await saveTransactions(txns);
    await saveAccounts(accs);
  }

  async function handleFirstRun(profile) {
    const newProfiles = [profile];
    setProfiles(newProfiles);
    setActiveProfile(profile);
    await storeSet("cc_profiles", newProfiles, true);
    await storeSet("cc_active_profile", profile.id, true);
    const cats = DEFAULT_CATEGORIES;
    setCategories(cats);
    await storeSet(`ffp_categories_${profile.id}`, cats, true);
    setRules([]);
    setAccounts([]);
    setTransactions([]);
    setDismissedPairs([]);
  }

  async function handleSwitchProfile(profile) {
    setActiveProfile(profile);
    setShowProfileMenu(false);
    await storeSet("cc_active_profile", profile.id, true);
    const accs = await storeGet(`${MODULE_PREFIX}accounts_${profile.id}`) || [];
    setAccounts(accs);
    const txns = await storeGet(`${MODULE_PREFIX}transactions_${profile.id}`) || [];
    setTransactions(txns);
    let cats = await storeGet(`ffp_categories_${profile.id}`, true);
    if (!cats || cats.length === 0) {
      cats = DEFAULT_CATEGORIES;
      await storeSet(`ffp_categories_${profile.id}`, cats, true);
    } else if (!cats.find(c => c.id === "trn_001")) {
      const trnCat = DEFAULT_CATEGORIES.find(c => c.id === "trn_001");
      if (trnCat) { cats = [...cats, trnCat]; await storeSet(`ffp_categories_${profile.id}`, cats, true); }
    }
    // Migration: backfill isEssential on categories missing the field
    let migrated = false;
    cats = cats.map(c => {
      if (c.isEssential === undefined) { migrated = true; return { ...c, isEssential: ESSENTIAL_IDS.has(c.id) }; }
      return c;
    });
    if (migrated) await storeSet(`ffp_categories_${profile.id}`, cats, true);
    setCategories(cats);
    const baseline = computeBaseline(txns, cats);
    await storeSet(`ffp_baseline_${profile.id}`, baseline, true);
    const rs = await storeGet(`ffp_cat_rules_${profile.id}`, true) || [];
    setRules(rs);
    const dism = await storeGet(`${MODULE_PREFIX}dedup_dismissed_${profile.id}`) || [];
    setDismissedPairs(dism);
    const savedRange = await storeGet(`sp_selected_range_${profile.id}`);
    if (savedRange && savedRange.mode) {
      setRange(savedRange);
    } else if (txns.length > 0) {
      const latestMonth = txns
        .map(tx => tx.date && tx.date.slice(0,7))
        .filter(Boolean)
        .sort()
        .at(-1);
      const r = latestMonth && latestMonth < currentYYYYMM()
        ? { mode:"month", month:latestMonth, start:latestMonth, end:latestMonth }
        : defaultRange();
      setRange(r);
    } else {
      setRange(defaultRange());
    }
  }

  // Navigate to a specific month in Transactions tab (from Trends click)
  function handleNavigateToTxMonth(month) {
    const r = { mode:"month", month, start:month, end:month };
    setRange(r);
    if (activeProfile) storeSet(`sp_selected_range_${activeProfile.id}`, r);
    setTxPresetCat(null);
    setTab("transactions");
  }

  // Navigate within Summary (RollupPanel) — stay in Summary, update range
  function handleSummaryNavigateMonth(month) {
    const r = { mode:"month", month, start:month, end:month };
    setRange(r);
    if (activeProfile) storeSet(`sp_selected_range_${activeProfile.id}`, r);
  }

  if (loading) return (
    <div style={{ minHeight:"100vh",background:t.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,padding:20 }}>
      <div style={{ width:40,height:40,border:"3px solid #6366f1",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite" }} />
      <div style={{ fontSize:14,color:t.tx2,textAlign:"center" }}>Loading…</div>
      <div style={{ fontSize:12,color:t.tx3,textAlign:"center",maxWidth:280 }}>If a login prompt appeared, close it — the app loads in local mode automatically.</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!activeProfile) return <FirstRunSetup t={t} onComplete={handleFirstRun} />;

  const tabStyle = (active) => ({
    background: active ? COLOR.primary : t.surf,
    color: active ? "#fff" : t.tx2,
    border: `1px solid ${active ? COLOR.primary : t.border}`,
    borderRadius: 8,
    padding: "7px 20px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    transition: "all .15s",
  });

  const txCount = transactions.length;
  const reconcilePairs = findDuplicatePairs(transactions, dismissedPairs);
  const reconcileCount = reconcilePairs.length;

  return (
    <div style={{ minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif",color:t.tx1 }}>
      {/* Nav */}
      <div style={{ background:t.deepBg,borderBottom:`1px solid ${t.border}`,padding:"11px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#6366f1,#ec4899)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>📊</div>
          {!bp.isMobile && <span style={{ fontWeight:800,fontSize:18,color:t.tx1 }}>Spending Tracker</span>}
          <span style={{ fontSize:10,color:t.tx2,background:t.surf,border:`1px solid ${t.border}`,borderRadius:6,padding:"2px 8px",fontFamily:"monospace" }}>{txCount} txns</span>
          <span style={{ fontSize:10,color:hasCloudStorage()?"#10b981":"#f59e0b",background:hasCloudStorage()?"#10b98118":"#f59e0b18",border:`1px solid ${hasCloudStorage()?"#10b98133":"#f59e0b33"}`,borderRadius:6,padding:"2px 8px" }}>
            {hasCloudStorage() ? "☁ Cloud Sync" : "💾 Local Only"}
          </span>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
          <button onClick={() => setDarkMode(d => !d)} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 11px",color:t.tx1,cursor:"pointer",fontSize:14 }}>
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button onClick={() => setShowBackup(true)} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 11px",color:t.tx1,cursor:"pointer",fontSize:13 }}>💾</button>
          <div style={{ display:"flex",alignItems:"center",gap:4 }}>
            <button onClick={() => setShowApiKey(true)} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 11px",color:t.tx1,cursor:"pointer",fontSize:13 }}>🔑</button>
            {apiKeyStatus==="valid"   && <div style={{ width:8,height:8,borderRadius:"50%",background:COLOR.success }} title="AI ready"/>}
            {apiKeyStatus==="invalid" && <span style={{ fontSize:10,color:COLOR.warning,fontWeight:700 }}>Key invalid</span>}
            {apiKeyStatus==="limited" && <div style={{ width:8,height:8,borderRadius:"50%",background:COLOR.warning }} title="Rate limited"/>}
          </div>
          <div style={{ position:"relative" }}>
            <div onClick={() => setShowProfileMenu(m => !m)} style={{ width:32,height:32,borderRadius:"50%",background:activeProfile.avatarColor||COLOR.primary,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",userSelect:"none" }}>
              {(activeProfile.name||"?").charAt(0).toUpperCase()}
            </div>
            {showProfileMenu && (
              <ProfileDropdown t={t} profiles={profiles} activeProfile={activeProfile} onSwitch={handleSwitchProfile} onClose={() => setShowProfileMenu(false)} onEditProfile={p => { setEditingProfile(p); setShowEditProfile(true); }} />
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ maxWidth:1100,margin:"0 auto",padding:"20px 16px" }}>
        {/* Tabs */}
        <div style={{ display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",overflowX:bp.isMobile?"auto":"visible" }}>
          <button style={tabStyle(tab==="summary")} onClick={() => setTab("summary")}>Summary</button>
          <button style={tabStyle(tab==="transactions")} onClick={() => { setTxPresetCat(null); setTab("transactions"); }}>Transactions</button>
          <button style={tabStyle(tab==="rules")} onClick={() => setTab("rules")}>Rules</button>
          <button style={tabStyle(tab==="trends")} onClick={() => setTab("trends")}>Trends</button>
          <button style={tabStyle(tab==="reconcile")} onClick={() => setTab("reconcile")}>
            Reconcile
            {reconcileCount > 0 && (
              <span style={{ marginLeft:7, background:COLOR.danger, color:"#fff", borderRadius:10, padding:"1px 7px", fontSize:11, fontWeight:700 }}>
                {reconcileCount}
              </span>
            )}
          </button>
        </div>

        {tab === "summary" && (
          <div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
              <div style={{ fontWeight:700,fontSize:15,color:t.tx1 }}>Summary</div>
              <button onClick={() => setShowAccounts(true)} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 12px",color:t.tx1,cursor:"pointer",fontSize:13,fontWeight:600 }}>🏦 Accounts</button>
            </div>
            <SummaryTab
              t={t} transactions={transactions} categories={categories}
              range={range} onRangeChange={saveRange}
              onNavigateToCategory={catId => { setTxPresetCat(catId); setTab("transactions"); }}
              onNavigateMonth={handleSummaryNavigateMonth}
              apiKey={apiKey}
              onUpdateCategories={saveCategories}
              onRecalcBaseline={(cats) => recalcBaseline(transactions, cats)}
            />
          </div>
        )}
        {tab === "transactions" && (
          <TransactionsTab
            t={t} transactions={transactions} accounts={accounts}
            categories={categories} rules={rules} apiKey={apiKey}
            presetCatId={txPresetCat}
            range={range} onRangeChange={saveRange}
            onUpdateTransactions={saveTransactions}
            onUpdateAccounts={saveAccounts}
            onUpdateRules={saveRules}
            onUpdateCategories={saveCategories}
          />
        )}
        {tab === "rules" && (
          <RulesTab t={t} rules={rules} categories={categories} transactions={transactions}
            apiKey={apiKey} onUpdateRules={saveRules} onUpdateTransactions={saveTransactions} />
        )}
        {tab === "trends" && (
          <TrendsTab
            t={t} transactions={transactions} categories={categories}
            range={range} onNavigateToTxMonth={handleNavigateToTxMonth}
          />
        )}
        {tab === "reconcile" && (
          <ReconciliationTab
            t={t} pairs={reconcilePairs}
            transactions={transactions} accounts={accounts} categories={categories}
            dismissedPairs={dismissedPairs}
            onSaveDismissed={saveDismissedPairs}
            onUpdateTransactions={saveTransactions}
            bp={bp}
          />
        )}
      </div>

      {showApiKey   && <ApiKeyModal   t={t} apiKey={apiKey} onSave={handleSaveApiKey} onClose={() => setShowApiKey(false)} />}
      {showBackup   && <BackupModal   t={t} transactions={transactions} accounts={accounts} categories={categories} onClose={() => setShowBackup(false)} onImport={handleImport} onOpenImport={() => { setShowImportFromApp(true); setImportInitAccId(null); }} />}
      {showAccounts && <AccountsModal t={t} accounts={accounts} onSave={saveAccounts} onClose={() => setShowAccounts(false)} onSaveAndImport={acc => { setShowAccounts(false); setImportInitAccId(acc.id); setShowImportFromApp(true); }} />}
      {showEditProfile && editingProfile && <EditProfileModal t={t} profile={editingProfile} onSave={handleSaveProfile} onClose={() => { setShowEditProfile(false); setEditingProfile(null); }} />}
      {showImportFromApp && (
        <ImportWizard t={t} accounts={accounts} categories={categories} rules={rules}
          transactions={transactions} apiKey={apiKey}
          initialAccountId={importInitAccId}
          onComplete={handleImportFromApp} onClose={() => setShowImportFromApp(false)}
          onUpdateAccounts={saveAccounts} />
      )}
    </div>
  );
}
