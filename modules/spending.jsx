import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const MODULE_PREFIX = "sp_";
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
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

// ─── Default Categories ───────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  // Income
  { id:"inc_001", name:"Paycheck / Salary",    section:"Income",        icon:"💵", color:"#10b981" },
  { id:"inc_002", name:"Freelance / Side Income", section:"Income",     icon:"💻", color:"#10b981" },
  { id:"inc_003", name:"Investment Income",    section:"Income",        icon:"📈", color:"#10b981" },
  { id:"inc_004", name:"Transfer In",          section:"Income",        icon:"🔄", color:"#10b981" },
  { id:"inc_005", name:"Other Income",         section:"Income",        icon:"💰", color:"#10b981" },
  // Housing
  { id:"exp_001", name:"Rent / Mortgage",      section:"Housing",       icon:"🏠", color:"#6366f1" },
  { id:"exp_002", name:"HOA Fees",             section:"Housing",       icon:"🏘", color:"#6366f1" },
  { id:"exp_003", name:"Home Maintenance",     section:"Housing",       icon:"🔧", color:"#6366f1" },
  { id:"exp_004", name:"Home Insurance",       section:"Housing",       icon:"🛡", color:"#6366f1" },
  { id:"exp_005", name:"Property Tax",         section:"Housing",       icon:"🏛", color:"#6366f1" },
  // Food
  { id:"exp_006", name:"Groceries",            section:"Food",          icon:"🛒", color:"#f97316" },
  { id:"exp_007", name:"Restaurants / Dining", section:"Food",          icon:"🍽", color:"#f97316" },
  { id:"exp_008", name:"Coffee / Cafes",       section:"Food",          icon:"☕", color:"#f97316" },
  { id:"exp_009", name:"Alcohol / Bars",       section:"Food",          icon:"🍺", color:"#f97316" },
  // Transportation
  { id:"exp_010", name:"Gas / Fuel",           section:"Transportation",icon:"⛽", color:"#ec4899" },
  { id:"exp_011", name:"Car Payment",          section:"Transportation",icon:"🚗", color:"#ec4899" },
  { id:"exp_012", name:"Car Insurance",        section:"Transportation",icon:"🛡", color:"#ec4899" },
  { id:"exp_013", name:"Car Maintenance",      section:"Transportation",icon:"🔧", color:"#ec4899" },
  { id:"exp_014", name:"Parking / Tolls",      section:"Transportation",icon:"🅿", color:"#ec4899" },
  { id:"exp_015", name:"Public Transit / Rideshare", section:"Transportation", icon:"🚌", color:"#ec4899" },
  // Utilities
  { id:"exp_016", name:"Electric",             section:"Utilities",     icon:"⚡", color:"#f59e0b" },
  { id:"exp_017", name:"Water / Sewer",        section:"Utilities",     icon:"💧", color:"#f59e0b" },
  { id:"exp_018", name:"Gas / Heat",           section:"Utilities",     icon:"🔥", color:"#f59e0b" },
  { id:"exp_019", name:"Internet",             section:"Utilities",     icon:"📶", color:"#f59e0b" },
  { id:"exp_020", name:"Phone / Mobile",       section:"Utilities",     icon:"📱", color:"#f59e0b" },
  // Health
  { id:"exp_021", name:"Health Insurance",     section:"Health",        icon:"🏥", color:"#06b6d4" },
  { id:"exp_022", name:"Doctor / Medical",     section:"Health",        icon:"👨‍⚕️", color:"#06b6d4" },
  { id:"exp_023", name:"Pharmacy / Rx",        section:"Health",        icon:"💊", color:"#06b6d4" },
  { id:"exp_024", name:"Dental / Vision",      section:"Health",        icon:"🦷", color:"#06b6d4" },
  { id:"exp_025", name:"Gym / Fitness",        section:"Health",        icon:"💪", color:"#06b6d4" },
  // Personal
  { id:"exp_026", name:"Clothing / Apparel",   section:"Personal",      icon:"👕", color:"#8b5cf6" },
  { id:"exp_027", name:"Hair / Grooming",      section:"Personal",      icon:"✂️", color:"#8b5cf6" },
  { id:"exp_028", name:"Personal Care",        section:"Personal",      icon:"🧴", color:"#8b5cf6" },
  { id:"exp_029", name:"Education / Books",    section:"Personal",      icon:"📚", color:"#8b5cf6" },
  // Entertainment
  { id:"exp_030", name:"Streaming Services",   section:"Entertainment", icon:"📺", color:"#3b82f6" },
  { id:"exp_031", name:"Games / Hobbies",      section:"Entertainment", icon:"🎮", color:"#3b82f6" },
  { id:"exp_032", name:"Movies / Events",      section:"Entertainment", icon:"🎬", color:"#3b82f6" },
  { id:"exp_033", name:"Subscriptions",        section:"Entertainment", icon:"🔔", color:"#3b82f6" },
  // Shopping
  { id:"exp_034", name:"Amazon / Online",      section:"Shopping",      icon:"📦", color:"#f43f5e" },
  { id:"exp_035", name:"Electronics",          section:"Shopping",      icon:"💻", color:"#f43f5e" },
  { id:"exp_036", name:"Home Goods",           section:"Shopping",      icon:"🛋", color:"#f43f5e" },
  { id:"exp_037", name:"Gifts",                section:"Shopping",      icon:"🎁", color:"#f43f5e" },
  // Giving
  { id:"exp_038", name:"Charitable Giving",    section:"Giving",        icon:"❤️", color:"#ef4444" },
  { id:"exp_039", name:"Church / Tithe",       section:"Giving",        icon:"⛪", color:"#ef4444" },
  { id:"exp_040", name:"Family Support",       section:"Giving",        icon:"👨‍👩‍👧", color:"#ef4444" },
  // Savings
  { id:"exp_041", name:"Emergency Fund",       section:"Savings",       icon:"🏦", color:"#10b981" },
  { id:"exp_042", name:"Sinking Fund",         section:"Savings",       icon:"🪣", color:"#10b981" },
  { id:"exp_043", name:"Investment / Brokerage",section:"Savings",      icon:"📊", color:"#10b981" },
  { id:"exp_044", name:"Retirement (401k/IRA)",section:"Savings",       icon:"🏖", color:"#10b981" },
  // Debt Payments
  { id:"exp_045", name:"Credit Card Payment",  section:"Debt Payments", icon:"💳", color:"#ef4444" },
  { id:"exp_046", name:"Student Loan",         section:"Debt Payments", icon:"🎓", color:"#ef4444" },
  { id:"exp_047", name:"Personal Loan",        section:"Debt Payments", icon:"🏦", color:"#ef4444" },
  // Kids
  { id:"exp_048", name:"Childcare / Daycare",  section:"Kids",          icon:"👶", color:"#ec4899" },
  { id:"exp_049", name:"School / Tuition",     section:"Kids",          icon:"🏫", color:"#ec4899" },
  { id:"exp_050", name:"Kids Activities",      section:"Kids",          icon:"⚽", color:"#ec4899" },
  { id:"exp_051", name:"Baby Supplies",        section:"Kids",          icon:"🧸", color:"#ec4899" },
  // Travel
  { id:"exp_052", name:"Flights",              section:"Travel",        icon:"✈️", color:"#06b6d4" },
  { id:"exp_053", name:"Hotels / Lodging",     section:"Travel",        icon:"🏨", color:"#06b6d4" },
  { id:"exp_054", name:"Vacation / Travel",    section:"Travel",        icon:"🏝", color:"#06b6d4" },
  // Business
  { id:"exp_055", name:"Business Expense",     section:"Business",      icon:"💼", color:"#8b5cf6" },
  { id:"exp_056", name:"Software / Tools",     section:"Business",      icon:"🛠", color:"#8b5cf6" },
  // Misc
  { id:"exp_057", name:"Uncategorized",        section:"Misc",          icon:"❓", color:"#94a3b8" },
];

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
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // M/D/YYYY or MM/DD/YYYY
  const mdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,"0")}-${mdy[2].padStart(2,"0")}`;
  // M/D/YY
  const mdy2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdy2) {
    const yr = parseInt(mdy2[3]) >= 50 ? "19"+mdy2[3] : "20"+mdy2[3];
    return `${yr}-${mdy2[1].padStart(2,"0")}-${mdy2[2].padStart(2,"0")}`;
  }
  // Try native parse
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0,10);
  }
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

function computeRollingAvg(transactions, categoryId, selectedMonth, months) {
  months = months || 3;
  let totals = [];
  let cur = selectedMonth;
  for (let i = 0; i < months; i++) {
    cur = prevMonth(cur);
    const total = transactions
      .filter(t => t.categoryId === categoryId && t.date && t.date.startsWith(cur) && t.amount < 0)
      .reduce((s,t) => s + Math.abs(t.amount), 0);
    totals.push(total);
  }
  const sum = totals.reduce((a,b) => a+b, 0);
  return sum / months;
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
  const headers = { "Content-Type": "application/json" };
  if (apiKey?.trim()) headers["x-api-key"] = apiKey.trim();
  const res = await fetch(API_URL, { method:"POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res;
}

// ─── ProfileDropdown ──────────────────────────────────────────────────────────
function ProfileDropdown({ t, profiles, activeProfile, onSwitch, onClose }) {
  return (
    <div style={{ position:"absolute",top:"calc(100% + 6px)",right:0,background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,boxShadow:"0 8px 32px rgba(0,0,0,.3)",minWidth:200,zIndex:300,overflow:"hidden" }}>
      <div style={{ padding:"8px 14px 6px",borderBottom:`1px solid ${t.border}` }}>
        <span style={{ fontSize:11,fontWeight:600,color:t.tx3 }}>SWITCH PROFILE</span>
      </div>
      {profiles.map(p => (
        <div key={p.id} onClick={() => onSwitch(p)}
          style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",background:p.id===activeProfile?.id?COLOR.primary+"18":"transparent",borderBottom:`1px solid ${t.border}`,transition:"background .15s" }}>
          <div style={{ width:28,height:28,borderRadius:"50%",background:p.color||COLOR.primary,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0 }}>
            {(p.name||"?").charAt(0).toUpperCase()}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700,fontSize:13,color:t.tx1 }}>{p.name}</div>
            {p.id===activeProfile?.id && <div style={{ fontSize:10,color:COLOR.primary,fontWeight:600 }}>Active</div>}
          </div>
          {p.id===activeProfile?.id && <span style={{ fontSize:14,color:COLOR.primary }}>✓</span>}
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
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:t.panelBg,borderRadius:20,width:"100%",maxWidth:440,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ fontWeight:800,fontSize:17,color:t.tx1,marginBottom:4 }}>Anthropic API Key</div>
        <div style={{ fontSize:13,color:t.tx2,marginBottom:16 }}>Required for AI categorization and rule suggestions.</div>
        <label style={{ fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600 }}>API KEY</label>
        <input
          type="password"
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="sk-ant-..."
          style={{ width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx1,fontSize:13,boxSizing:"border-box",marginBottom:16 }}
        />
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Cancel</button>
          <button onClick={() => onSave(val.trim())} style={{ flex:1,background:COLOR.primary,border:"none",borderRadius:10,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── BackupModal ───────────────────────────────────────────────────────────────
function BackupModal({ t, transactions, accounts, categories, onClose }) {
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
    const rows = (transactions||[]).map(t2 =>
      [t2.date, `"${(t2.description||"").replace(/"/g,'""')}"`, t2.amount, catMap[t2.categoryId]||"", accMap[t2.accountId]||"", `"${(t2.notes||"").replace(/"/g,'""')}"`].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `spending-transactions-${currentYYYYMM()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:t.panelBg,borderRadius:20,width:"100%",maxWidth:380,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ fontWeight:800,fontSize:17,color:t.tx1,marginBottom:16 }}>Backup & Export</div>
        <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:16 }}>
          <button onClick={exportJSON} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"11px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:14 }}>
            📦 Full Backup (JSON)
          </button>
          <button onClick={exportCSV} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"11px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:14 }}>
            📄 Export Transactions (CSV)
          </button>
        </div>
        <button onClick={onClose} style={{ width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Close</button>
      </div>
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

// ─── AccountModal ─────────────────────────────────────────────────────────────
function AccountModal({ t, account, onSave, onClose }) {
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
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} style={{ flex:1,background:COLOR.primary,border:"none",borderRadius:10,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── AccountsModal ────────────────────────────────────────────────────────────
function AccountsModal({ t, accounts, onSave, onClose }) {
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  function handleDelete(id) {
    setConfirm(id);
  }
  function doDelete(id) {
    onSave(accounts.filter(a => a.id !== id));
    setConfirm(null);
  }
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
          <div style={{ textAlign:"center",padding:"20px 0",color:t.tx3,fontSize:13 }}>No accounts yet. Add one to get started.</div>
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
      {editing !== null && <AccountModal t={t} account={editing.id ? editing : null} onSave={handleSaveAccount} onClose={() => setEditing(null)} />}
      {confirm && <ConfirmModal t={t} message="Delete this account? This won't delete transactions." onConfirm={() => doDelete(confirm)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ─── TransactionModal ─────────────────────────────────────────────────────────
function TransactionModal({ t, transaction, accounts, categories, onSave, onClose }) {
  const [date,        setDate]        = useState(transaction?.date||currentYYYYMM()+"-01");
  const [description, setDescription] = useState(transaction?.description||"");
  const [amount,      setAmount]      = useState(transaction ? String(transaction.amount) : "");
  const [accountId,   setAccountId]   = useState(transaction?.accountId||accounts[0]?.id||"");
  const [categoryId,  setCategoryId]  = useState(transaction?.categoryId||"exp_057");
  const [notes,       setNotes]       = useState(transaction?.notes||"");

  function handleSave() {
    const amt = parseAmount(amount);
    if (!date || !description.trim() || amt === null) return;
    onSave({ ...(transaction||{}), id: transaction?.id||generateId(), date, description:description.trim(), amount:amt, accountId, categoryId, notes, categoryLocked:true, needsReview:false, importedAt: transaction?.importedAt||new Date().toISOString() });
  }

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
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="AMAZON.COM" style={{ ...inp, marginBottom:12 }} />
        <label style={lbl}>ACCOUNT</label>
        <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ ...inp, marginBottom:12 }}>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.nickname}</option>)}
          {accounts.length === 0 && <option value="">No accounts</option>}
        </select>
        <label style={lbl}>CATEGORY</label>
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={{ ...inp, marginBottom:12 }}>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <label style={lbl}>NOTES</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note..." style={{ ...inp, marginBottom:16 }} />
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} style={{ flex:1,background:COLOR.primary,border:"none",borderRadius:10,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14 }}>Save</button>
        </div>
      </div>
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
      <div style={{ fontSize:13,color:t.tx2,marginBottom:16 }}>Which account is this CSV from?</div>
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
        Next →
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

// ─── ImportStep4 — Deduplication ──────────────────────────────────────────────
function ImportStep4({ t, newTxns, dupeCount, onBack, onNext }) {
  return (
    <div>
      <StepDots step={4} total={5} />
      <div style={{ fontWeight:800,fontSize:17,color:t.tx1,marginBottom:4 }}>Deduplication</div>
      <div style={{ fontSize:13,color:t.tx2,marginBottom:16 }}>We detected duplicates by matching date + description + amount (±$0.01).</div>
      <div style={{ display:"flex",gap:12,marginBottom:16 }}>
        <div style={{ flex:1,background:t.surf,borderRadius:12,padding:"14px",textAlign:"center" }}>
          <div style={{ fontSize:24,fontWeight:800,color:COLOR.success }}>{newTxns}</div>
          <div style={{ fontSize:12,color:t.tx2 }}>New transactions</div>
        </div>
        <div style={{ flex:1,background:t.surf,borderRadius:12,padding:"14px",textAlign:"center" }}>
          <div style={{ fontSize:24,fontWeight:800,color:COLOR.warning }}>{dupeCount}</div>
          <div style={{ fontSize:12,color:t.tx2 }}>Duplicates skipped</div>
        </div>
      </div>
      {newTxns === 0 && (
        <div style={{ background:COLOR.warning+"18",border:`1px solid ${COLOR.warning}44`,borderRadius:10,padding:"10px 14px",fontSize:13,color:COLOR.warning,marginBottom:16 }}>
          All transactions already imported. Nothing new to add.
        </div>
      )}
      <div style={{ display:"flex",gap:10 }}>
        <button onClick={onBack} style={{ flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>← Back</button>
        <button onClick={onNext} disabled={newTxns===0} style={{ flex:2,background: newTxns>0 ? COLOR.primary : t.surf,border:"none",borderRadius:10,padding:"9px 0",color: newTxns>0 ? "#fff" : t.tx3,cursor: newTxns>0 ? "pointer" : "default",fontWeight:700,fontSize:14 }}>
          {newTxns>0 ? "Categorize →" : "Done"}
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
      setError("AI failed: " + e.message);
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

// ─── ImportWizard ─────────────────────────────────────────────────────────────
function ImportWizard({ t, accounts, categories, rules, transactions, apiKey, onComplete, onClose, onNewAccount }) {
  const [step,       setStep]       = useState(1);
  const [accountId,  setAccountId]  = useState(accounts[0]?.id||"");
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows,    setCsvRows]    = useState([]);
  const [colMap,     setColMap]     = useState({});
  const [flipSign,   setFlipSign]   = useState(false);
  const [parsed,     setParsed]     = useState([]);
  const [dupeCount,  setDupeCount]  = useState(0);
  const [showAccForm,setShowAccForm]= useState(false);
  const accountRef = useRef(accountId);
  useEffect(() => { accountRef.current = accountId; }, [accountId]);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const { headers, rows } = parseCSV(ev.target.result);
      setCsvHeaders(headers);
      setCsvRows(rows);
      const auto = autoDetectColumns(headers);
      const acc = accounts.find(a => a.id === accountRef.current);
      if (acc?.columnMap && Object.keys(acc.columnMap).length) {
        setColMap(acc.columnMap);
      } else {
        setColMap(auto);
      }
      setFlipSign(acc?.flipSign||false);
      setStep(2);
    };
    reader.readAsText(file);
  }

  function buildParsed() {
    const acc = accounts.find(a => a.id === accountId);
    const flip = flipSign;
    const existing = transactions || [];
    const newTxns = [];
    const dupes = [];
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
      const finalAmt = flip ? -amt : amt;
      const theirCat = colMap.category ? row[csvHeaders.indexOf(colMap.category)] : "";
      // dedup
      const isDupe = existing.some(ex =>
        ex.date === date &&
        ex.description.toLowerCase() === description.toLowerCase() &&
        Math.abs(ex.amount - finalAmt) < 0.01
      );
      if (isDupe) { dupes.push(1); continue; }
      // apply rules
      const matchedRule = applyRules(description, rules);
      newTxns.push({
        id: generateId(),
        accountId: accountId,
        date,
        description,
        amount: finalAmt,
        categoryId: matchedRule ? matchedRule.categoryId : (theirCat ? null : "exp_057"),
        categoryLocked: !!matchedRule,
        ruleId: matchedRule?.id || null,
        theirCategory: theirCat || null,
        notes: "",
        isSinkingFundCandidate: false,
        recurrencePattern: null,
        importedAt: new Date().toISOString(),
      });
    }
    return { newTxns, dupeCount: dupes.length };
  }

  function goToStep4() {
    const { newTxns, dupeCount: dc } = buildParsed();
    setParsed(newTxns);
    setDupeCount(dc);
    setStep(4);
  }

  function goToStep5() {
    // For txns that already have categoryLocked, keep. Others go to AI.
    setStep(5);
  }

  function handleNewAccount(acc) {
    onNewAccount(acc);
    setAccountId(acc.id);
    setShowAccForm(false);
  }

  if (showAccForm) return <AccountModal t={t} account={null} onSave={handleNewAccount} onClose={() => setShowAccForm(false)} />;

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto" }}>
      <div style={{ background:t.panelBg,borderRadius:20,width:"100%",maxWidth:480,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto",position:"relative" }}>
        <button onClick={onClose} style={{ position:"absolute",top:16,right:16,background:"transparent",border:"none",color:t.tx3,cursor:"pointer",fontSize:18 }}>×</button>

        {step === 1 && (
          <ImportStep1
            t={t} accounts={accounts} selectedAccountId={accountId}
            onSelect={id => setAccountId(id)}
            onNewAccount={() => setShowAccForm(true)}
            onNext={() => {
              const fileEl = document.getElementById("csv-file-input");
              if (fileEl) fileEl.click();
            }}
          />
        )}
        {step === 1 && <input id="csv-file-input" type="file" accept=".csv,.txt" style={{ display:"none" }} onChange={handleFile} />}
        {step === 2 && (
          <ImportStep2
            t={t} headers={csvHeaders} colMap={colMap}
            onColMap={setColMap}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <ImportStep3
            t={t} flipSign={flipSign} onFlipSign={setFlipSign}
            previewRows={csvRows.slice(0,3).map(row => {
              const obj = {};
              csvHeaders.forEach((h,i) => { obj[h] = row[i]; });
              return obj;
            })}
            colMap={colMap}
            onBack={() => setStep(2)}
            onNext={goToStep4}
          />
        )}
        {step === 4 && (
          <ImportStep4
            t={t} newTxns={parsed.length} dupeCount={dupeCount}
            onBack={() => setStep(3)}
            onNext={goToStep5}
          />
        )}
        {step === 5 && (
          <ImportStep5
            t={t} pending={parsed} categories={categories}
            apiKey={apiKey}
            onComplete={onComplete}
            onBack={() => setStep(4)}
          />
        )}
      </div>
    </div>
  );
}

// ─── FirstRunSetup ────────────────────────────────────────────────────────────
function FirstRunSetup({ t, onComplete }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(AVATAR_COLORS[0]);

  function handleCreate() {
    if (!name.trim()) return;
    const id = generateId();
    onComplete({ id, name: name.trim(), color, avatar: name.trim().charAt(0).toUpperCase() });
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
        <div style={{ display:"flex",gap:8,marginBottom:24,flexWrap:"wrap" }}>
          {AVATAR_COLORS.map(c => (
            <div key={c} onClick={() => setColor(c)} style={{ width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:color===c?"3px solid #fff":"2px solid transparent",boxSizing:"border-box" }} />
          ))}
        </div>
        <button onClick={handleCreate} disabled={!name.trim()} style={{ width:"100%",background: name.trim() ? COLOR.primary : t.surf,border:"none",borderRadius:10,padding:"11px 0",color: name.trim() ? "#fff" : t.tx3,cursor: name.trim() ? "pointer" : "default",fontWeight:700,fontSize:15 }}>
          Get Started
        </button>
      </div>
    </div>
  );
}

// ─── TransactionRow ───────────────────────────────────────────────────────────
function TransactionRow({ t, transaction, account, category, onEdit, onDelete }) {
  const flagged = transaction.needsReview === true;
  return (
    <div style={{ display:"grid",gridTemplateColumns:"90px 1fr 100px",gap:8,padding:"10px 0",paddingLeft: flagged ? 10 : 0,borderBottom:`1px solid ${t.border}`,borderLeft: flagged ? `3px solid ${COLOR.warning}` : "none",alignItems:"center" }}>
      <div>
        <div style={{ fontSize:12,color:t.tx2,fontFamily:"monospace" }}>{transaction.date}</div>
        {account && <div style={{ fontSize:10,color:t.tx3,marginTop:2 }}>{account.nickname}</div>}
      </div>
      <div style={{ minWidth:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:3 }}>
          <span style={{ fontSize:13,color:t.tx1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{transaction.description}</span>
          {flagged && <span style={{ fontSize:9,fontWeight:700,color:COLOR.warning,background:COLOR.warning+"22",border:`1px solid ${COLOR.warning}55`,borderRadius:4,padding:"1px 5px",whiteSpace:"nowrap",flexShrink:0 }}>REVIEW</span>}
        </div>
        <CategoryPill category={category} />
        {transaction.notes && <div style={{ fontSize:11,color:t.tx3,marginTop:2 }}>{transaction.notes}</div>}
      </div>
      <div style={{ textAlign:"right" }}>
        <div style={{ fontFamily:"monospace",fontSize:14,fontWeight:700,color: transaction.amount<0?COLOR.danger:COLOR.success }}>
          {fmt$(transaction.amount)}
        </div>
        <div style={{ display:"flex",gap:4,justifyContent:"flex-end",marginTop:4 }}>
          <button onClick={() => onEdit(transaction)} style={{ background:"transparent",border:`1px solid ${t.border}`,borderRadius:5,padding:"2px 7px",color:t.tx2,cursor:"pointer",fontSize:11 }}>Edit</button>
          <button onClick={() => onDelete(transaction.id)} style={{ background:"transparent",border:`1px solid ${COLOR.danger}33`,borderRadius:5,padding:"2px 7px",color:COLOR.danger,cursor:"pointer",fontSize:11 }}>×</button>
        </div>
      </div>
    </div>
  );
}

// ─── TransactionsTab ──────────────────────────────────────────────────────────
function TransactionsTab({ t, transactions, accounts, categories, rules, apiKey, onUpdateTransactions, onUpdateAccounts, onUpdateRules }) {
  const [month,           setMonth]           = useState(currentYYYYMM());
  const [search,          setSearch]          = useState("");
  const [filterAccId,     setFilterAccId]     = useState("all");
  const [filterCatId,     setFilterCatId]     = useState("all");
  const [editTx,          setEditTx]          = useState(null);
  const [showImport,      setShowImport]      = useState(false);
  const [confirmId,       setConfirmId]       = useState(null);
  const [reviewDismissed, setReviewDismissed] = useState(false);

  const catMap = Object.fromEntries(categories.map(c => [c.id,c]));
  const accMap = Object.fromEntries(accounts.map(a => [a.id,a]));

  const needsReviewCount = transactions.filter(tx => tx.date && tx.date.startsWith(month) && tx.needsReview === true).length;

  const filtered = transactions.filter(tx => {
    if (!tx.date.startsWith(month)) return false;
    if (filterAccId !== "all" && tx.accountId !== filterAccId) return false;
    if (filterCatId !== "all" && tx.categoryId !== filterCatId) return false;
    if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a,b) => b.date.localeCompare(a.date));

  const totalIncome  = filtered.filter(tx => tx.amount > 0).reduce((s,tx) => s+tx.amount, 0);
  const totalExpense = filtered.filter(tx => tx.amount < 0).reduce((s,tx) => s+Math.abs(tx.amount), 0);

  function handleSaveTx(tx) {
    const orig = transactions.find(t2 => t2.id === tx.id);
    const wasNeedsReview = orig?.needsReview === true;
    const saved = { ...tx, needsReview: false };

    let nextTxns = transactions.find(t2 => t2.id === saved.id)
      ? transactions.map(t2 => t2.id === saved.id ? saved : t2)
      : [...transactions, saved];

    // Confirm a Needs Review item → auto-create rule + retroactive apply
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

  function handleDelete(id) {
    setConfirmId(id);
  }

  function doDelete(id) {
    onUpdateTransactions(transactions.filter(t2 => t2.id !== id));
    setConfirmId(null);
  }

  function handleImportComplete(newTxns) {
    const merged = [...transactions];
    for (const tx of newTxns) {
      const idx = merged.findIndex(ex => ex.date===tx.date && ex.description.toLowerCase()===tx.description.toLowerCase() && Math.abs(ex.amount-tx.amount)<0.01);
      if (idx >= 0) merged[idx] = tx;
      else merged.push(tx);
    }
    onUpdateTransactions(merged);
    if (newTxns.some(tx => tx.needsReview)) setReviewDismissed(false);
    setShowImport(false);
  }

  function handleNewAccountFromImport(acc) {
    onUpdateAccounts([...accounts, acc]);
  }

  return (
    <div>
      {/* Header row */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8 }}>
        <MonthSelector t={t} month={month} onChange={setMonth} />
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={() => setShowImport(true)} style={{ background:COLOR.primary,border:"none",borderRadius:8,padding:"7px 14px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13 }}>+ Import CSV</button>
          <button onClick={() => setEditTx({})} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 14px",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13 }}>+ Add</button>
        </div>
      </div>

      {/* Needs Review banner */}
      {needsReviewCount > 0 && !reviewDismissed && (
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",background:COLOR.warning+"18",border:`1px solid ${COLOR.warning}55`,borderRadius:10,padding:"10px 14px",marginBottom:12 }}>
          <div>
            <span style={{ fontWeight:700,fontSize:13,color:COLOR.warning }}>⚠ {needsReviewCount} transaction{needsReviewCount>1?"s":""} need review</span>
            <span style={{ fontSize:12,color:t.tx2,marginLeft:8 }}>AI low-confidence — click Edit on flagged rows to confirm</span>
          </div>
          <button onClick={() => setReviewDismissed(true)} style={{ background:"transparent",border:"none",color:t.tx3,cursor:"pointer",fontSize:16,lineHeight:1,padding:"0 4px" }}>×</button>
        </div>
      )}

      {/* Summary pills */}
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
          <div style={{ fontFamily:"monospace",fontWeight:800,fontSize:16,color: totalIncome-totalExpense>=0?COLOR.success:COLOR.danger }}>{fmt$(totalIncome-totalExpense)}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          style={{ flex:1,minWidth:140,background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 12px",color:t.tx1,fontSize:13 }} />
        <select value={filterAccId} onChange={e => setFilterAccId(e.target.value)}
          style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 10px",color:t.tx1,fontSize:13 }}>
          <option value="all">All accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.nickname}</option>)}
        </select>
        <select value={filterCatId} onChange={e => setFilterCatId(e.target.value)}
          style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 10px",color:t.tx1,fontSize:13 }}>
          <option value="all">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </div>

      {/* Transaction list */}
      <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,padding:"0 16px" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign:"center",padding:"32px 0",color:t.tx3,fontSize:13 }}>No transactions found.</div>
        )}
        {filtered.map(tx => (
          <TransactionRow key={tx.id} t={t} transaction={tx} account={accMap[tx.accountId]} category={catMap[tx.categoryId]}
            onEdit={tx2 => setEditTx(tx2)} onDelete={handleDelete} />
        ))}
      </div>

      {editTx !== null && <TransactionModal t={t} transaction={editTx.id ? editTx : null} accounts={accounts} categories={categories} onSave={handleSaveTx} onClose={() => setEditTx(null)} />}
      {showImport && <ImportWizard t={t} accounts={accounts} categories={categories} rules={rules} transactions={transactions} apiKey={apiKey} onComplete={handleImportComplete} onClose={() => setShowImport(false)} onNewAccount={handleNewAccountFromImport} />}
      {confirmId && <ConfirmModal t={t} message="Delete this transaction?" onConfirm={() => doDelete(confirmId)} onCancel={() => setConfirmId(null)} />}
    </div>
  );
}

// ─── SummaryTab ───────────────────────────────────────────────────────────────
function SummaryTab({ t, transactions, categories }) {
  const [month, setMonth] = useState(currentYYYYMM());

  const catMap = Object.fromEntries(categories.map(c => [c.id,c]));

  // Spending by category this month (expenses only)
  const monthlySpend = {};
  for (const tx of transactions) {
    if (!tx.date.startsWith(month) || tx.amount >= 0) continue;
    const cid = tx.categoryId || "exp_057";
    monthlySpend[cid] = (monthlySpend[cid]||0) + Math.abs(tx.amount);
  }

  const rows = Object.entries(monthlySpend)
    .map(([catId, spent]) => {
      const avg = computeRollingAvg(transactions, catId, month, 3);
      const delta = avg > 0 ? (spent - avg) / avg : 0;
      const pct = delta;
      let deltaColor = COLOR.success;
      if (pct > 0.25) deltaColor = COLOR.danger;
      else if (pct > 0) deltaColor = COLOR.warning;
      return { catId, spent, avg, delta, deltaColor };
    })
    .sort((a,b) => b.spent - a.spent);

  const totalSpend = rows.reduce((s,r) => s+r.spent, 0);
  const totalAvg   = rows.reduce((s,r) => s+r.avg, 0);

  // Section grouping for chart
  const sections = {};
  for (const r of rows) {
    const cat = catMap[r.catId];
    const sec = cat?.section || "Other";
    sections[sec] = (sections[sec]||0) + r.spent;
  }
  const sectionEntries = Object.entries(sections).sort((a,b) => b[1]-a[1]).slice(0,8);

  // SVG bar chart
  const W=600, H=200, PL=10, PR=10, PT=10, PB=30;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const maxVal = Math.max(...sectionEntries.map(s => s[1]), 1);
  const barW = sectionEntries.length ? (cW / sectionEntries.length) * 0.7 : 30;
  const barGap = sectionEntries.length ? cW / sectionEntries.length : 60;
  const secColors = [COLOR.primary,COLOR.pink,COLOR.orange,COLOR.teal,COLOR.purple,COLOR.blue,COLOR.warning,COLOR.danger];

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8 }}>
        <MonthSelector t={t} month={month} onChange={setMonth} />
        <div style={{ fontSize:12,color:t.tx3 }}>vs. 3-month rolling avg</div>
      </div>

      {/* Chart */}
      {sectionEntries.length > 0 && (
        <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,padding:"16px 16px 8px",marginBottom:16,overflowX:"auto" }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width:"100%",height:160 }}>
            {sectionEntries.map(([sec,val],i) => {
              const bh = (val/maxVal)*cH;
              const x = PL + i*barGap + (barGap-barW)/2;
              const y = PT + cH - bh;
              const lbl = sec.length > 8 ? sec.slice(0,7)+"…" : sec;
              return (
                <g key={sec}>
                  <rect x={x} y={y} width={barW} height={bh} rx={4} fill={secColors[i%secColors.length]+"cc"} />
                  <text x={x+barW/2} y={H-PB+14} textAnchor="middle" fill={t.tx3} fontSize={9}>{lbl}</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Summary totals */}
      <div style={{ display:"flex",gap:10,marginBottom:16 }}>
        <div style={{ flex:1,background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 16px" }}>
          <div style={{ fontSize:11,color:t.tx2,fontWeight:600 }}>THIS MONTH</div>
          <div style={{ fontFamily:"monospace",fontWeight:800,fontSize:20,color:COLOR.danger }}>{fmt$(totalSpend)}</div>
        </div>
        <div style={{ flex:1,background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 16px" }}>
          <div style={{ fontSize:11,color:t.tx2,fontWeight:600 }}>3-MO AVG</div>
          <div style={{ fontFamily:"monospace",fontWeight:800,fontSize:20,color:t.tx1 }}>{fmt$(totalAvg)}</div>
        </div>
      </div>

      {/* Per-category table */}
      <div style={{ background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,overflow:"hidden" }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 90px 90px 70px",padding:"8px 16px",borderBottom:`1px solid ${t.border}`,gap:8 }}>
          <span style={{ fontSize:11,color:t.tx3,fontWeight:600 }}>CATEGORY</span>
          <span style={{ fontSize:11,color:t.tx3,fontWeight:600,textAlign:"right" }}>THIS MO.</span>
          <span style={{ fontSize:11,color:t.tx3,fontWeight:600,textAlign:"right" }}>3-MO AVG</span>
          <span style={{ fontSize:11,color:t.tx3,fontWeight:600,textAlign:"right" }}>DELTA</span>
        </div>
        {rows.length === 0 && (
          <div style={{ textAlign:"center",padding:"24px 0",color:t.tx3,fontSize:13 }}>No spending this month.</div>
        )}
        {rows.map(r => {
          const cat = catMap[r.catId];
          return (
            <div key={r.catId} style={{ display:"grid",gridTemplateColumns:"1fr 90px 90px 70px",padding:"10px 16px",borderBottom:`1px solid ${t.border}`,gap:8,alignItems:"center" }}>
              <CategoryPill category={cat} />
              <span style={{ fontFamily:"monospace",fontSize:13,fontWeight:700,color:COLOR.danger,textAlign:"right" }}>{fmt$(r.spent)}</span>
              <span style={{ fontFamily:"monospace",fontSize:13,color:t.tx2,textAlign:"right" }}>{r.avg > 0 ? fmt$(r.avg) : "—"}</span>
              <span style={{ fontFamily:"monospace",fontSize:12,fontWeight:700,color:r.deltaColor,textAlign:"right" }}>
                {r.avg > 0 ? (r.delta >= 0 ? "+" : "") + Math.round(r.delta*100) + "%" : "—"}
              </span>
            </div>
          );
        })}
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
      // Sample up to 60 uncategorized or low-confidence transactions
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
      setSuggestErr("AI failed: " + e.message);
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
          <span style={{ fontSize:11,color:t.tx3,fontWeight:600 }}>KEYWORD</span>
          <span style={{ fontSize:11,color:t.tx3,fontWeight:600 }}>MATCH</span>
          <span style={{ fontSize:11,color:t.tx3,fontWeight:600 }}>CATEGORY</span>
          <span style={{ fontSize:11,color:t.tx3,fontWeight:600 }}>PRI</span>
          <span style={{ fontSize:11,color:t.tx3,fontWeight:600 }}></span>
        </div>
        {rules.length === 0 && (
          <div style={{ textAlign:"center",padding:"24px 0",color:t.tx3,fontSize:13 }}>No rules yet. Add one or use AI Suggest.</div>
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

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loading,      setLoading]      = useState(true);
  const [darkMode,     setDarkMode]     = useState(() => localStorage.getItem("ffp_dark") !== "false");
  const [apiKey,       setApiKey]       = useState("");
  const [profiles,     setProfiles]     = useState([]);
  const [activeProfile,setActiveProfile]= useState(null);
  const [accounts,     setAccounts]     = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories,   setCategories]   = useState([]);
  const [rules,        setRules]        = useState([]);
  const [tab,          setTab]          = useState("transactions");
  const [showApiKey,     setShowApiKey]     = useState(false);
  const [showBackup,     setShowBackup]     = useState(false);
  const [showAccounts,   setShowAccounts]   = useState(false);
  const [showProfileMenu,setShowProfileMenu]= useState(false);

  const t = useTheme(darkMode);

  useEffect(() => { localStorage.setItem("ffp_dark", darkMode); }, [darkMode]);

  useEffect(() => {
    async function init() {
      const key = await storeGet("cc_apikey", true);
      if (key) setApiKey(key);

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
        }
        setCategories(cats);

        const rs = await storeGet(`ffp_cat_rules_${profile.id}`, true) || [];
        setRules(rs);
      }

      setLoading(false);
    }
    init();
  }, []);

  const saveAccounts = useCallback(async (next) => {
    setAccounts(next);
    if (activeProfile) await storeSet(`${MODULE_PREFIX}accounts_${activeProfile.id}`, next);
  }, [activeProfile]);

  const saveTransactions = useCallback(async (next) => {
    setTransactions(next);
    if (activeProfile) await storeSet(`${MODULE_PREFIX}transactions_${activeProfile.id}`, next);
  }, [activeProfile]);

  const saveRules = useCallback(async (next) => {
    setRules(next);
    if (activeProfile) await storeSet(`ffp_cat_rules_${activeProfile.id}`, next, true);
  }, [activeProfile]);

  async function handleSaveApiKey(key) {
    setApiKey(key);
    await storeSet("cc_apikey", key, true);
    setShowApiKey(false);
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
    }
    setCategories(cats);
    const rs = await storeGet(`ffp_cat_rules_${profile.id}`, true) || [];
    setRules(rs);
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

  return (
    <div style={{ minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif",color:t.tx1 }}>
      {/* Nav */}
      <div style={{ background:t.deepBg,borderBottom:`1px solid ${t.border}`,padding:"11px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#6366f1,#ec4899)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>📊</div>
          <span style={{ fontWeight:800,fontSize:18,color:t.tx1 }}>Spending Tracker</span>
          <span style={{ fontSize:10,color:t.tx2,background:t.surf,border:`1px solid ${t.border}`,borderRadius:6,padding:"2px 8px",fontFamily:"monospace" }}>{txCount} txns</span>
          <span style={{ fontSize:10,color:hasCloudStorage()?"#10b981":"#f59e0b",background:hasCloudStorage()?"#10b98118":"#f59e0b18",border:`1px solid ${hasCloudStorage()?"#10b98133":"#f59e0b33"}`,borderRadius:6,padding:"2px 8px" }}>
            {hasCloudStorage() ? "☁ Cloud Sync" : "💾 Local Only"}
          </span>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
          <button onClick={() => setShowAccounts(true)} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 11px",color:t.tx1,cursor:"pointer",fontSize:13,fontWeight:600 }}>🏦 Accounts</button>
          <button onClick={() => setShowBackup(true)} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 11px",color:t.tx1,cursor:"pointer",fontSize:13 }}>💾</button>
          <button onClick={() => setShowApiKey(true)} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 11px",color:t.tx1,cursor:"pointer",fontSize:13 }}>🔑</button>
          <div style={{ position:"relative" }}>
            <div onClick={() => setShowProfileMenu(m => !m)} style={{ width:32,height:32,borderRadius:"50%",background:activeProfile.color||COLOR.primary,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",userSelect:"none" }}>
              {(activeProfile.name||"?").charAt(0).toUpperCase()}
            </div>
            {showProfileMenu && (
              <ProfileDropdown t={t} profiles={profiles} activeProfile={activeProfile} onSwitch={handleSwitchProfile} onClose={() => setShowProfileMenu(false)} />
            )}
          </div>
          <button onClick={() => setDarkMode(d => !d)} style={{ background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 11px",color:t.tx1,cursor:"pointer",fontSize:14 }}>
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ maxWidth:1100,margin:"0 auto",padding:"20px 16px" }}>
        {/* Tabs */}
        <div style={{ display:"flex",gap:8,marginBottom:20 }}>
          <button style={tabStyle(tab==="transactions")} onClick={() => setTab("transactions")}>Transactions</button>
          <button style={tabStyle(tab==="summary")} onClick={() => setTab("summary")}>Summary</button>
          <button style={tabStyle(tab==="rules")} onClick={() => setTab("rules")}>Rules</button>
        </div>

        {tab === "transactions" && (
          <TransactionsTab
            t={t} transactions={transactions} accounts={accounts}
            categories={categories} rules={rules} apiKey={apiKey}
            onUpdateTransactions={saveTransactions}
            onUpdateAccounts={saveAccounts}
            onUpdateRules={saveRules}
          />
        )}
        {tab === "summary" && (
          <SummaryTab t={t} transactions={transactions} categories={categories} />
        )}
        {tab === "rules" && (
          <RulesTab t={t} rules={rules} categories={categories} transactions={transactions}
            apiKey={apiKey} onUpdateRules={saveRules} onUpdateTransactions={saveTransactions} />
        )}
      </div>

      {showApiKey   && <ApiKeyModal   t={t} apiKey={apiKey} onSave={handleSaveApiKey} onClose={() => setShowApiKey(false)} />}
      {showBackup   && <BackupModal   t={t} transactions={transactions} accounts={accounts} categories={categories} onClose={() => setShowBackup(false)} />}
      {showAccounts && <AccountsModal t={t} accounts={accounts} onSave={saveAccounts} onClose={() => setShowAccounts(false)} />}
    </div>
  );
}
