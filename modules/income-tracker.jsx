import { useState, useEffect, useRef } from "react";
// IncomeTracker v1.2

// ─── Constants ────────────────────────────────────────────────────────────────
const API_URL = "https://ffp-api-proxy.carterspot.workers.dev/"; // Reserved for future AI features
const MODEL   = "claude-sonnet-4-20250514";
const AVATAR_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];
const COLOR = {
  primary:"#6366f1", success:"#10b981", warning:"#f59e0b",
  danger:"#ef4444",  pink:"#ec4899",    blue:"#3b82f6",
  orange:"#f97316",  purple:"#8b5cf6",  teal:"#06b6d4",
};
const INCOME_TYPES    = ["W2","Self-Employment","Rental","Dividends","Side Business","Benefits","Other"];
const FREQUENCIES     = ["Weekly","Bi-Weekly","Semi-Monthly","Monthly","Quarterly","Annual","One-Time"];
const STABILITY_OPTS  = ["Stable","Mostly Stable","Variable","Irregular"];
const FREQ_MULT = {
  "Weekly":4.333,"Bi-Weekly":2.167,"Semi-Monthly":2,"Monthly":1,
  "Quarterly":0.333,"Annual":0.0833,"One-Time":0,
};
const STABILITY_COLOR = {
  "Stable":COLOR.success,"Mostly Stable":COLOR.teal,
  "Variable":COLOR.warning,"Irregular":COLOR.danger,
};
const TYPE_ICON = {
  "W2":"💼","Self-Employment":"🧾","Rental":"🏠","Dividends":"📈",
  "Side Business":"🏪","Benefits":"🏛️","Other":"💰",
};
const TYPE_COLORS = {
  "W2":"#6366f1","Self-Employment":"#10b981","Rental":"#3b82f6",
  "Dividends":"#f97316","Side Business":"#ec4899","Benefits":"#8b5cf6","Other":"#94a3b8",
};

// ─── Default Category Set (56 categories across 13 sections) ──────────────────
const DEFAULT_CATEGORIES = [
  // INCOME (8)
  { id:"inc_001", name:"Salary / W2",         icon:"💼", color:"#10b981", type:"income",  parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:1  },
  { id:"inc_002", name:"Self-Employment",      icon:"🧾", color:"#10b981", type:"income",  parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:2  },
  { id:"inc_003", name:"Side Business",        icon:"🏪", color:"#10b981", type:"income",  parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:3  },
  { id:"inc_004", name:"Rental Income",        icon:"🏠", color:"#10b981", type:"income",  parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:4  },
  { id:"inc_005", name:"Dividends / Interest", icon:"📈", color:"#10b981", type:"income",  parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:5  },
  { id:"inc_006", name:"Benefits / Gov",       icon:"🏛️", color:"#10b981", type:"income", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:6  },
  { id:"inc_007", name:"Gifts Received",       icon:"🎁", color:"#10b981", type:"income",  parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:7  },
  { id:"inc_008", name:"Other Income",         icon:"➕", color:"#10b981", type:"income",  parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:8  },
  // HOUSING (5)
  { id:"exp_001", name:"Mortgage / Rent",      icon:"🏠", color:"#3b82f6", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:9  },
  { id:"exp_002", name:"Property Tax",         icon:"🏛️", color:"#3b82f6", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:10 },
  { id:"exp_003", name:"HOA / Condo Fees",     icon:"🏘️", color:"#3b82f6", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:11 },
  { id:"exp_004", name:"Home Repairs",         icon:"🔧", color:"#3b82f6", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:12 },
  { id:"exp_005", name:"Home Insurance",       icon:"🛡️", color:"#3b82f6", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:13 },
  // UTILITIES (6)
  { id:"exp_006", name:"Electric",             icon:"⚡", color:"#06b6d4", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:14 },
  { id:"exp_007", name:"Gas / Heat",           icon:"🔥", color:"#06b6d4", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:15 },
  { id:"exp_008", name:"Water / Sewer",        icon:"💧", color:"#06b6d4", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:16 },
  { id:"exp_009", name:"Internet",             icon:"📡", color:"#06b6d4", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:17 },
  { id:"exp_010", name:"Phone",                icon:"📱", color:"#06b6d4", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:18 },
  { id:"exp_011", name:"Streaming / Cable",    icon:"📺", color:"#06b6d4", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:19 },
  // FOOD (3)
  { id:"exp_012", name:"Groceries",            icon:"🛒", color:"#f97316", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:20 },
  { id:"exp_013", name:"Dining Out",           icon:"🍽️", color:"#f97316", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:21 },
  { id:"exp_014", name:"Coffee / Drinks",      icon:"☕", color:"#f97316", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:22 },
  // TRANSPORT (6)
  { id:"exp_015", name:"Car Payment",          icon:"🚗", color:"#8b5cf6", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:23 },
  { id:"exp_016", name:"Gas / Fuel",           icon:"⛽", color:"#8b5cf6", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:24 },
  { id:"exp_017", name:"Auto Insurance",       icon:"🛡️", color:"#8b5cf6", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:25 },
  { id:"exp_018", name:"Car Maintenance",      icon:"🔩", color:"#8b5cf6", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:26 },
  { id:"exp_019", name:"Public Transit",       icon:"🚌", color:"#8b5cf6", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:27 },
  { id:"exp_020", name:"Parking / Tolls",      icon:"🅿️", color:"#8b5cf6", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:28 },
  // HEALTH (4)
  { id:"exp_021", name:"Health Insurance",     icon:"❤️", color:"#ef4444", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:29 },
  { id:"exp_022", name:"Medical / Dental",     icon:"🏥", color:"#ef4444", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:30 },
  { id:"exp_023", name:"Pharmacy / Rx",        icon:"💊", color:"#ef4444", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:31 },
  { id:"exp_024", name:"Gym / Fitness",        icon:"🏋️", color:"#ef4444", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:32 },
  // FAMILY & PERSONAL (5)
  { id:"exp_025", name:"Childcare",            icon:"👶", color:"#ec4899", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:33 },
  { id:"exp_026", name:"Education / Tuition",  icon:"🎓", color:"#ec4899", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:34 },
  { id:"exp_027", name:"Pet Care",             icon:"🐾", color:"#ec4899", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:35 },
  { id:"exp_028", name:"Clothing",             icon:"👕", color:"#ec4899", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:36 },
  { id:"exp_029", name:"Personal Care",        icon:"💆", color:"#ec4899", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:37 },
  // DEBT PAYMENTS (3)
  { id:"exp_030", name:"Credit Card Payment",  icon:"💳", color:"#6366f1", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:38 },
  { id:"exp_031", name:"Student Loan",         icon:"🎓", color:"#6366f1", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:39 },
  { id:"exp_032", name:"Personal Loan",        icon:"🏦", color:"#6366f1", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:40 },
  // SAVINGS & GIVING (5)
  { id:"exp_033", name:"Emergency Fund",       icon:"🛟", color:"#10b981", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:41 },
  { id:"exp_034", name:"Sinking Funds",        icon:"🪣", color:"#10b981", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:42 },
  { id:"exp_035", name:"Retirement",           icon:"📈", color:"#10b981", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:43 },
  { id:"exp_036", name:"Investments",          icon:"💹", color:"#10b981", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:44 },
  { id:"exp_037", name:"Tithe / Charity",      icon:"🙏", color:"#f59e0b", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:true,  alertConfig:{ pct:0.10, orgName:"", orgUrl:"" }, sortOrder:45 },
  // ENTERTAINMENT & LIFESTYLE (5)
  { id:"exp_038", name:"Entertainment",        icon:"🎬", color:"#ec4899", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:46 },
  { id:"exp_039", name:"Hobbies",              icon:"🎨", color:"#ec4899", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:47 },
  { id:"exp_040", name:"Travel / Vacation",    icon:"✈️", color:"#ec4899", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:48 },
  { id:"exp_041", name:"Gifts Given",          icon:"🎁", color:"#ec4899", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:49 },
  { id:"exp_042", name:"Subscriptions",        icon:"🔄", color:"#06b6d4", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:50 },
  // BUSINESS / WORK (2)
  { id:"exp_043", name:"Business Expenses",    icon:"💼", color:"#334155", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:51 },
  { id:"exp_044", name:"Work Meals / Travel",  icon:"🧳", color:"#334155", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:52 },
  // TAXES (2)
  { id:"exp_045", name:"Federal Tax",          icon:"🏛️", color:"#f59e0b", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:53 },
  { id:"exp_046", name:"State / Local Tax",    icon:"📋", color:"#f59e0b", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:54 },
  // CATCH-ALL (2)
  { id:"exp_047", name:"Miscellaneous",        icon:"📦", color:"#94a3b8", type:"expense", parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:55 },
  { id:"exp_048", name:"Uncategorized",        icon:"❓", color:"#94a3b8", type:"both",    parentId:null, isDefault:true, hidden:false, alertEnabled:false, alertConfig:{}, sortOrder:56 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateId  = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const fmt$        = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);
const toNum       = (s) => parseFloat(s)||0;
const getInitials = (n) => !n ? "?" : n.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
const toMonthly   = (amount, frequency) => toNum(amount) * (FREQ_MULT[frequency] ?? 1);

// ─── Theme ────────────────────────────────────────────────────────────────────
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

// ─── Breakpoint ───────────────────────────────────────────────────────────────
function useBreakpoint() {
  const [w, setW] = useState(960);
  useEffect(() => {
    const fn = () => setW(typeof window !== "undefined" ? window.innerWidth : 960);
    fn();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 640, isTablet: w < 960, isDesktop: w >= 960 };
}

// ─── API Key Probe ────────────────────────────────────────────────────────────
async function probeApiKey(key) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({ model: MODEL, max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
      signal: AbortSignal.timeout(8000),
    });
    return res.status === 200 ? "valid" : res.status === 401 ? "invalid" : "limited";
  } catch { return "unknown"; }
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

// ─── Style Helpers ────────────────────────────────────────────────────────────
function inputStyle(t) {
  return { width:"100%", background:t.surf, border:`1px solid ${t.border}`, borderRadius:8,
    padding:"8px 12px", color:t.tx1, fontSize:13, boxSizing:"border-box", outline:"none" };
}
function selectStyle(t) {
  return { ...inputStyle(t), cursor:"pointer" };
}
function labelSt(t) {
  return { fontSize:11, color:t.tx2, display:"block", marginBottom:4, fontWeight:600 };
}
function btnPrimary(extra={}) {
  return { background:COLOR.primary, border:"none", borderRadius:10, padding:"9px 20px",
    color:"#fff", cursor:"pointer", fontWeight:700, fontSize:14, transition:"all .2s", ...extra };
}
function btnGhost(t, extra={}) {
  return { background:t.surf, border:`1px solid ${t.border}`, borderRadius:10, padding:"9px 20px",
    color:t.tx1, cursor:"pointer", fontWeight:600, fontSize:13, transition:"all .15s", ...extra };
}
function panelSt(t, extra={}) {
  return { background:t.panelBg, border:`1px solid ${t.border}`, borderRadius:16, padding:"16px 20px", ...extra };
}
function overlayContainer(t, maxW=440) {
  return {
    overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,.72)", zIndex:2000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16, overflowY:"auto" },
    box: { background:t.panelBg, borderRadius:20, width:"100%", maxWidth:maxW, padding:24,
      boxShadow:"0 20px 60px rgba(0,0,0,.5)", maxHeight:"90vh", overflowY:"auto" },
  };
}

// ─── InfoModal ────────────────────────────────────────────────────────────────
function InfoModal({ open, onClose, title, body, t }) {
  if (!open) return null;
  const s = overlayContainer(t, 420);
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <div style={{fontSize:13,color:t.tx2,lineHeight:1.7}}>{body}</div>
        <button onClick={onClose} style={{...btnPrimary({width:"100%",marginTop:20})}}>Got it</button>
      </div>
    </div>
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
function ConfirmModal({ open, onClose, onConfirm, title, body, confirmLabel, confirmColor, t }) {
  if (!open) return null;
  const s = overlayContainer(t, 380);
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={{fontWeight:800,fontSize:17,color:t.tx1,marginBottom:12}}>{title||"Confirm"}</div>
        <div style={{fontSize:14,color:t.tx2,marginBottom:24,lineHeight:1.6}}>{body}</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
          <button onClick={onConfirm}
            style={{flex:1,background:confirmColor||COLOR.danger,border:"none",borderRadius:10,
              padding:"9px 20px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>
            {confirmLabel||"Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ApiKeyModal ──────────────────────────────────────────────────────────────
function ApiKeyModal({ open, onClose, apiKey, onSave, t }) {
  const [val, setVal] = useState(apiKey||"");
  const [show, setShow] = useState(false);
  useEffect(() => { if (open) { setVal(apiKey||""); setShow(false); } }, [open, apiKey]);
  if (!open) return null;
  const s = overlayContainer(t, 460);
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>🔑 Anthropic API Key</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <div style={{fontSize:12,color:t.tx2,marginBottom:16,lineHeight:1.6}}>
          Your API key is stored in your profile and shared across all Financial Freedom Platform modules.
          Get one at <span style={{color:COLOR.primary}}>console.anthropic.com</span>.
        </div>
        <label style={labelSt(t)}>API Key</label>
        <div style={{display:"flex",gap:8}}>
          <input type={show ? "text" : "password"} value={val} onChange={e => setVal(e.target.value)}
            placeholder="sk-ant-..." style={{...inputStyle(t), flex:1}} />
          <button onClick={() => setShow(s => !s)}
            style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,
              padding:"8px 12px",color:t.tx2,cursor:"pointer",fontSize:14}}>
            {show ? "🙈" : "👁"}
          </button>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
          <button onClick={() => onSave(val)} style={{...btnPrimary({flex:1})}}>Save Key</button>
        </div>
        {apiKey && (
          <button onClick={() => onSave("")} style={{width:"100%",marginTop:8,background:"none",
            border:`1px solid ${COLOR.danger}33`,borderRadius:8,padding:"7px",color:COLOR.danger,
            cursor:"pointer",fontSize:12}}>Remove Key</button>
        )}
      </div>
    </div>
  );
}

// ─── BackupModal ──────────────────────────────────────────────────────────────
function BackupModal({ open, onClose, streams, profileId, onImport, t }) {
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState("replace");
  const [importError, setImportError] = useState("");
  const [tab, setTab] = useState("export");
  const [csvText, setCsvText] = useState("");
  const [csvMode, setCsvMode] = useState("replace");
  const [csvError, setCsvError] = useState("");
  const fileRef = useRef(null);
  const csvFileRef = useRef(null);

  useEffect(() => { if (open) { setImportText(""); setImportError(""); setCsvText(""); setCsvError(""); setTab("export"); } }, [open]);

  function handleFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImportText(ev.target.result);
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleCSVFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCsvText(ev.target.result);
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleCSVImport() {
    setCsvError("");
    try {
      const lines = csvText.trim().split("\n");
      if (lines.length < 2) throw new Error("CSV appears empty.");
      const parsed = lines.slice(1).map(line => {
        const cols = [];
        let cur = "", inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQ = !inQ; }
          else if (ch === ',' && !inQ) { cols.push(cur); cur = ""; }
          else { cur += ch; }
        }
        cols.push(cur);
        const [id, name, type, amount, frequency, stabilityRating, afterTaxStr, startDate, endDate, notes, categoryId, color] = cols;
        return { id: id||generateId(), name, type, amount, frequency, stabilityRating,
          afterTax: afterTaxStr === "Yes" || afterTaxStr === "true",
          startDate: startDate||"", endDate: endDate||"", notes: notes||"",
          categoryId: categoryId||"", color: color||"#6366f1" };
      }).filter(s => s.name && s.name.trim());
      if (parsed.length === 0) throw new Error("No valid records found in CSV.");
      onImport({ version:"inc_1.0", streams: parsed }, csvMode);
      onClose();
    } catch(e) {
      setCsvError(e.message || "Invalid CSV");
    }
  }

  if (!open) return null;
  const s = overlayContainer(t, 520);

  function exportJSON() {
    const data = { version:"inc_1.0", exportedAt:new Date().toISOString(), profileId, streams };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `income-${profileId}-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  }

  function exportCSV() {
    const headers = ["id","name","type","amount","frequency","stabilityRating","afterTax","startDate","endDate","notes","categoryId","color"];
    const rows = streams.map(s => [
      s.id, s.name, s.type, s.amount, s.frequency,
      s.stabilityRating, s.afterTax ? "Yes" : "No",
      s.startDate||"", s.endDate||"", s.notes||"",
      s.categoryId||"", s.color||"",
    ]);
    const csv = [headers,...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `income-streams-${profileId}-${new Date().toISOString().slice(0,10)}.csv`;
    a.style.display = "none";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  function handleImport() {
    setImportError("");
    try {
      const data = JSON.parse(importText);
      if (!data.version?.startsWith("inc_")) throw new Error("Not an Income Tracker backup file.");
      onImport(data, importMode);
      onClose();
    } catch(e) {
      setImportError(e.message||"Invalid JSON");
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>📦 Backup & Restore</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <button onClick={() => setTab("export")}
            style={tab==="export" ? btnPrimary({padding:"7px 16px",fontSize:13}) : btnGhost(t,{padding:"7px 16px",fontSize:13})}>
            📤 Export
          </button>
          <button onClick={() => setTab("import")}
            style={tab==="import" ? btnPrimary({padding:"7px 16px",fontSize:13}) : btnGhost(t,{padding:"7px 16px",fontSize:13})}>
            📥 Import
          </button>
        </div>

        {tab==="export" ? (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button onClick={exportJSON} style={{...btnPrimary({background:COLOR.success})}}>
              ⬇ Download JSON (Full Backup)
            </button>
            <button onClick={exportCSV} style={{...btnGhost(t,{width:"100%"})}}>
              ⬇ Download CSV
            </button>
            <div style={{fontSize:11,color:t.tx3,marginTop:4,lineHeight:1.6}}>
              JSON backup includes all stream data and can be restored. CSV is a flat export for spreadsheet use.
            </div>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div>
              <input ref={fileRef} type="file" accept=".json" onChange={handleFile} style={{display:"none"}} />
              <button onClick={() => fileRef.current?.click()}
                style={{...btnGhost(t,{width:"100%",padding:"10px",fontSize:13})}}>
                📂 Restore Backup
              </button>
            </div>
            <div>
              <label style={labelSt(t)}>Paste JSON backup below</label>
              <textarea value={importText} onChange={e => setImportText(e.target.value)}
                rows={6} placeholder='{"version":"inc_1.0",...}'
                style={{...inputStyle(t), resize:"vertical", fontFamily:"monospace", fontSize:11}} />
            </div>
            <div>
              <label style={labelSt(t)}>Import Mode</label>
              <div style={{display:"flex",gap:8}}>
                <button onClick={() => setImportMode("replace")}
                  style={importMode==="replace" ? btnPrimary({flex:1,fontSize:13,padding:"7px 0"}) : btnGhost(t,{flex:1,fontSize:13,padding:"7px 0"})}>
                  ⚠ Replace All
                </button>
                <button onClick={() => setImportMode("merge")}
                  style={importMode==="merge" ? btnPrimary({flex:1,fontSize:13,padding:"7px 0"}) : btnGhost(t,{flex:1,fontSize:13,padding:"7px 0"})}>
                  + Merge
                </button>
              </div>
              <div style={{fontSize:10,color:t.tx3,marginTop:5}}>
                {importMode==="replace" ? "Replaces all existing income streams with the backup." : "Adds new streams from backup, skips duplicates."}
              </div>
            </div>
            {importError && (
              <div style={{fontSize:12,color:COLOR.danger,background:COLOR.danger+"11",
                border:`1px solid ${COLOR.danger}33`,borderRadius:8,padding:"8px 12px"}}>
                {importError}
              </div>
            )}
            <button onClick={handleImport} disabled={!importText.trim()}
              style={{...btnPrimary({
                background:importText.trim()?COLOR.warning:t.surf,
                color:importText.trim()?"#fff":t.tx3,
                cursor:importText.trim()?"pointer":"default",
              })}}>
              Import Data
            </button>

            <div style={{borderTop:`1px solid ${t.border}`,marginTop:8,paddingTop:16}}>
              <div style={{fontSize:12,fontWeight:700,color:t.tx2,marginBottom:10}}>CSV Import</div>
              <div>
                <input ref={csvFileRef} type="file" accept=".csv" onChange={handleCSVFile} style={{display:"none"}} />
                <button onClick={() => csvFileRef.current?.click()}
                  style={{...btnGhost(t,{width:"100%",padding:"10px",fontSize:13})}}>
                  📂 Load CSV File
                </button>
              </div>
              {csvText.trim() && (
                <div style={{marginTop:10}}>
                  <label style={labelSt(t)}>Import Mode</label>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={() => setCsvMode("replace")}
                      style={csvMode==="replace" ? btnPrimary({flex:1,fontSize:13,padding:"7px 0"}) : btnGhost(t,{flex:1,fontSize:13,padding:"7px 0"})}>
                      Replace All
                    </button>
                    <button onClick={() => setCsvMode("merge")}
                      style={csvMode==="merge" ? btnPrimary({flex:1,fontSize:13,padding:"7px 0"}) : btnGhost(t,{flex:1,fontSize:13,padding:"7px 0"})}>
                      + Merge
                    </button>
                  </div>
                  <div style={{fontSize:10,color:t.tx3,marginTop:5}}>
                    {csvMode==="replace" ? "Replaces all existing income streams." : "Adds new streams, skips duplicates by id."}
                  </div>
                </div>
              )}
              {csvError && (
                <div style={{fontSize:12,color:COLOR.danger,background:COLOR.danger+"11",
                  border:`1px solid ${COLOR.danger}33`,borderRadius:8,padding:"8px 12px",marginTop:8}}>
                  {csvError}
                </div>
              )}
              {csvText.trim() && (
                <button onClick={handleCSVImport}
                  style={{...btnPrimary({background:COLOR.warning,marginTop:10,width:"100%"})}}>
                  Import CSV
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FirstRunSetup ────────────────────────────────────────────────────────────
function FirstRunSetup({ darkMode, setDarkMode, onSave }) {
  const [name, setName]           = useState("");
  const [pin, setPin]             = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [saving, setSaving]       = useState(false);
  const t = useTheme(darkMode);

  async function handleCreate() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const stableId = pin.trim()
      ? "pin_" + pin.trim().toLowerCase().replace(/\s+/g,"_")
      : generateId();
    const profile = { id:stableId, name:name.trim(), avatarColor, pin:pin.trim(), createdAt:new Date().toISOString() };
    await onSave(profile);
    setSaving(false);
  }

  return (
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif",
      color:t.tx1,display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",padding:"40px 16px"}}>
      <div style={{width:"100%",maxWidth:440}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:52,marginBottom:12}}>💰</div>
          <div style={{fontWeight:800,fontSize:26,color:t.tx1,marginBottom:8}}>Welcome to Income Tracker</div>
          <div style={{fontSize:14,color:t.tx2,lineHeight:1.6,maxWidth:340,margin:"0 auto"}}>
            Track all your income streams by type, frequency, and stability. Know exactly how much you earn each month.
          </div>
        </div>

        <div style={{background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:20,
          padding:24,boxShadow:"0 8px 32px rgba(0,0,0,.12)"}}>
          <div style={{background:"#6366f118",border:"1px solid #6366f133",borderRadius:12,
            padding:"12px 14px",marginBottom:20}}>
            <div style={{fontSize:12,fontWeight:700,color:COLOR.primary,marginBottom:4}}>👋 Create your profile to get started</div>
            <div style={{fontSize:11,color:t.tx2,lineHeight:1.6}}>
              Your income data is saved to your profile. Set an optional PIN to recover data on any device — even without a cloud account.
            </div>
          </div>

          <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
            <div style={{width:64,height:64,borderRadius:"50%",background:avatarColor,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:22,fontWeight:800,color:"#fff",boxShadow:`0 0 0 4px ${avatarColor}44`}}>
              {getInitials(name)}
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <label style={{fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600}}>
                Display Name <span style={{color:COLOR.danger}}>*</span>
              </label>
              <input style={inputStyle(t)} value={name} onChange={e => setName(e.target.value)}
                placeholder="Your Name" />
            </div>
            <div>
              <label style={{fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600}}>
                Recovery PIN <span style={{color:t.tx3,fontWeight:400}}>(optional but recommended)</span>
              </label>
              <input style={inputStyle(t)} value={pin} onChange={e => setPin(e.target.value)}
                placeholder="e.g. smithfamily or john2024" />
              <div style={{fontSize:10,color:t.tx3,marginTop:5,lineHeight:1.5}}>
                💡 Enter the same PIN on a new device to recover all your data. <strong style={{color:t.tx2}}>Write it down somewhere safe.</strong>
              </div>
            </div>
            <div>
              <label style={{fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600}}>Avatar Color</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {AVATAR_COLORS.map(c => (
                  <div key={c} onClick={() => setAvatarColor(c)}
                    style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",
                      border:avatarColor===c?"3px solid #fff":"2px solid transparent",
                      boxShadow:avatarColor===c?`0 0 0 2px ${c}`:"none",transition:"all .15s"}} />
                ))}
              </div>
            </div>
            <button onClick={handleCreate} disabled={!name.trim()||saving}
              style={{background:name.trim()?avatarColor:t.surf,border:"none",borderRadius:10,
                padding:"12px 0",color:name.trim()?"#fff":t.tx3,width:"100%",
                cursor:name.trim()?"pointer":"default",fontWeight:700,fontSize:15,
                marginTop:4,transition:"all .2s"}}>
              {saving ? "Creating…" : "Create Profile & Continue"}
            </button>
          </div>
        </div>

        <div style={{textAlign:"center",marginTop:20}}>
          <button onClick={() => setDarkMode(d => !d)} style={btnGhost(t,{fontSize:12,padding:"6px 14px"})}>
            {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EditProfileModal ─────────────────────────────────────────────────────────
function EditProfileModal({ open, onClose, profile, profiles, onSave, t }) {
  const [name, setName] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (open && profile) {
      setName(profile.name || "");
      setAvatarColor(profile.avatarColor || AVATAR_COLORS[0]);
      setPin(profile.pin || "");
    }
  }, [open, profile]);

  if (!open) return null;
  const s = overlayContainer(t, 420);

  function handleSave() {
    if (!name.trim()) return;
    const updated = profiles.map(p => p.id === profile.id
      ? { ...p, name: name.trim(), avatarColor, pin: pin.trim() }
      : p
    );
    onSave(updated);
    onClose();
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>Edit Profile</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>x</button>
        </div>
        <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
          <div style={{width:56,height:56,borderRadius:"50%",background:avatarColor,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:20,fontWeight:800,color:"#fff",boxShadow:`0 0 0 3px ${avatarColor}44`}}>
            {getInitials(name)}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={labelSt(t)}>Display Name</label>
            <input style={inputStyle(t)} value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" />
          </div>
          <div>
            <label style={labelSt(t)}>Recovery PIN <span style={{color:t.tx3,fontWeight:400}}>(optional)</span></label>
            <input style={inputStyle(t)} value={pin} onChange={e => setPin(e.target.value)} placeholder="e.g. smithfamily" />
          </div>
          <div>
            <label style={labelSt(t)}>Avatar Color</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {AVATAR_COLORS.map(c => (
                <div key={c} onClick={() => setAvatarColor(c)}
                  style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",
                    border:avatarColor===c?"3px solid #fff":"2px solid transparent",
                    boxShadow:avatarColor===c?`0 0 0 2px ${c}`:"none",transition:"all .15s"}} />
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
            <button onClick={handleSave} disabled={!name.trim()}
              style={{...btnPrimary({flex:1,background:name.trim()?COLOR.primary:t.surf,
                color:name.trim()?"#fff":t.tx3,cursor:name.trim()?"pointer":"default"})}}>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AddProfileModal ──────────────────────────────────────────────────────────
function AddProfileModal({ open, onClose, profiles, onSave, t }) {
  const [name, setName] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (open) { setName(""); setAvatarColor(AVATAR_COLORS[0]); setPin(""); }
  }, [open]);

  if (!open) return null;
  const s = overlayContainer(t, 420);

  function handleCreate() {
    if (!name.trim()) return;
    const stableId = pin.trim()
      ? "pin_" + pin.trim().toLowerCase().replace(/\s+/g,"_")
      : generateId();
    const profile = { id:stableId, name:name.trim(), avatarColor, pin:pin.trim(), createdAt:new Date().toISOString() };
    onSave([...profiles, profile], profile.id);
    onClose();
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>Add New Profile</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>x</button>
        </div>
        <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
          <div style={{width:56,height:56,borderRadius:"50%",background:avatarColor,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:20,fontWeight:800,color:"#fff",boxShadow:`0 0 0 3px ${avatarColor}44`}}>
            {getInitials(name)}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={labelSt(t)}>Display Name</label>
            <input style={inputStyle(t)} value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" />
          </div>
          <div>
            <label style={labelSt(t)}>Recovery PIN <span style={{color:t.tx3,fontWeight:400}}>(optional)</span></label>
            <input style={inputStyle(t)} value={pin} onChange={e => setPin(e.target.value)} placeholder="e.g. smithfamily" />
          </div>
          <div>
            <label style={labelSt(t)}>Avatar Color</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {AVATAR_COLORS.map(c => (
                <div key={c} onClick={() => setAvatarColor(c)}
                  style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",
                    border:avatarColor===c?"3px solid #fff":"2px solid transparent",
                    boxShadow:avatarColor===c?`0 0 0 2px ${c}`:"none",transition:"all .15s"}} />
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
            <button onClick={handleCreate} disabled={!name.trim()}
              style={{...btnPrimary({flex:1,background:name.trim()?avatarColor:t.surf,
                color:name.trim()?"#fff":t.tx3,cursor:name.trim()?"pointer":"default"})}}>
              Create Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NavBar ───────────────────────────────────────────────────────────────────
function NavBar({ profiles, activeProfile, darkMode, setDarkMode, apiKey, apiKeyStatus,
  onOpenApiKey, onOpenBackup, onSwitchProfile, onEditProfile, onAddProfile, streamCount, t }) {
  const [showProfiles, setShowProfiles] = useState(false);
  const cloud = hasCloudStorage();
  const bp = useBreakpoint();

  return (
    <div style={{background:t.deepBg,borderBottom:`1px solid ${t.border}`,padding:"11px 20px",
      display:"flex",justifyContent:"space-between",alignItems:"center",
      position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:bp.isMobile?6:10,flexWrap:"wrap"}}>
        <div style={{width:32,height:32,borderRadius:8,
          background:"linear-gradient(135deg,#10b981,#6366f1)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>💰</div>
        {!bp.isMobile && <span style={{fontWeight:800,fontSize:18,color:t.tx1}}>Income Tracker</span>}
        <span style={{fontSize:10,color:COLOR.success,background:COLOR.success+"18",
          border:`1px solid ${COLOR.success}33`,borderRadius:6,padding:"2px 8px",fontWeight:700}}>
          {streamCount} stream{streamCount!==1?"s":""}
        </span>
        {!bp.isMobile && (
          <span style={{fontSize:10,color:cloud?COLOR.success:COLOR.warning,
            background:cloud?COLOR.success+"18":COLOR.warning+"18",
            border:`1px solid ${cloud?COLOR.success+"33":COLOR.warning+"33"}`,
            borderRadius:6,padding:"2px 8px",fontWeight:600}}>
            {cloud ? "☁ Cloud Sync" : "💾 Local Only"}
          </span>
        )}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <button onClick={() => setDarkMode(d => !d)}
          style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,
            padding:"6px 11px",color:t.tx1,cursor:"pointer",fontSize:14}}>
          {darkMode ? "☀️" : "🌙"}
        </button>
        <button onClick={onOpenBackup}
          style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,
            padding:"6px 11px",color:t.tx2,cursor:"pointer",fontSize:14}}
          title="Backup & Restore">💾</button>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <button onClick={onOpenApiKey}
            style={{background:apiKey?COLOR.purple+"18":t.surf,
              border:`1px solid ${apiKey?COLOR.purple+"44":t.border}`,
              borderRadius:8,padding:"6px 11px",color:apiKey?COLOR.purple:t.tx2,cursor:"pointer",fontSize:14}}
            title="API Key">🔑</button>
          {apiKeyStatus==="valid" && (
            <div style={{width:8,height:8,borderRadius:"50%",background:COLOR.success}} title="AI ready" />
          )}
          {apiKeyStatus==="invalid" && (
            <span style={{fontSize:10,color:COLOR.warning,fontWeight:700}}>Key invalid</span>
          )}
          {apiKeyStatus==="limited" && (
            <div style={{width:8,height:8,borderRadius:"50%",background:COLOR.warning}} title="Rate limited" />
          )}
        </div>
        {activeProfile && (
          <div style={{position:"relative"}}>
            <button onClick={() => setShowProfiles(s => !s)}
              style={{width:34,height:34,borderRadius:"50%",
                background:activeProfile.avatarColor||COLOR.primary,
                border:"none",cursor:"pointer",fontSize:13,fontWeight:800,color:"#fff",
                display:"flex",alignItems:"center",justifyContent:"center"}}>
              {(activeProfile.name||"?")[0].toUpperCase()}
            </button>
            {showProfiles && (
              <div style={{position:"absolute",right:0,top:40,background:t.panelBg,
                border:`1px solid ${t.border}`,borderRadius:12,padding:8,
                boxShadow:"0 8px 24px rgba(0,0,0,.3)",zIndex:200,minWidth:180}}>
                {profiles.map(p => (
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:4}}>
                    <button onClick={() => { onSwitchProfile(p.id); setShowProfiles(false); }}
                      style={{display:"flex",alignItems:"center",gap:8,flex:1,border:"none",
                        padding:"8px 10px",cursor:"pointer",borderRadius:8,color:t.tx1,fontSize:13,
                        background:p.id===activeProfile?.id?COLOR.primary+"18":"none",textAlign:"left"}}>
                      <div style={{width:24,height:24,borderRadius:"50%",background:p.avatarColor||COLOR.primary,
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,
                        fontWeight:800,color:"#fff",flexShrink:0}}>
                        {(p.name||"?")[0].toUpperCase()}
                      </div>
                      <span>{p.name}</span>
                    </button>
                    {p.id===activeProfile?.id && (
                      <button onClick={() => { setShowProfiles(false); onEditProfile(); }}
                        style={{background:"none",border:"none",cursor:"pointer",color:t.tx2,
                          padding:"4px 6px",borderRadius:6,fontSize:13}}
                        title="Edit profile">
                        ✏️
                      </button>
                    )}
                  </div>
                ))}
                <div style={{borderTop:`1px solid ${t.border}`,marginTop:4,paddingTop:4}}>
                  <button onClick={() => { setShowProfiles(false); onAddProfile(); }}
                    style={{display:"flex",alignItems:"center",gap:8,width:"100%",border:"none",
                      padding:"8px 10px",cursor:"pointer",borderRadius:8,color:COLOR.primary,
                      fontSize:13,background:"none",textAlign:"left",fontWeight:600}}>
                    + Add New Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SummaryDashboard ─────────────────────────────────────────────────────────
function SummaryDashboard({ streams, t }) {
  const recurring    = streams.filter(s => s.frequency !== "One-Time");
  const oneTimeSums  = streams.filter(s => s.frequency === "One-Time");
  const totalMo      = recurring.reduce((sum,s) => sum + toMonthly(s.amount, s.frequency), 0);
  const totalOneTime = oneTimeSums.reduce((sum,s) => sum + toNum(s.amount), 0);
  const bp = useBreakpoint();

  const byType = {};
  INCOME_TYPES.forEach(tp => { byType[tp] = 0; });
  recurring.forEach(s => { byType[s.type] = (byType[s.type]||0) + toMonthly(s.amount, s.frequency); });
  const typeEntries = INCOME_TYPES
    .filter(tp => byType[tp] > 0)
    .map(tp => ({ type:tp, monthly:byType[tp] }));
  const barTotal = typeEntries.reduce((s,e) => s+e.monthly, 0);

  return (
    <div style={panelSt(t,{marginBottom:20})}>
      <div style={{fontWeight:700,fontSize:15,color:t.tx1,marginBottom:16}}>Income Summary</div>

      <div style={{display:"grid",gridTemplateColumns:bp.isMobile?"1fr 1fr":"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <div style={{background:t.surf,borderRadius:12,padding:"14px 16px"}}>
          <div style={{fontSize:10,color:t.tx2,fontWeight:700,letterSpacing:.5,marginBottom:6}}>MONTHLY INCOME</div>
          <div style={{fontFamily:"monospace",fontSize:22,fontWeight:800,color:COLOR.success}}>{fmt$(totalMo)}</div>
          <div style={{fontSize:10,color:t.tx3,marginTop:2}}>recurring streams</div>
        </div>
        <div style={{background:t.surf,borderRadius:12,padding:"14px 16px"}}>
          <div style={{fontSize:10,color:t.tx2,fontWeight:700,letterSpacing:.5,marginBottom:6}}>ANNUAL INCOME</div>
          <div style={{fontFamily:"monospace",fontSize:22,fontWeight:800,color:COLOR.primary}}>{fmt$(totalMo*12)}</div>
          <div style={{fontSize:10,color:t.tx3,marginTop:2}}>projected 12-month</div>
        </div>
        <div style={{background:t.surf,borderRadius:12,padding:"14px 16px"}}>
          <div style={{fontSize:10,color:t.tx2,fontWeight:700,letterSpacing:.5,marginBottom:6}}>INCOME STREAMS</div>
          <div style={{fontFamily:"monospace",fontSize:22,fontWeight:800,color:t.tx1}}>{streams.length}</div>
          <div style={{fontSize:10,color:t.tx3,marginTop:2}}>
            {recurring.length} recurring{oneTimeSums.length>0?`, ${oneTimeSums.length} one-time`:""}
          </div>
        </div>
        {totalOneTime > 0 && (
          <div style={{background:t.surf,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:10,color:t.tx2,fontWeight:700,letterSpacing:.5,marginBottom:6}}>ONE-TIME</div>
            <div style={{fontFamily:"monospace",fontSize:22,fontWeight:800,color:COLOR.teal}}>{fmt$(totalOneTime)}</div>
            <div style={{fontSize:10,color:t.tx3,marginTop:2}}>not in monthly total</div>
          </div>
        )}
      </div>

      {typeEntries.length > 0 && (
        <div>
          <div style={{fontSize:10,color:t.tx2,fontWeight:700,letterSpacing:.5,marginBottom:8}}>INCOME BY TYPE</div>
          {typeEntries.length > 1 && (
            <div style={{borderRadius:8,overflow:"hidden",height:14,display:"flex",marginBottom:10,gap:1}}>
              {typeEntries.map(e => (
                <div key={e.type}
                  title={`${e.type}: ${fmt$(e.monthly)}/mo (${Math.round(e.monthly/barTotal*100)}%)`}
                  style={{height:"100%",
                    width:`${barTotal>0 ? e.monthly/barTotal*100 : 0}%`,
                    background:TYPE_COLORS[e.type]||COLOR.primary,
                    minWidth:barTotal>0?2:0}} />
              ))}
            </div>
          )}
          <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
            {typeEntries.map(e => (
              <div key={e.type} style={{display:"flex",alignItems:"center",gap:6,
                background:t.surf,borderRadius:8,padding:"5px 10px"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:TYPE_COLORS[e.type]||COLOR.primary,flexShrink:0}} />
                <span style={{fontSize:12,color:t.tx2}}>{TYPE_ICON[e.type]} {e.type}</span>
                <span style={{fontSize:12,fontFamily:"monospace",color:t.tx1,fontWeight:700}}>{fmt$(e.monthly)}<span style={{fontSize:10,color:t.tx3,fontWeight:400}}>/mo</span></span>
                {barTotal>0 && <span style={{fontSize:10,color:t.tx3}}>{Math.round(e.monthly/barTotal*100)}%</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── StreamCard ───────────────────────────────────────────────────────────────
function StreamCard({ stream, categories, onEdit, onDelete, t }) {
  const monthly   = toMonthly(stream.amount, stream.frequency);
  const stabColor = STABILITY_COLOR[stream.stabilityRating]||COLOR.warning;
  const category  = categories.find(c => c.id === stream.categoryId);
  const isOneTime = stream.frequency === "One-Time";

  return (
    <div style={panelSt(t,{marginBottom:12})}>
      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
        <div style={{width:44,height:44,borderRadius:12,background:stream.color||COLOR.primary,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>
          {TYPE_ICON[stream.type]||"💰"}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:5}}>
            <span style={{fontWeight:700,fontSize:15,color:t.tx1}}>{stream.name}</span>
            <span style={{fontSize:10,color:stabColor,background:stabColor+"18",
              border:`1px solid ${stabColor}33`,borderRadius:6,padding:"1px 7px",fontWeight:600}}>
              {stream.stabilityRating}
            </span>
            {stream.afterTax && (
              <span style={{fontSize:10,color:COLOR.success,background:COLOR.success+"18",
                border:`1px solid ${COLOR.success}33`,borderRadius:6,padding:"1px 7px",fontWeight:600}}>
                After-Tax
              </span>
            )}
            {isOneTime && (
              <span style={{fontSize:10,color:COLOR.teal,background:COLOR.teal+"18",
                border:`1px solid ${COLOR.teal}33`,borderRadius:6,padding:"1px 7px",fontWeight:600}}>
                One-Time
              </span>
            )}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
            <span style={{fontSize:12,color:t.tx2,fontWeight:600}}>{stream.type}</span>
            <span style={{fontSize:12,color:t.tx3}}>·</span>
            <span style={{fontSize:12,color:t.tx2}}>{stream.frequency}</span>
            {category && (
              <>
                <span style={{fontSize:12,color:t.tx3}}>·</span>
                <span style={{fontSize:12,color:t.tx2}}>{category.icon} {category.name}</span>
              </>
            )}
          </div>
          {stream.notes && (
            <div style={{fontSize:11,color:t.tx3,marginTop:4,fontStyle:"italic",lineHeight:1.4}}>
              {stream.notes}
            </div>
          )}
        </div>
        <div style={{textAlign:"right",flexShrink:0,minWidth:100}}>
          <div style={{fontFamily:"monospace",fontSize:19,fontWeight:800,color:COLOR.success}}>
            {fmt$(toNum(stream.amount))}
          </div>
          <div style={{fontSize:11,color:t.tx3,marginBottom:2}}>/{stream.frequency}</div>
          {!isOneTime && monthly!==toNum(stream.amount) && (
            <div style={{fontSize:11,color:t.tx2,fontFamily:"monospace",fontWeight:600}}>
              {fmt$(monthly)}<span style={{fontWeight:400}}>/mo</span>
            </div>
          )}
        </div>
      </div>

      {(stream.startDate || stream.endDate) && (
        <div style={{display:"flex",gap:16,marginTop:10,paddingTop:10,borderTop:`1px solid ${t.border}`,flexWrap:"wrap"}}>
          {stream.startDate && (
            <span style={{fontSize:11,color:t.tx3}}>
              Started: <span style={{color:t.tx2}}>{stream.startDate}</span>
            </span>
          )}
          {stream.endDate && (
            <span style={{fontSize:11,color:t.tx3}}>
              Ends: <span style={{color:COLOR.warning}}>{stream.endDate}</span>
            </span>
          )}
        </div>
      )}

      <div style={{display:"flex",gap:8,marginTop:12}}>
        <button onClick={() => onEdit(stream)}
          style={{...btnGhost(t,{flex:1,padding:"7px 0",fontSize:12})}}>✏️ Edit</button>
        <button onClick={() => onDelete(stream)}
          style={{background:COLOR.danger+"15",border:`1px solid ${COLOR.danger}33`,
            borderRadius:10,padding:"7px 0",flex:1,color:COLOR.danger,cursor:"pointer",
            fontWeight:600,fontSize:12,transition:"all .15s"}}>🗑 Delete</button>
      </div>
    </div>
  );
}

// ─── IncomeStreamModal ────────────────────────────────────────────────────────
const BLANK_STREAM = {
  name:"", type:"W2", amount:"", frequency:"Monthly",
  stabilityRating:"Stable", afterTax:true,
  startDate:"", endDate:"", notes:"", categoryId:"", color:AVATAR_COLORS[0],
};

function IncomeStreamModal({ open, onClose, initial, categories, onSave, t }) {
  const [form, setForm] = useState(BLANK_STREAM);
  useEffect(() => {
    if (open) setForm(initial ? {...initial} : {...BLANK_STREAM});
  }, [open, initial]);

  if (!open) return null;
  const s = overlayContainer(t, 540);
  const incomeCats = categories.filter(c => c.type==="income" || c.type==="both");
  const monthly = toMonthly(form.amount, form.frequency);
  const isValid = form.name.trim() && toNum(form.amount) > 0;

  function setField(key, val) { setForm(f => ({...f, [key]:val})); }

  function handleSave() {
    if (!isValid) return;
    const stream = { ...form, id: initial?.id || generateId(), amount: String(form.amount) };
    onSave(stream);
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <span style={{fontWeight:800,fontSize:18,color:t.tx1}}>
            {initial ? "Edit Income Stream" : "Add Income Stream"}
          </span>
          <button onClick={onClose} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:22}}>×</button>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* Name */}
          <div>
            <label style={labelSt(t)}>Stream Name <span style={{color:COLOR.danger}}>*</span></label>
            <input value={form.name} onChange={e => setField("name",e.target.value)}
              placeholder="e.g. Full-time Job, Rental Property, Consulting" style={inputStyle(t)} />
          </div>

          {/* Type + Frequency */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={labelSt(t)}>Income Type</label>
              <select value={form.type} onChange={e => setField("type",e.target.value)} style={selectStyle(t)}>
                {INCOME_TYPES.map(tp => (
                  <option key={tp} value={tp}>{TYPE_ICON[tp]} {tp}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelSt(t)}>Frequency</label>
              <select value={form.frequency} onChange={e => setField("frequency",e.target.value)} style={selectStyle(t)}>
                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          {/* Amount + Stability */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={labelSt(t)}>
                Amount ($)&nbsp;
                {form.frequency!=="One-Time" && monthly>0 && monthly!==toNum(form.amount) && (
                  <span style={{fontSize:10,color:COLOR.success,fontWeight:400}}>→ {fmt$(monthly)}/mo</span>
                )}
              </label>
              <input type="number" value={form.amount} onChange={e => setField("amount",e.target.value)}
                placeholder="0.00" min="0" step="0.01" style={inputStyle(t)} />
            </div>
            <div>
              <label style={labelSt(t)}>Stability Rating</label>
              <select value={form.stabilityRating} onChange={e => setField("stabilityRating",e.target.value)} style={selectStyle(t)}>
                {STABILITY_OPTS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Category + After-Tax */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={labelSt(t)}>Category</label>
              <select value={form.categoryId} onChange={e => setField("categoryId",e.target.value)} style={selectStyle(t)}>
                <option value="">Uncategorized</option>
                {incomeCats.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div style={{display:"flex",flexDirection:"column",justifyContent:"center"}}>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginTop:16}}>
                <input type="checkbox" checked={form.afterTax}
                  onChange={e => setField("afterTax",e.target.checked)}
                  style={{width:15,height:15,accentColor:COLOR.success}} />
                <span style={{fontSize:13,color:t.tx1,fontWeight:600}}>After-tax amount</span>
              </label>
              <div style={{fontSize:10,color:t.tx3,marginTop:4,marginLeft:23}}>Check if this is take-home pay</div>
            </div>
          </div>

          {/* Start / End Date */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={labelSt(t)}>Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setField("startDate",e.target.value)}
                style={inputStyle(t)} />
            </div>
            <div>
              <label style={labelSt(t)}>End Date <span style={{color:t.tx3,fontWeight:400}}>(optional)</span></label>
              <input type="date" value={form.endDate} onChange={e => setField("endDate",e.target.value)}
                style={inputStyle(t)} />
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label style={labelSt(t)}>Color</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {AVATAR_COLORS.map(c => (
                <div key={c} onClick={() => setField("color",c)}
                  style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",
                    border:form.color===c?"3px solid #fff":"2px solid transparent",
                    boxShadow:form.color===c?`0 0 0 2px ${c}`:"none",transition:"all .15s"}} />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={labelSt(t)}>Notes <span style={{color:t.tx3,fontWeight:400}}>(optional)</span></label>
            <textarea value={form.notes} onChange={e => setField("notes",e.target.value)}
              placeholder="Any additional details about this income source…" rows={2}
              style={{...inputStyle(t), resize:"vertical"}} />
          </div>

          {/* Actions */}
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
            <button onClick={handleSave} disabled={!isValid}
              style={{...btnPrimary({flex:1,
                background:isValid?COLOR.success:t.surf,
                color:isValid?"#fff":t.tx3,
                cursor:isValid?"pointer":"default",
              })}}>
              {initial ? "Save Changes" : "Add Stream"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [loading, setLoading]     = useState(true);
  const [darkMode, setDarkMode]   = useState(() => localStorage.getItem("inc_dark") !== "false");
  const [profiles, setProfiles]   = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [streams, setStreams]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [apiKey, setApiKey]       = useState("");

  const [showAdd, setShowAdd]     = useState(false);
  const [editStream, setEditStream] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showApiKey, setShowApiKey]   = useState(false);
  const [showBackup, setShowBackup]   = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAddProfile, setShowAddProfile]   = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState("unchecked");

  const t = useTheme(darkMode);
  const bp = useBreakpoint();
  const activeProfile = profiles.find(p => p.id === activeProfileId) || null;

  useEffect(() => { localStorage.setItem("inc_dark", darkMode); }, [darkMode]);

  useEffect(() => {
    async function init() {
      const profs = await storeGet("cc_profiles", true) || [];
      const actId = await storeGet("cc_active_profile", true);
      const key   = await storeGet("cc_apikey", true);
      if (key) { setApiKey(key); probeApiKey(key).then(status => setApiKeyStatus(status)); }
      setProfiles(profs);

      const id = actId || profs[0]?.id || null;
      setActiveProfileId(id);

      if (id) {
        const [ss, cats] = await Promise.all([
          storeGet(`inc_streams_${id}`, true),
          storeGet(`ffp_categories_${id}`, true),
        ]);
        setStreams(ss || []);
        if (!cats || cats.length === 0) {
          await storeSet(`ffp_categories_${id}`, DEFAULT_CATEGORIES, true);
          setCategories(DEFAULT_CATEGORIES);
        } else {
          setCategories(cats);
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  async function handleCreateFirstProfile(profile) {
    const updated = [profile];
    setProfiles(updated);
    setActiveProfileId(profile.id);
    await storeSet("cc_profiles", updated, true);
    await storeSet("cc_active_profile", profile.id, true);
    await storeSet(`ffp_categories_${profile.id}`, DEFAULT_CATEGORIES, true);
    setCategories(DEFAULT_CATEGORIES);
  }

  async function switchProfile(id) {
    setActiveProfileId(id);
    await storeSet("cc_active_profile", id, true);
    setStreams([]);
    const [ss, cats] = await Promise.all([
      storeGet(`inc_streams_${id}`, true),
      storeGet(`ffp_categories_${id}`, true),
    ]);
    setStreams(ss || []);
    if (!cats || cats.length === 0) {
      await storeSet(`ffp_categories_${id}`, DEFAULT_CATEGORIES, true);
      setCategories(DEFAULT_CATEGORIES);
    } else {
      setCategories(cats);
    }
  }

  async function saveStreams(next) {
    setStreams(next);
    await storeSet(`inc_streams_${activeProfileId}`, next, true);
  }

  function handleSaveStream(stream) {
    const exists = streams.find(s => s.id === stream.id);
    const next = exists
      ? streams.map(s => s.id===stream.id ? stream : s)
      : [...streams, stream];
    saveStreams(next);
    setEditStream(null);
    setShowAdd(false);
  }

  function handleEdit(stream) {
    setEditStream(stream);
    setShowAdd(true);
  }

  function handleDeleteClick(stream) {
    setDeleteTarget(stream);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await saveStreams(streams.filter(s => s.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  async function saveApiKey(key) {
    setApiKey(key);
    setShowApiKey(false);
    await storeSet("cc_apikey", key, true);
    if (key) probeApiKey(key).then(status => setApiKeyStatus(status));
    else setApiKeyStatus("unchecked");
  }

  async function handleEditProfileSave(updatedProfiles) {
    setProfiles(updatedProfiles);
    await storeSet("cc_profiles", updatedProfiles, true);
  }

  async function handleAddProfileSave(updatedProfiles, newId) {
    setProfiles(updatedProfiles);
    await storeSet("cc_profiles", updatedProfiles, true);
    switchProfile(newId);
  }

  async function handleImport(data, mode) {
    if (!data.streams) return;
    if (mode === "replace") {
      await saveStreams(data.streams);
    } else {
      const existing = new Set(streams.map(s => s.id));
      await saveStreams([...streams, ...data.streams.filter(s => !existing.has(s.id))]);
    }
  }

  if (loading) return (
    <div style={{minHeight:"100vh",background:t.bg,display:"flex",alignItems:"center",
      justifyContent:"center",flexDirection:"column",gap:16,padding:20}}>
      <div style={{width:40,height:40,border:"3px solid #10b981",borderTopColor:"transparent",
        borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
      <div style={{fontSize:14,color:t.tx2,textAlign:"center"}}>Loading Income Tracker…</div>
      <div style={{fontSize:12,color:t.tx3,textAlign:"center",maxWidth:280}}>
        If a login prompt appeared, close it — the app loads in local mode automatically.
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!activeProfile && profiles.length === 0) return (
    <FirstRunSetup darkMode={darkMode} setDarkMode={setDarkMode} onSave={handleCreateFirstProfile} />
  );

  return (
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif",color:t.tx1}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <NavBar
        profiles={profiles} activeProfile={activeProfile}
        darkMode={darkMode} setDarkMode={setDarkMode}
        apiKey={apiKey} apiKeyStatus={apiKeyStatus}
        onOpenApiKey={() => setShowApiKey(true)}
        onOpenBackup={() => setShowBackup(true)}
        onSwitchProfile={switchProfile}
        onEditProfile={() => setShowEditProfile(true)}
        onAddProfile={() => setShowAddProfile(true)}
        streamCount={streams.length} t={t} />

      <div style={{maxWidth:900,margin:"0 auto",padding:"24px 16px"}}>

        {streams.length > 0 && <SummaryDashboard streams={streams} t={t} />}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:17,color:t.tx1}}>
            Income Streams
            {streams.length > 0 && (
              <span style={{fontSize:13,color:t.tx2,fontWeight:400,marginLeft:8}}>
                ({streams.length})
              </span>
            )}
          </div>
          <button onClick={() => { setEditStream(null); setShowAdd(true); }}
            style={{...btnPrimary({background:COLOR.success,padding:"9px 18px",fontSize:13})}}>
            + Add Stream
          </button>
        </div>

        {streams.length === 0 ? (
          <div style={{...panelSt(t,{textAlign:"center",padding:"56px 24px"})}}>
            <div style={{fontSize:52,marginBottom:16}}>💰</div>
            <div style={{fontWeight:700,fontSize:18,color:t.tx1,marginBottom:8}}>No income streams yet</div>
            <div style={{fontSize:14,color:t.tx2,maxWidth:340,margin:"0 auto 28px",lineHeight:1.6}}>
              Add your salary, side income, rental income, dividends, or any other income source to get a complete picture of your earnings.
            </div>
            <button onClick={() => { setEditStream(null); setShowAdd(true); }}
              style={{...btnPrimary({background:COLOR.success,padding:"11px 28px",fontSize:14})}}>
              + Add Your First Income Stream
            </button>
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:bp.isMobile?"1fr":"1fr 1fr",gap:0}}>
            {streams.map(stream => (
              <StreamCard key={stream.id} stream={stream} categories={categories}
                onEdit={handleEdit} onDelete={handleDeleteClick} t={t} />
            ))}
          </div>
        )}

      </div>

      <IncomeStreamModal
        open={showAdd}
        onClose={() => { setShowAdd(false); setEditStream(null); }}
        initial={editStream}
        categories={categories}
        onSave={handleSaveStream}
        t={t} />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Income Stream"
        body={
          <span>
            Are you sure you want to delete <strong style={{color:COLOR.danger}}>{deleteTarget?.name}</strong>? This cannot be undone.
          </span>
        }
        confirmLabel="Delete"
        confirmColor={COLOR.danger}
        t={t} />

      <ApiKeyModal
        open={showApiKey}
        onClose={() => setShowApiKey(false)}
        apiKey={apiKey}
        onSave={saveApiKey}
        t={t} />

      <BackupModal
        open={showBackup}
        onClose={() => setShowBackup(false)}
        streams={streams}
        profileId={activeProfileId}
        onImport={handleImport}
        t={t} />

      <EditProfileModal
        open={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        profile={activeProfile}
        profiles={profiles}
        onSave={handleEditProfileSave}
        t={t} />

      <AddProfileModal
        open={showAddProfile}
        onClose={() => setShowAddProfile(false)}
        profiles={profiles}
        onSave={handleAddProfileSave}
        t={t} />

    </div>
  );
}
