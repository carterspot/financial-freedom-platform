import { useState, useEffect, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL   = "claude-sonnet-4-20250514";
const AVATAR_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];
const COLOR = {
  primary:"#6366f1", success:"#10b981", warning:"#f59e0b",
  danger:"#ef4444",  pink:"#ec4899",    blue:"#3b82f6",
  orange:"#f97316",  purple:"#8b5cf6",  teal:"#06b6d4",
};
const LOAN_TYPES = ["auto","mortgage","student","personal","other"];
const LOAN_ICONS = { auto:"🚗", mortgage:"🏠", student:"🎓", personal:"💼", other:"💳" };
const STRATEGY_QUESTIONS = [
  { id:"q1", label:"What is your primary payoff goal?",
    options:["Pay off fastest (fewest months)","Save the most on interest","Balance speed and savings"] },
  { id:"q2", label:"Do you have an emergency fund?",
    options:["Yes, fully funded (3–6 months)","Yes, but partial","No emergency fund yet"] },
  { id:"q3", label:"Can you make extra payments beyond minimums?",
    options:["Yes, consistently every month","Sometimes, when cash allows","No, minimums only right now"] },
  { id:"q4", label:"How much extra can you put toward debt per month?",
    type:"text", placeholder:"e.g. $200" },
  { id:"q5", label:"What concerns you most about your debt?",
    options:["Total interest cost","High monthly payments","How long it will take","All of the above"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateId  = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const fmt$        = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);
const fmtPct      = (n) => `${(parseFloat(n)||0).toFixed(2)}%`;
const fmtMonths   = (n) => n===1?"1 mo":`${n} mo`;
const toNum       = (s) => parseFloat(s)||0;

// ─── Theme ────────────────────────────────────────────────────────────────────
function useTheme(dm) {
  return {
    bg:      dm?"#020617":"#f1f5f9",
    panelBg: dm?"#0f172a":"#ffffff",
    surf:    dm?"#1e293b":"#f1f5f9",
    deepBg:  dm?"#0a0f1e":"#ffffff",
    border:  dm?"#1e293b":"#e2e8f0",
    border2: dm?"#334155":"#cbd5e1",
    tx1:     dm?"#f1f5f9":"#0f172a",
    tx2:     dm?"#94a3b8":"#64748b",
    tx3:     dm?"#475569":"#94a3b8",
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
  const headers = { "Content-Type":"application/json" };
  if (apiKey?.trim()) headers["x-api-key"] = apiKey.trim();
  const res = await fetch(API_URL, { method:"POST", headers, body:JSON.stringify(body) });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res;
}

// ─── Payoff Engine ────────────────────────────────────────────────────────────
function calcMinPmt(balance, apr) {
  const b = toNum(balance);
  const interest = b * toNum(apr) / 100 / 12;
  return Math.max(interest + b * 0.01, 25);
}

function calcMonthlyPayment(balance, rateDecimal, months) {
  const b = toNum(balance), r = toNum(rateDecimal), n = parseInt(months)||1;
  if (!r) return b/n;
  return b * r / (1 - Math.pow(1+r, -n));
}

function normalizeDebt(debt, _type) {
  if (_type === "card") {
    const b   = toNum(debt.balance);
    const apr = toNum(debt.apr);
    const minPmt = (debt.minPaymentMode==="fixed" && toNum(debt.minPaymentFixed)>0)
      ? toNum(debt.minPaymentFixed)
      : calcMinPmt(b, apr);
    return { id:debt.id, name:debt.name, color:debt.color||COLOR.primary, _type:"card",
             balance:b, rate:apr/100, minPayment:minPmt,
             originalBalance:toNum(debt.originalBalance)||b };
  } else {
    const b = toNum(debt.currentBalance);
    return { id:debt.id, name:debt.name, color:debt.color||COLOR.blue, _type:"loan",
             loanType:debt.type, balance:b, rate:toNum(debt.interestRate)/100,
             minPayment:toNum(debt.monthlyPayment),
             originalBalance:toNum(debt.originalBalance)||b };
  }
}

function computeUnifiedSchedule(cards, loans, method, opts={}) {
  const { extraMonthly=0, lumpSums=[], recalcMins=false, lumpMode="priority" } = opts;
  const extra = toNum(extraMonthly);

  let debts = [
    ...cards.map(c => normalizeDebt(c,"card")),
    ...loans.map(l => normalizeDebt(l,"loan")),
  ].filter(d => d.balance > 0.01);

  if (!debts.length) return { months:[], totalInterest:0, totalPaid:0, payoffDate:null, debtPayoffDates:{}, debts:[] };

  if (method==="avalanche") debts.sort((a,b)=>b.rate-a.rate);
  else debts.sort((a,b)=>a.balance-b.balance);

  const balances = debts.map(d => d.balance);
  const paidOff  = new Array(debts.length).fill(false);
  const debtPayoffDates = {};
  const months = [];
  let totalInterest=0, totalPaid=0;
  const start = new Date();

  for (let mo=0; mo<360; mo++) {
    if (paidOff.every(p=>p)) break;
    const moDate = new Date(start.getFullYear(), start.getMonth()+mo, 1);
    const moKey  = moDate.toISOString().slice(0,7);

    const monthLump = lumpSums
      .filter(ls => ls.date?.slice(0,7)===moKey)
      .reduce((s,ls)=>(s+toNum(ls.amount)),0);

    const tableRows=[], balsBefore=[...balances];
    let moInterest=0, moPaid=0, freedPmt=0;

    // Apply interest
    for (let i=0;i<debts.length;i++) {
      if (paidOff[i]) continue;
      balances[i] += balances[i]*debts[i].rate/12;
    }

    // Minimums
    const mins = debts.map((d,i)=>{
      if (paidOff[i]) return 0;
      if (recalcMins && d._type==="card") return calcMinPmt(balances[i], d.rate*100);
      return d.minPayment;
    });

    for (let i=0;i<debts.length;i++) {
      if (paidOff[i]) continue;
      const intPortion = balsBefore[i]*debts[i].rate/12;
      moInterest += intPortion;
      const pmt   = Math.min(mins[i], balances[i]);
      const princ = Math.max(0, pmt-intPortion);
      balances[i] = Math.max(0, balances[i]-pmt);
      moPaid += pmt;
      tableRows.push({
        month:mo+1, debtId:debts[i].id, debtName:debts[i].name,
        debtColor:debts[i].color, _type:debts[i]._type,
        payment:pmt, principal:princ, interest:Math.min(intPortion,pmt),
        balance:balances[i],
      });
      if (balances[i]<=0.01 && !paidOff[i]) {
        paidOff[i]=true; freedPmt+=mins[i];
        const pd=new Date(start.getFullYear(),start.getMonth()+mo+1,1);
        debtPayoffDates[debts[i].id]=pd.toISOString().slice(0,7);
      }
    }

    // Extra + freed + lump (priority) → cascade
    let pool = extra + freedPmt + (lumpMode!=="split" ? monthLump : 0);
    for (let i=0;i<debts.length && pool>0.01;i++) {
      if (paidOff[i]) continue;
      const a = Math.min(pool, balances[i]);
      balances[i]=Math.max(0,balances[i]-a);
      moPaid+=a; pool-=a;
      const row=tableRows.find(r=>r.debtId===debts[i].id);
      if (row){row.payment+=a;row.principal+=a;row.balance=balances[i];}
      if (balances[i]<=0.01 && !paidOff[i]) {
        paidOff[i]=true;
        const pd=new Date(start.getFullYear(),start.getMonth()+mo+1,1);
        debtPayoffDates[debts[i].id]=debtPayoffDates[debts[i].id]||pd.toISOString().slice(0,7);
      }
    }

    // Split lump
    if (lumpMode==="split" && monthLump>0) {
      const active=debts.map((_,i)=>i).filter(i=>!paidOff[i]);
      const perDebt=monthLump/(active.length||1);
      for (const i of active) {
        const a=Math.min(perDebt,balances[i]);
        balances[i]=Math.max(0,balances[i]-a);
        moPaid+=a;
        const row=tableRows.find(r=>r.debtId===debts[i].id);
        if (row){row.payment+=a;row.principal+=a;row.balance=balances[i];}
        if (balances[i]<=0.01 && !paidOff[i]) {
          paidOff[i]=true;
          const pd=new Date(start.getFullYear(),start.getMonth()+mo+1,1);
          debtPayoffDates[debts[i].id]=debtPayoffDates[debts[i].id]||pd.toISOString().slice(0,7);
        }
      }
    }

    totalInterest+=moInterest; totalPaid+=moPaid;
    months.push({
      month:mo+1, date:moKey, rows:tableRows,
      totalBalance:balances.reduce((s,b)=>s+Math.max(0,b),0),
      moInterest, moPaid,
      monthLump, lumpMode,
    });
  }

  const payoffDate = months.length ? months[months.length-1].date : null;
  return { months, totalInterest, totalPaid, payoffDate, debtPayoffDates, debts };
}

// ─── Shared style helpers ─────────────────────────────────────────────────────
function inputStyle(t) {
  return { width:"100%", background:t.surf, border:`1px solid ${t.border}`,
    borderRadius:8, padding:"8px 12px", color:t.tx1, fontSize:13, boxSizing:"border-box",
    outline:"none" };
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
function tabBtn(active, t) {
  return { background:active?COLOR.primary:t.surf, color:active?"#fff":t.tx2,
    border:`1px solid ${active?COLOR.primary:t.border}`, borderRadius:8,
    padding:"7px 16px", cursor:"pointer", fontWeight:600, fontSize:13, transition:"all .15s",
    whiteSpace:"nowrap" };
}
function panelSt(t, extra={}) {
  return { background:t.panelBg, border:`1px solid ${t.border}`, borderRadius:16,
    padding:"16px 20px", ...extra };
}
function overlayContainer(t, maxW=440) {
  return {
    overlay:{ position:"fixed", inset:0, background:"rgba(0,0,0,.72)", zIndex:2000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16, overflowY:"auto" },
    box:{ background:t.panelBg, borderRadius:20, width:"100%", maxWidth:maxW,
      padding:24, boxShadow:"0 20px 60px rgba(0,0,0,.5)", maxHeight:"90vh", overflowY:"auto" },
  };
}

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({ text, label, t, style }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(()=>{
      setCopied(true);
      setTimeout(()=>setCopied(false), 1500);
    }).catch(()=>{});
  }
  return (
    <button onClick={handleCopy} style={{background:"none",border:`1px solid ${t.border}`,
      borderRadius:6,padding:"4px 10px",color:copied?COLOR.success:t.tx2,cursor:"pointer",
      fontSize:11,fontWeight:600,transition:"all .2s",...style}}>
      {copied?"✓ Copied!":label||"📋 Copy"}
    </button>
  );
}

// ─── InfoModal ────────────────────────────────────────────────────────────────
function InfoModal({ open, onClose, title, body, t }) {
  if (!open) return null;
  const s = overlayContainer(t, 420);
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
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

// ─── ConfirmDeleteModal ───────────────────────────────────────────────────────
function ConfirmDeleteModal({ open, onClose, onConfirm, itemName, t }) {
  if (!open) return null;
  const s = overlayContainer(t, 380);
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:800,fontSize:17,color:t.tx1,marginBottom:12}}>Delete Debt</div>
        <div style={{fontSize:14,color:t.tx2,marginBottom:24}}>
          Are you sure you want to delete <strong style={{color:COLOR.danger}}>{itemName}</strong>? This cannot be undone.
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
          <button onClick={onConfirm} style={{flex:1,background:COLOR.danger,border:"none",borderRadius:10,
            padding:"9px 20px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── ApiKeyModal ──────────────────────────────────────────────────────────────
function ApiKeyModal({ open, onClose, apiKey, onSave, t }) {
  const [val,setVal] = useState(apiKey||"");
  useEffect(()=>{ if (open) setVal(apiKey||""); },[open,apiKey]);
  if (!open) return null;
  const s = overlayContainer(t,460);
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>🔑 Anthropic API Key</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <div style={{fontSize:12,color:t.tx2,marginBottom:16,lineHeight:1.6}}>
          Your API key is stored in your profile and never sent anywhere except Anthropic's API.
          Get one at <span style={{color:COLOR.primary}}>console.anthropic.com</span>.
        </div>
        <label style={labelSt(t)}>API Key</label>
        <input type="password" value={val} onChange={e=>setVal(e.target.value)}
          placeholder="sk-ant-..." style={inputStyle(t)} />
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
          <button onClick={()=>onSave(val)} style={{...btnPrimary({flex:1})}}>Save Key</button>
        </div>
        {apiKey && (
          <button onClick={()=>onSave("")} style={{width:"100%",marginTop:8,background:"none",
            border:`1px solid ${COLOR.danger}33`,borderRadius:8,padding:"7px",color:COLOR.danger,
            cursor:"pointer",fontSize:12}}>Remove Key</button>
        )}
      </div>
    </div>
  );
}

// ─── AddLumpSumModal ──────────────────────────────────────────────────────────
function AddLumpSumModal({ open, onClose, onAdd, t }) {
  const [date,setDate] = useState("");
  const [amount,setAmount] = useState("");
  const [note,setNote] = useState("");
  useEffect(()=>{ if(open){setDate("");setAmount("");setNote("");} },[open]);
  if (!open) return null;
  const s = overlayContainer(t,400);
  function handleAdd() {
    if (!date||!amount) return;
    onAdd({ id:generateId(), date, amount:parseFloat(amount)||0, note });
    onClose();
  }
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>Add Lump Sum</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={labelSt(t)}>Month (YYYY-MM)</label>
            <input type="month" value={date} onChange={e=>setDate(e.target.value)} style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>Amount ($)</label>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value)}
              placeholder="500" min="0" style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>Note (optional)</label>
            <input type="text" value={note} onChange={e=>setNote(e.target.value)}
              placeholder="Tax refund, bonus…" style={inputStyle(t)} />
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
          <button onClick={handleAdd} style={{...btnPrimary({flex:1})}} disabled={!date||!amount}>Add</button>
        </div>
      </div>
    </div>
  );
}

// ─── QuickPayModal ────────────────────────────────────────────────────────────
function QuickPayModal({ open, onClose, item, onConfirm, t }) {
  const [amount,setAmount] = useState("");
  const [date,setDate] = useState(() => new Date().toISOString().slice(0,10));
  useEffect(()=>{
    if (open && item) {
      const def = item._type==="card" ? toNum(item.monthlyPayment)||calcMinPmt(item.balance,item.apr)
                                      : toNum(item.monthlyPayment);
      setAmount(def.toFixed(2));
      setDate(new Date().toISOString().slice(0,10));
    }
  },[open,item]);
  if (!open||!item) return null;
  const s = overlayContainer(t,400);
  const bal = item._type==="card" ? toNum(item.balance) : toNum(item.currentBalance);
  function handleConfirm() {
    const amt = parseFloat(amount)||0;
    if (!amt) return;
    onConfirm({ item, amount:amt, date });
    onClose();
  }
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <div style={{width:12,height:12,borderRadius:"50%",background:item.color,flexShrink:0}} />
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>Log Payment — {item.name}</span>
        </div>
        <div style={{fontSize:12,color:t.tx2,marginBottom:16}}>
          Current balance: <span style={{fontFamily:"monospace",color:COLOR.danger}}>{fmt$(bal)}</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={labelSt(t)}>Payment Amount ($)</label>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value)}
              min="0" step="0.01" style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>Date</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inputStyle(t)} />
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
          <button onClick={handleConfirm} style={{...btnPrimary({flex:1,background:COLOR.success})}}>✓ Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ─── BackupModal ──────────────────────────────────────────────────────────────
function BackupModal({ open, onClose, cards, loans, logs, profileId, onImport, t }) {
  const [importText,setImportText] = useState("");
  const [importMode,setImportMode] = useState("replace");
  const [importError,setImportError] = useState("");
  const [tab,setTab] = useState("export");
  if (!open) return null;
  const s = overlayContainer(t,540);

  function exportJSON() {
    const data = { version:"dt_1.0", exportedAt:new Date().toISOString(), profileId, cards, loans, logs };
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`debttracker-${profileId}-${new Date().toISOString().slice(0,10)}.json`; a.click();
  }

  function exportCardsCSV() {
    const headers=["Name","Last4","Balance","Limit","APR","MonthlyPayment","DueDay"];
    const rows=cards.map(c=>[c.name,c.last4||"",c.balance,c.limit||"",c.apr,c.monthlyPayment,c.dueDay||""]);
    const csv=[headers,...rows].map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`debttracker-cards-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  function exportLoansCSV() {
    const headers=["Name","Lender","Type","OriginalBalance","CurrentBalance","Rate","Payment","RemainingMonths"];
    const rows=loans.map(l=>[l.name,l.lender||"",l.type||"",l.originalBalance,l.currentBalance,l.interestRate,l.monthlyPayment,l.remainingMonths||""]);
    const csv=[headers,...rows].map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`debttracker-loans-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  function handleImport() {
    setImportError("");
    try {
      const data = JSON.parse(importText);
      if (!data.version?.startsWith("dt_")) throw new Error("Not a DebtTracker backup file.");
      onImport(data, importMode);
      onClose();
    } catch(e) {
      setImportError(e.message||"Invalid JSON");
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>📦 Backup & Restore</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          {["export","import"].map(tb => (
            <button key={tb} onClick={()=>setTab(tb)} style={tabBtn(tab===tb,t)}>
              {tb==="export"?"📤 Export":"📥 Import"}
            </button>
          ))}
        </div>
        {tab==="export" && (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button onClick={exportJSON} style={btnPrimary({width:"100%"})}>⬇ Download JSON Backup</button>
            <button onClick={exportCardsCSV} style={btnGhost(t,{width:"100%"})}>⬇ Export Cards CSV</button>
            <button onClick={exportLoansCSV} style={btnGhost(t,{width:"100%"})}>⬇ Export Loans CSV</button>
            <div style={{fontSize:11,color:t.tx3,marginTop:4}}>JSON backup includes all data. CSV exports cards and loans separately.</div>
          </div>
        )}
        {tab==="import" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div>
              <label style={labelSt(t)}>Import Mode</label>
              <div style={{display:"flex",gap:8}}>
                {["replace","merge"].map(m=>(
                  <button key={m} onClick={()=>setImportMode(m)} style={tabBtn(importMode===m,t)}>
                    {m==="replace"?"Replace All":"Merge"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelSt(t)}>Paste JSON Backup</label>
              <textarea value={importText} onChange={e=>setImportText(e.target.value)}
                rows={6} placeholder='{"version":"dt_1.0",...}'
                style={{...inputStyle(t),resize:"vertical",fontFamily:"monospace",fontSize:11}} />
            </div>
            {importError && <div style={{fontSize:12,color:COLOR.danger}}>{importError}</div>}
            <button onClick={handleImport} style={btnPrimary({width:"100%"})} disabled={!importText.trim()}>
              Import
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AddDebtModal ─────────────────────────────────────────────────────────────
const BLANK_CARD = { name:"", last4:"", color:"#6366f1", balance:"", limit:"",
  apr:"", minPaymentMode:"auto", minPaymentFixed:"", monthlyPayment:"", payoffMode:"payment",
  dueDay:"", statementDay:"", originalBalance:"" };
const BLANK_LOAN = { name:"", lender:"", type:"auto", color:"#3b82f6", originalBalance:"",
  currentBalance:"", interestRate:"", monthlyPayment:"", termMonths:"", remainingMonths:"",
  nextPaymentDay:"", notes:"" };

function AddDebtModal({ open, onClose, editCard, editLoan, onSaveCard, onSaveLoan, t }) {
  const [tab, setTab] = useState(editLoan?"loan":"card");
  const [card, setCard] = useState(BLANK_CARD);
  const [loan, setLoan] = useState(BLANK_LOAN);

  useEffect(()=>{
    if (!open) return;
    setCard(editCard ? {...BLANK_CARD,...editCard} : BLANK_CARD);
    setLoan(editLoan ? {...BLANK_LOAN,...editLoan} : BLANK_LOAN);
    setTab(editLoan?"loan":"card");
  },[open,editCard,editLoan]);

  if (!open) return null;
  const s = overlayContainer(t,520);

  function setC(k,v) { setCard(p=>({...p,[k]:v})); }
  function setL(k,v) { setLoan(p=>({...p,[k]:v})); }

  function handleSaveCard() {
    if (!card.name||!card.balance||!card.apr) return;
    const orig = card.originalBalance||card.balance;
    onSaveCard({ ...card, id:card.id||generateId(), originalBalance:orig });
    onClose();
  }

  function handleSaveLoan() {
    if (!loan.name||!loan.currentBalance||!loan.interestRate) return;
    const orig = loan.originalBalance||loan.currentBalance;
    let pmt = loan.monthlyPayment;
    if (!pmt && loan.termMonths) {
      pmt = calcMonthlyPayment(toNum(loan.currentBalance), toNum(loan.interestRate)/100, toNum(loan.termMonths)).toFixed(2);
    }
    onSaveLoan({ ...loan, id:loan.id||generateId(), originalBalance:orig, monthlyPayment:pmt||"0" });
    onClose();
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>
            {(editCard||editLoan)?"Edit Debt":"+ Add Debt"}
          </span>
          <button onClick={onClose} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>×</button>
        </div>
        {!editCard && !editLoan && (
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            <button onClick={()=>setTab("card")} style={tabBtn(tab==="card",t)}>💳 Credit Card</button>
            <button onClick={()=>setTab("loan")} style={tabBtn(tab==="loan",t)}>🏦 Loan</button>
          </div>
        )}

        {tab==="card" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{gridColumn:"1/-1"}}>
                <label style={labelSt(t)}>Card Name *</label>
                <input value={card.name} onChange={e=>setC("name",e.target.value)}
                  placeholder="Chase Sapphire" style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Last 4 Digits</label>
                <input value={card.last4} onChange={e=>setC("last4",e.target.value.slice(0,4))}
                  placeholder="1234" maxLength={4} style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Color</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:2}}>
                  {AVATAR_COLORS.map(c=>(
                    <div key={c} onClick={()=>setC("color",c)} style={{width:22,height:22,borderRadius:"50%",
                      background:c,cursor:"pointer",border:card.color===c?"3px solid #fff":"2px solid transparent",
                      outline:card.color===c?`2px solid ${c}`:"none"}} />
                  ))}
                </div>
              </div>
              <div>
                <label style={labelSt(t)}>Balance ($) *</label>
                <input type="number" value={card.balance} onChange={e=>setC("balance",e.target.value)}
                  placeholder="2500" min="0" style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Credit Limit ($)</label>
                <input type="number" value={card.limit} onChange={e=>setC("limit",e.target.value)}
                  placeholder="5000" min="0" style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>APR (%) *</label>
                <input type="number" value={card.apr} onChange={e=>setC("apr",e.target.value)}
                  placeholder="23.99" min="0" step="0.01" style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Min Payment Mode</label>
                <select value={card.minPaymentMode} onChange={e=>setC("minPaymentMode",e.target.value)}
                  style={inputStyle(t)}>
                  <option value="auto">Auto (interest + 1%)</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </div>
              {card.minPaymentMode==="fixed" && (
                <div>
                  <label style={labelSt(t)}>Fixed Min Payment ($)</label>
                  <input type="number" value={card.minPaymentFixed} onChange={e=>setC("minPaymentFixed",e.target.value)}
                    placeholder="25" min="0" style={inputStyle(t)} />
                </div>
              )}
              <div>
                <label style={labelSt(t)}>Monthly Payment ($)</label>
                <input type="number" value={card.monthlyPayment} onChange={e=>setC("monthlyPayment",e.target.value)}
                  placeholder="150" min="0" style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Due Day</label>
                <input type="number" value={card.dueDay} onChange={e=>setC("dueDay",e.target.value)}
                  placeholder="15" min="1" max="31" style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Statement Day</label>
                <input type="number" value={card.statementDay} onChange={e=>setC("statementDay",e.target.value)}
                  placeholder="8" min="1" max="31" style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Original Balance ($)</label>
                <input type="number" value={card.originalBalance} onChange={e=>setC("originalBalance",e.target.value)}
                  placeholder={card.balance||"2500"} min="0" style={inputStyle(t)} />
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:4}}>
              <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
              <button onClick={handleSaveCard} style={{...btnPrimary({flex:1})}} disabled={!card.name||!card.balance||!card.apr}>
                {editCard?"Save Changes":"Add Card"}
              </button>
            </div>
          </div>
        )}

        {tab==="loan" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{gridColumn:"1/-1"}}>
                <label style={labelSt(t)}>Loan Name *</label>
                <input value={loan.name} onChange={e=>setL("name",e.target.value)}
                  placeholder="Toyota Camry" style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Lender</label>
                <input value={loan.lender} onChange={e=>setL("lender",e.target.value)}
                  placeholder="Chase Auto" style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Loan Type</label>
                <select value={loan.type} onChange={e=>setL("type",e.target.value)} style={inputStyle(t)}>
                  {LOAN_TYPES.map(lt=>(
                    <option key={lt} value={lt}>{LOAN_ICONS[lt]} {lt.charAt(0).toUpperCase()+lt.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <label style={labelSt(t)}>Color</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:2}}>
                  {AVATAR_COLORS.map(c=>(
                    <div key={c} onClick={()=>setL("color",c)} style={{width:22,height:22,borderRadius:"50%",
                      background:c,cursor:"pointer",border:loan.color===c?"3px solid #fff":"2px solid transparent",
                      outline:loan.color===c?`2px solid ${c}`:"none"}} />
                  ))}
                </div>
              </div>
              <div>
                <label style={labelSt(t)}>Original Balance ($)</label>
                <input type="number" value={loan.originalBalance} onChange={e=>setL("originalBalance",e.target.value)}
                  placeholder="25000" min="0" style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Current Balance ($) *</label>
                <input type="number" value={loan.currentBalance} onChange={e=>setL("currentBalance",e.target.value)}
                  placeholder="18500" min="0" style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Interest Rate (%) *</label>
                <input type="number" value={loan.interestRate} onChange={e=>setL("interestRate",e.target.value)}
                  placeholder="6.90" min="0" step="0.01" style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Monthly Payment ($)</label>
                <input type="number" value={loan.monthlyPayment} onChange={e=>setL("monthlyPayment",e.target.value)}
                  placeholder="485" min="0" style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Term (months)</label>
                <input type="number" value={loan.termMonths} onChange={e=>setL("termMonths",e.target.value)}
                  placeholder="60" min="1" style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Remaining Months</label>
                <input type="number" value={loan.remainingMonths} onChange={e=>setL("remainingMonths",e.target.value)}
                  placeholder="42" min="0" style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Next Payment Day</label>
                <input type="number" value={loan.nextPaymentDay} onChange={e=>setL("nextPaymentDay",e.target.value)}
                  placeholder="15" min="1" max="31" style={inputStyle(t)} />
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <label style={labelSt(t)}>Notes</label>
                <textarea value={loan.notes} onChange={e=>setL("notes",e.target.value)}
                  rows={2} placeholder="Optional notes…"
                  style={{...inputStyle(t),resize:"vertical"}} />
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:4}}>
              <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
              <button onClick={handleSaveLoan} style={{...btnPrimary({flex:1})}}
                disabled={!loan.name||!loan.currentBalance||!loan.interestRate}>
                {editLoan?"Save Changes":"Add Loan"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ImportBanner ─────────────────────────────────────────────────────────────
function ImportBanner({ onImport, onDismiss, t }) {
  return (
    <div style={{background:COLOR.warning+"18", border:`1px solid ${COLOR.warning}44`,
      borderRadius:12, padding:"12px 16px", marginBottom:16,
      display:"flex", alignItems:"center", gap:12, flexWrap:"wrap"}}>
      <span style={{fontSize:14,color:t.tx1,flex:1}}>
        📦 Found existing CardTracker / LoanTracker data. Import it into DebtTracker?
      </span>
      <div style={{display:"flex",gap:8}}>
        <button onClick={onImport} style={{...btnPrimary({background:COLOR.warning,padding:"7px 14px",fontSize:12})}}>
          Import Data
        </button>
        <button onClick={onDismiss} style={{...btnGhost(t,{padding:"7px 14px",fontSize:12})}}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ─── PortfolioSummary ─────────────────────────────────────────────────────────
function PortfolioSummary({ cards, loans, schedule, t }) {
  const totalDebt = cards.reduce((s,c)=>s+toNum(c.balance),0)
                  + loans.reduce((s,l)=>s+toNum(l.currentBalance),0);
  const totalPmt  = cards.reduce((s,c)=>s+(toNum(c.monthlyPayment)||calcMinPmt(c.balance,c.apr)),0)
                  + loans.reduce((s,l)=>s+toNum(l.monthlyPayment),0);
  const totalInt  = schedule?.totalInterest||0;
  const payoff    = schedule?.payoffDate;

  const stats = [
    { label:"Total Debt",      value:fmt$(totalDebt),     color:COLOR.danger },
    { label:"Monthly Payments",value:fmt$(totalPmt),      color:COLOR.warning },
    { label:"Est. Interest",   value:fmt$(totalInt),      color:COLOR.orange },
    { label:"Payoff Date",     value:payoff?payoff.slice(0,7):"—", color:COLOR.success },
  ];

  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:20}}>
      {stats.map(s=>(
        <div key={s.label} style={{...panelSt(t,{textAlign:"center"})}}>
          <div style={{fontSize:11,color:t.tx2,fontWeight:600,marginBottom:6}}>{s.label}</div>
          <div style={{fontSize:20,fontWeight:800,color:s.color,fontFamily:"monospace"}}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── CardPanel ────────────────────────────────────────────────────────────────
function CardPanel({ card, onPay, onEdit, onDelete, schedule, t }) {
  const bal    = toNum(card.balance);
  const limit  = toNum(card.limit);
  const util   = limit>0 ? Math.min(bal/limit,1) : 0;
  const utilPct= (util*100).toFixed(0);
  const payoff = schedule?.debtPayoffDates?.[card.id];
  const pmt    = toNum(card.monthlyPayment)||calcMinPmt(bal,card.apr);

  return (
    <div style={{...panelSt(t,{position:"relative",overflow:"hidden"})}}>
      <div style={{position:"absolute",top:0,left:0,width:4,height:"100%",background:card.color,borderRadius:"16px 0 0 16px"}} />
      <div style={{paddingLeft:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:card.color}} />
            <div>
              <div style={{fontWeight:700,fontSize:14,color:t.tx1}}>{card.name}</div>
              {card.last4 && <div style={{fontSize:11,color:t.tx3}}>•••• {card.last4}</div>}
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>onPay(card)} style={{background:COLOR.success+"18",border:`1px solid ${COLOR.success}44`,
              borderRadius:8,padding:"5px 10px",color:COLOR.success,cursor:"pointer",fontSize:12,fontWeight:700}}>✓ Pay</button>
            <button onClick={()=>onEdit(card)} style={{background:t.surf,border:`1px solid ${t.border}`,
              borderRadius:8,padding:"5px 10px",color:t.tx2,cursor:"pointer",fontSize:12}}>✏</button>
            <button onClick={()=>onDelete(card,"card")} style={{background:COLOR.danger+"12",border:`1px solid ${COLOR.danger}33`,
              borderRadius:8,padding:"5px 10px",color:COLOR.danger,cursor:"pointer",fontSize:12}}>🗑</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginBottom:12}}>
          <div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>BALANCE</div>
            <div style={{fontSize:16,fontWeight:800,color:COLOR.danger,fontFamily:"monospace"}}>{fmt$(bal)}</div>
          </div>
          <div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>APR</div>
            <div style={{fontSize:14,fontWeight:700,color:t.tx1}}>{fmtPct(card.apr)}</div>
          </div>
          <div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>PAYMENT</div>
            <div style={{fontSize:14,fontWeight:700,color:t.tx1,fontFamily:"monospace"}}>{fmt$(pmt)}</div>
          </div>
          {payoff && (
            <div>
              <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>PAYOFF ETA</div>
              <div style={{fontSize:12,fontWeight:700,color:COLOR.success}}>{payoff}</div>
            </div>
          )}
        </div>
        {limit>0 && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:t.tx3,marginBottom:4}}>
              <span>Utilization</span>
              <span style={{color:util>0.3?COLOR.warning:t.tx3}}>{utilPct}%</span>
            </div>
            <div style={{height:5,borderRadius:3,background:t.surf,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${utilPct}%`,background:util>0.3?COLOR.warning:COLOR.success,
                borderRadius:3,transition:"width .3s"}} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LoanPanel ────────────────────────────────────────────────────────────────
function LoanPanel({ loan, onPay, onEdit, onDelete, schedule, t }) {
  const cur  = toNum(loan.currentBalance);
  const orig = toNum(loan.originalBalance)||cur;
  const pct  = orig>0 ? Math.max(0,Math.min(1,(orig-cur)/orig)) : 0;
  const rate = toNum(loan.interestRate);
  const pmt  = toNum(loan.monthlyPayment);
  const intPerMo = cur * rate / 100 / 12;
  const payoff   = schedule?.debtPayoffDates?.[loan.id];

  return (
    <div style={{...panelSt(t,{position:"relative",overflow:"hidden"})}}>
      <div style={{position:"absolute",top:0,left:0,width:4,height:"100%",background:loan.color,borderRadius:"16px 0 0 16px"}} />
      <div style={{paddingLeft:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>{LOAN_ICONS[loan.type]||"💳"}</span>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:t.tx1}}>{loan.name}</div>
              {loan.lender && <div style={{fontSize:11,color:t.tx3}}>{loan.lender}</div>}
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>onPay(loan)} style={{background:COLOR.success+"18",border:`1px solid ${COLOR.success}44`,
              borderRadius:8,padding:"5px 10px",color:COLOR.success,cursor:"pointer",fontSize:12,fontWeight:700}}>✓ Pay</button>
            <button onClick={()=>onEdit(loan)} style={{background:t.surf,border:`1px solid ${t.border}`,
              borderRadius:8,padding:"5px 10px",color:t.tx2,cursor:"pointer",fontSize:12}}>✏</button>
            <button onClick={()=>onDelete(loan,"loan")} style={{background:COLOR.danger+"12",border:`1px solid ${COLOR.danger}33`,
              borderRadius:8,padding:"5px 10px",color:COLOR.danger,cursor:"pointer",fontSize:12}}>🗑</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginBottom:12}}>
          <div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>BALANCE</div>
            <div style={{fontSize:16,fontWeight:800,color:COLOR.danger,fontFamily:"monospace"}}>{fmt$(cur)}</div>
          </div>
          <div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>RATE</div>
            <div style={{fontSize:14,fontWeight:700,color:t.tx1}}>{fmtPct(rate)}</div>
          </div>
          <div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>PAYMENT</div>
            <div style={{fontSize:14,fontWeight:700,color:t.tx1,fontFamily:"monospace"}}>{fmt$(pmt)}</div>
          </div>
          <div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>INT/MO</div>
            <div style={{fontSize:12,fontWeight:600,color:COLOR.orange,fontFamily:"monospace"}}>{fmt$(intPerMo)}</div>
          </div>
          {payoff && (
            <div>
              <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>PAYOFF</div>
              <div style={{fontSize:12,fontWeight:700,color:COLOR.success}}>{payoff}</div>
            </div>
          )}
          {loan.remainingMonths && (
            <div>
              <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>REMAINING</div>
              <div style={{fontSize:12,fontWeight:600,color:t.tx2}}>{fmtMonths(toNum(loan.remainingMonths))}</div>
            </div>
          )}
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:t.tx3,marginBottom:4}}>
            <span>Paid Off</span>
            <span style={{color:COLOR.success}}>{(pct*100).toFixed(0)}%</span>
          </div>
          <div style={{height:5,borderRadius:3,background:t.surf,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${pct*100}%`,background:COLOR.success,
              borderRadius:3,transition:"width .3s"}} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DebtList ─────────────────────────────────────────────────────────────────
function DebtList({ cards, loans, interleave, onPay, onEdit, onDelete, schedule, t }) {
  if (interleave) {
    const all = [
      ...cards.map(c=>({...c,_type:"card",_rate:toNum(c.apr)})),
      ...loans.map(l=>({...l,_type:"loan",_rate:toNum(l.interestRate)})),
    ].sort((a,b)=>b._rate-a._rate);
    return (
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {all.map(item => item._type==="card"
          ? <CardPanel key={item.id} card={item} onPay={onPay} onEdit={c=>onEdit(c,"card")}
              onDelete={onDelete} schedule={schedule} t={t} />
          : <LoanPanel key={item.id} loan={item} onPay={onPay} onEdit={l=>onEdit(l,"loan")}
              onDelete={onDelete} schedule={schedule} t={t} />
        )}
      </div>
    );
  }
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {cards.length>0 && (
        <>
          <div style={{fontSize:12,fontWeight:700,color:t.tx3,textTransform:"uppercase",letterSpacing:1,marginTop:4}}>
            💳 Credit Cards
          </div>
          {cards.map(c=>(
            <CardPanel key={c.id} card={c} onPay={onPay} onEdit={card=>onEdit(card,"card")}
              onDelete={onDelete} schedule={schedule} t={t} />
          ))}
        </>
      )}
      {loans.length>0 && (
        <>
          <div style={{fontSize:12,fontWeight:700,color:t.tx3,textTransform:"uppercase",letterSpacing:1,marginTop:8}}>
            🏦 Loans
          </div>
          {loans.map(l=>(
            <LoanPanel key={l.id} loan={l} onPay={onPay} onEdit={loan=>onEdit(loan,"loan")}
              onDelete={onDelete} schedule={schedule} t={t} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── ScheduleTab ──────────────────────────────────────────────────────────────
function ScheduleTab({ cards, loans, method, setMethod, extra, setExtra, lumps, setLumps,
  lumpMode, setLumpMode, recalcMins, setRecalcMins, profileId, aiResults, apiKey,
  onSaveAiResults, onSavePlanner, t, darkMode }) {
  const [showLumpModal, setShowLumpModal] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [localExtra, setLocalExtra] = useState(extra||"");
  const [showTable, setShowTable] = useState(false);

  const schedule = computeUnifiedSchedule(cards, loans, method,
    { extraMonthly:toNum(localExtra), lumpSums:lumps, recalcMins, lumpMode });
  const scheduleAlt = computeUnifiedSchedule(cards, loans, method==="avalanche"?"snowball":"avalanche",
    { extraMonthly:toNum(localExtra), lumpSums:lumps, recalcMins, lumpMode });

  const saved = method==="avalanche"
    ? scheduleAlt.totalInterest - schedule.totalInterest
    : schedule.totalInterest - scheduleAlt.totalInterest;

  function applyExtra() {
    setExtra(localExtra);
    onSavePlanner({ extra:localExtra, lumps, lumpMode, recalcMins });
  }
  function removeLump(id) {
    const next = lumps.filter(l=>l.id!==id);
    setLumps(next);
    onSavePlanner({ extra:localExtra, lumps:next, lumpMode, recalcMins });
  }
  function addLump(ls) {
    const next=[...lumps,ls];
    setLumps(next);
    onSavePlanner({ extra:localExtra, lumps:next, lumpMode, recalcMins });
  }
  function toggleLumpMode(m) {
    setLumpMode(m);
    onSavePlanner({ extra:localExtra, lumps, lumpMode:m, recalcMins });
  }
  function toggleRecalc(v) {
    setRecalcMins(v);
    onSavePlanner({ extra:localExtra, lumps, lumpMode, recalcMins:v });
  }

  async function runAI() {
    if (!apiKey) { setAiError("Add your API key via 🔑 in the nav bar."); return; }
    setAiLoading(true); setAiError("");
    try {
      const debtCtx = [
        ...cards.map(c=>`Card: ${c.name}, Balance: ${fmt$(c.balance)}, APR: ${fmtPct(c.apr)}, Payment: ${fmt$(c.monthlyPayment)}`),
        ...loans.map(l=>`Loan: ${l.name} (${l.type}), Balance: ${fmt$(l.currentBalance)}, Rate: ${fmtPct(l.interestRate)}, Payment: ${fmt$(l.monthlyPayment)}`),
      ].join("\n");
      const prompt = `Analyze this debt payoff schedule and provide actionable advice.\n\nDebts:\n${debtCtx}\n\nMethod: ${method}\nExtra monthly: ${fmt$(toNum(localExtra))}\nTotal interest: ${fmt$(schedule.totalInterest)}\nPayoff date: ${schedule.payoffDate||"unknown"}\nMonths: ${schedule.months.length}\n\nProvide a concise analysis covering: (1) Whether avalanche or snowball is better for this situation, (2) Impact of the extra payment, (3) Top 2-3 recommendations to pay off faster.`;
      const res = await callClaude(apiKey, { model:MODEL, max_tokens:800,
        messages:[{role:"user",content:prompt}] });
      const data = await res.json();
      const text = data.content?.[0]?.text||"";
      const next = {...(aiResults||{}), scheduleAnalysis:text};
      onSaveAiResults(next);
    } catch(e) {
      setAiError(e.message||"AI error");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Method + Controls */}
      <div style={panelSt(t)}>
        <div style={{fontWeight:700,fontSize:14,color:t.tx1,marginBottom:12}}>Payoff Strategy</div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {["avalanche","snowball"].map(m=>(
            <button key={m} onClick={()=>setMethod(m)} style={tabBtn(method===m,t)}>
              {m==="avalanche"?"🏔 Avalanche":"❄ Snowball"}
            </button>
          ))}
        </div>
        <div style={{fontSize:12,color:t.tx2,marginBottom:16}}>
          {method==="avalanche"
            ? "Pays highest-interest debt first — minimizes total interest paid."
            : "Pays smallest balance first — builds momentum through quick wins."}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"flex-end",marginBottom:12}}>
          <div>
            <label style={labelSt(t)}>Extra Monthly Payment ($)</label>
            <input type="number" value={localExtra} onChange={e=>setLocalExtra(e.target.value)}
              placeholder="0" min="0" style={inputStyle(t)} />
          </div>
          <button onClick={applyExtra} style={btnPrimary({whiteSpace:"nowrap"})}>Apply</button>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <input type="checkbox" id="recalcMins" checked={recalcMins}
            onChange={e=>toggleRecalc(e.target.checked)} />
          <label htmlFor="recalcMins" style={{fontSize:13,color:t.tx1,cursor:"pointer"}}>
            Recalculate minimums monthly
          </label>
          <button onClick={()=>setInfoOpen(true)} style={{background:"none",border:"none",
            color:COLOR.primary,cursor:"pointer",fontSize:14,padding:"0 4px"}}>ℹ️</button>
        </div>

        <div style={{marginBottom:4}}>
          <div style={{fontSize:11,color:t.tx2,fontWeight:600,marginBottom:8}}>Lump Sum Distribution</div>
          <div style={{display:"flex",gap:8}}>
            {["priority","split"].map(m=>(
              <button key={m} onClick={()=>toggleLumpMode(m)} style={tabBtn(lumpMode===m,t)}>
                {m==="priority"?"Priority Debt":"Split Evenly"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lump Sums */}
      <div style={panelSt(t)}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:14,color:t.tx1}}>Lump Sums</div>
          <button onClick={()=>setShowLumpModal(true)} style={btnPrimary({padding:"6px 14px",fontSize:12})}>+ Add</button>
        </div>
        {lumps.length===0 && <div style={{fontSize:13,color:t.tx3}}>No lump sums added yet.</div>}
        {lumps.map(ls=>(
          <div key={ls.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"8px 0",borderBottom:`1px solid ${t.border}`}}>
            <div>
              <span style={{fontSize:13,color:t.tx1,fontWeight:600,fontFamily:"monospace"}}>{fmt$(ls.amount)}</span>
              <span style={{fontSize:12,color:t.tx2,marginLeft:8}}>{ls.date}</span>
              {ls.note && <span style={{fontSize:11,color:t.tx3,marginLeft:8}}>{ls.note}</span>}
            </div>
            <button onClick={()=>removeLump(ls.id)} style={{background:"none",border:"none",
              color:COLOR.danger,cursor:"pointer",fontSize:16}}>×</button>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
        {[
          {label:"Total Interest",value:fmt$(schedule.totalInterest),color:COLOR.orange},
          {label:"Months to Payoff",value:schedule.months.length,color:COLOR.primary},
          {label:`vs ${method==="avalanche"?"Snowball":"Avalanche"}`,
            value:saved>0?`Save ${fmt$(Math.abs(saved))}`:"—",color:COLOR.success},
          {label:"Payoff Date",value:schedule.payoffDate||"—",color:COLOR.teal},
        ].map(s=>(
          <div key={s.label} style={{...panelSt(t,{textAlign:"center"})}}>
            <div style={{fontSize:10,color:t.tx2,fontWeight:600,marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:15,fontWeight:800,color:s.color,fontFamily:"monospace"}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Payoff Order */}
      {schedule.debts?.length>0 && (
        <div style={panelSt(t)}>
          <div style={{fontWeight:700,fontSize:14,color:t.tx1,marginBottom:12}}>Payoff Order</div>
          {schedule.debts.map((d,i)=>{
            const basePmt = d.minPayment + toNum(localExtra);
            const nextLump = lumps.length>0
              ? [...lumps].sort((a,b)=>a.date<b.date?-1:1)[0]
              : null;
            const activeCount = schedule.debts.length;
            let lumpLabel = null;
            if (nextLump) {
              if (lumpMode==="split") {
                lumpLabel = `+${fmt$(toNum(nextLump.amount)/activeCount)} lump ${nextLump.date}`;
              } else if (i===0) {
                lumpLabel = `+${fmt$(toNum(nextLump.amount))} lump ${nextLump.date}`;
              }
            }
            return (
              <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",
                borderBottom:i<schedule.debts.length-1?`1px solid ${t.border}`:"none"}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:COLOR.primary+"22",
                  color:COLOR.primary,fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {i+1}
                </div>
                <div style={{width:10,height:10,borderRadius:"50%",background:d.color}} />
                <div style={{flex:1,fontSize:13,color:t.tx1,fontWeight:600}}>
                  {d.name}
                  {lumpLabel && (
                    <span style={{fontSize:10,color:COLOR.warning,fontWeight:600,marginLeft:6}}>
                      {lumpLabel}
                    </span>
                  )}
                </div>
                <div style={{fontSize:11,color:t.tx2}}>{fmtPct(d.rate*100)}</div>
                <div style={{fontSize:11,color:t.tx2,fontFamily:"monospace"}}>{fmt$(basePmt)}/mo</div>
                <div style={{fontSize:12,color:COLOR.success,fontWeight:600}}>
                  {schedule.debtPayoffDates?.[d.id]||"—"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Analysis */}
      <div style={panelSt(t)}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:14,color:COLOR.purple}}>🤖 AI Schedule Analysis</div>
          <button onClick={runAI} disabled={aiLoading} style={btnPrimary({background:COLOR.purple,
            padding:"7px 14px",fontSize:12,opacity:aiLoading?0.6:1})}>
            {aiLoading?"Analyzing…":"Analyze"}
          </button>
        </div>
        {aiError && <div style={{fontSize:12,color:COLOR.danger,marginBottom:8}}>{aiError}</div>}
        {aiResults?.scheduleAnalysis && (
          <div>
            <div style={{fontSize:13,color:t.tx1,lineHeight:1.7,whiteSpace:"pre-wrap",
              background:t.surf,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
              {aiResults.scheduleAnalysis}
            </div>
            <div style={{display:"flex",gap:8}}>
              <CopyButton text={aiResults.scheduleAnalysis} t={t} />
              <button onClick={()=>{
                const blob=new Blob([aiResults.scheduleAnalysis],{type:"text/plain"});
                const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
                a.download="debt-schedule-analysis.txt"; a.click();
              }} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,
                padding:"4px 10px",color:t.tx2,cursor:"pointer",fontSize:11,fontWeight:600}}>
                ⬇ Download .txt
              </button>
            </div>
          </div>
        )}
        {!aiResults?.scheduleAnalysis && !aiLoading && (
          <div style={{fontSize:12,color:t.tx3}}>Click Analyze to get AI insights on your payoff schedule.</div>
        )}
      </div>

      {/* Month-by-month table */}
      <div style={panelSt(t)}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:14,color:t.tx1}}>Month-by-Month Schedule</div>
          <button onClick={()=>setShowTable(s=>!s)} style={btnGhost(t,{padding:"6px 14px",fontSize:12})}>
            {showTable?"Hide":"Show"}
          </button>
        </div>
        {showTable && (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr>
                  {["Month","Debt","Payment","Principal","Interest","Balance"].map(h=>(
                    <th key={h} style={{textAlign:"left",padding:"6px 8px",color:t.tx2,
                      borderBottom:`1px solid ${t.border}`,fontWeight:600,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.months.slice(0,48).flatMap(mo=>{
                  const rows = mo.rows.map((row,ri)=>(
                    <tr key={`${mo.month}-reg-${ri}`} style={{background:ri%2===0?"transparent":t.surf+"44"}}>
                      <td style={{padding:"4px 8px",color:t.tx2,fontFamily:"monospace"}}>{ri===0?mo.date:""}</td>
                      <td style={{padding:"4px 8px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:row.debtColor}} />
                          <span style={{color:t.tx1}}>{row.debtName}</span>
                        </div>
                      </td>
                      <td style={{padding:"4px 8px",fontFamily:"monospace",color:COLOR.primary}}>{fmt$(row.payment)}</td>
                      <td style={{padding:"4px 8px",fontFamily:"monospace",color:COLOR.success}}>{fmt$(row.principal)}</td>
                      <td style={{padding:"4px 8px",fontFamily:"monospace",color:COLOR.orange}}>{fmt$(row.interest)}</td>
                      <td style={{padding:"4px 8px",fontFamily:"monospace",color:t.tx1}}>{fmt$(row.balance)}</td>
                    </tr>
                  ));
                  if (mo.monthLump>0) {
                    const regTotal = mo.rows.reduce((s,r)=>s+r.payment,0);
                    rows.push(
                      <tr key={`${mo.month}-lump`} style={{background:COLOR.warning+"14",
                        borderLeft:`3px solid ${COLOR.warning}`}}>
                        <td style={{padding:"4px 8px",color:t.tx2,fontFamily:"monospace",fontSize:10}}></td>
                        <td colSpan={1} style={{padding:"4px 8px"}}>
                          <span style={{fontSize:11,fontWeight:700,color:COLOR.warning}}>
                            💰 LUMP SUM — {mo.date}
                            {mo.lumpMode==="split"?" (split evenly)":""}
                          </span>
                        </td>
                        <td style={{padding:"4px 8px",fontFamily:"monospace",color:COLOR.warning,fontWeight:700}}>
                          {fmt$(regTotal+mo.monthLump)}
                        </td>
                        <td style={{padding:"4px 8px",fontFamily:"monospace",color:COLOR.warning}}>{fmt$(mo.monthLump)}</td>
                        <td style={{padding:"4px 8px",color:t.tx3}}>—</td>
                        <td style={{padding:"4px 8px",color:t.tx3}}>—</td>
                      </tr>
                    );
                  }
                  return rows;
                })}
                {schedule.months.length>48 && (
                  <tr><td colSpan={6} style={{padding:"8px",color:t.tx3,fontSize:11,textAlign:"center"}}>
                    Showing first 48 months of {schedule.months.length} total
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddLumpSumModal open={showLumpModal} onClose={()=>setShowLumpModal(false)} onAdd={addLump} t={t} />
      <InfoModal open={infoOpen} onClose={()=>setInfoOpen(false)} title="Recalculate Minimums"
        body="When enabled, credit card minimum payments are recalculated each month as your balance decreases. This is more accurate but means minimums shrink over time, which can extend payoff. Disable to keep minimums fixed at their current amount." t={t} />
    </div>
  );
}

// ─── SingleDebtTab ────────────────────────────────────────────────────────────
function SingleDebtTab({ cards, loans, t }) {
  const all = [
    ...cards.map(c=>({...c,_type:"card",_label:`💳 ${c.name}`})),
    ...loans.map(l=>({...l,_type:"loan",_label:`${LOAN_ICONS[l.type]||"🏦"} ${l.name}`})),
  ];
  const [selId,setSelId] = useState(all[0]?.id||"");
  const [extra,setExtra] = useState("");
  const [lumps,setLumps] = useState([]);
  const [showLump,setShowLump] = useState(false);

  const item = all.find(d=>d.id===selId);

  function buildSingleSchedule() {
    if (!item) return null;
    if (item._type==="card") {
      return computeUnifiedSchedule([item],[],
        "avalanche",{extraMonthly:toNum(extra),lumpSums:lumps,recalcMins:false,lumpMode:"priority"});
    } else {
      return computeUnifiedSchedule([],[item],
        "avalanche",{extraMonthly:toNum(extra),lumpSums:lumps,recalcMins:false,lumpMode:"priority"});
    }
  }

  const sched = buildSingleSchedule();
  const W=560,H=220,PL=60,PR=16,PT=16,PB=40;
  const cW=W-PL-PR,cH=H-PT-PB;

  function buildPath(data,maxVal) {
    if (!data.length||!maxVal) return "";
    return data.map((v,i)=>{
      const x=PL+i/(data.length-1||1)*cW;
      const y=PT+(1-v/maxVal)*cH;
      return `${i===0?"M":"L"}${x},${y}`;
    }).join(" ");
  }

  const balData = sched?.months.map(m=>m.totalBalance)||[];
  const maxBal  = balData[0]||1;

  function exportCSV() {
    if (!sched) return;
    const rows = sched.months.flatMap(mo=>mo.rows.map(r=>[
      mo.date,r.debtName,r.payment.toFixed(2),r.principal.toFixed(2),r.interest.toFixed(2),r.balance.toFixed(2)
    ]));
    const csv=[["Date","Debt","Payment","Principal","Interest","Balance"],...rows]
      .map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`single-debt-${item?.name||"schedule"}.csv`; a.click();
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={panelSt(t)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,alignItems:"flex-end"}}>
          <div>
            <label style={labelSt(t)}>Select Debt</label>
            <select value={selId} onChange={e=>setSelId(e.target.value)} style={inputStyle(t)}>
              {all.map(d=><option key={d.id} value={d.id}>{d._label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt(t)}>Extra Monthly ($)</label>
            <input type="number" value={extra} onChange={e=>setExtra(e.target.value)}
              placeholder="0" min="0" style={inputStyle(t)} />
          </div>
          <button onClick={()=>setShowLump(true)} style={btnGhost(t,{whiteSpace:"nowrap"})}>+ Lump</button>
        </div>
      </div>

      {item && sched && (
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:12}}>
            {[
              {label:"Current Balance",value:fmt$(item._type==="card"?toNum(item.balance):toNum(item.currentBalance)),color:COLOR.danger},
              {label:"Total Interest",value:fmt$(sched.totalInterest),color:COLOR.orange},
              {label:"Total Paid",value:fmt$(sched.totalPaid),color:COLOR.primary},
              {label:"Payoff Date",value:sched.payoffDate||"—",color:COLOR.success},
              {label:"Months",value:sched.months.length,color:COLOR.teal},
            ].map(s=>(
              <div key={s.label} style={{...panelSt(t,{textAlign:"center"})}}>
                <div style={{fontSize:10,color:t.tx2,fontWeight:600,marginBottom:4}}>{s.label}</div>
                <div style={{fontSize:15,fontWeight:800,color:s.color,fontFamily:"monospace"}}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={panelSt(t)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:14,color:t.tx1}}>Balance Over Time</div>
              <button onClick={exportCSV} style={btnGhost(t,{padding:"5px 12px",fontSize:12})}>⬇ CSV</button>
            </div>
            <div style={{overflowX:"auto"}}>
              <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",maxWidth:W,display:"block"}}
                preserveAspectRatio="xMidYMid meet">
                {/* Y axis labels */}
                {[0,.25,.5,.75,1].map(p=>{
                  const y=PT+p*cH;
                  return <g key={p}>
                    <line x1={PL} y1={y} x2={W-PR} y2={y} stroke="#334155" strokeWidth={0.5} strokeDasharray="4,4"/>
                    <text x={PL-6} y={y+4} textAnchor="end" fontSize={9} fill="#64748b">
                      {fmt$(maxBal*(1-p))}
                    </text>
                  </g>;
                })}
                {/* Balance line */}
                {balData.length>1 && (
                  <>
                    <defs>
                      <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={item.color} stopOpacity={0.3}/>
                        <stop offset="100%" stopColor={item.color} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <path d={`${buildPath(balData,maxBal)} L${PL+cW},${PT+cH} L${PL},${PT+cH} Z`}
                      fill="url(#balGrad)"/>
                    <path d={buildPath(balData,maxBal)} fill="none" stroke={item.color} strokeWidth={2}/>
                  </>
                )}
                {/* X axis labels */}
                {[0,.25,.5,.75,1].map(p=>{
                  const idx=Math.round(p*(balData.length-1));
                  const mo=sched.months[idx];
                  if (!mo) return null;
                  const x=PL+p*cW;
                  return <text key={p} x={x} y={H-8} textAnchor="middle" fontSize={9} fill="#64748b">
                    {mo.date}
                  </text>;
                })}
              </svg>
            </div>
          </div>

          <div style={panelSt(t)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:14,color:t.tx1}}>Amortization Schedule</div>
              <button onClick={()=>{
                if (!sched||!item) return;
                const rows=sched.months.slice(0,60).map(mo=>[
                  mo.date,
                  fmt$(mo.moPaid),
                  fmt$(mo.rows.reduce((s,r)=>s+r.principal,0)),
                  fmt$(mo.moInterest),
                  fmt$(mo.totalBalance),
                ]);
                const csv=[["Date","Payment","Principal","Interest","Balance"],...rows]
                  .map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
                const blob=new Blob([csv],{type:"text/csv"});
                const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
                a.download=`${item.name.replace(/\s+/g,"-")}-amortization.csv`; a.click();
              }} style={btnGhost(t,{padding:"5px 12px",fontSize:12})}>⬇ CSV</button>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr>
                    {["Date","Payment","Principal","Interest","Balance"].map(h=>(
                      <th key={h} style={{textAlign:"left",padding:"6px 8px",color:t.tx2,
                        borderBottom:`1px solid ${t.border}`,fontWeight:600}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sched.months.slice(0,60).map((mo,i)=>(
                    <tr key={i} style={{background:i%2===0?"transparent":t.surf+"44"}}>
                      <td style={{padding:"4px 8px",fontFamily:"monospace",color:t.tx2,fontSize:11}}>{mo.date}</td>
                      <td style={{padding:"4px 8px",fontFamily:"monospace",color:COLOR.primary}}>{fmt$(mo.moPaid)}</td>
                      <td style={{padding:"4px 8px",fontFamily:"monospace",color:COLOR.success}}>
                        {fmt$(mo.rows.reduce((s,r)=>s+r.principal,0))}
                      </td>
                      <td style={{padding:"4px 8px",fontFamily:"monospace",color:COLOR.orange}}>
                        {fmt$(mo.moInterest)}
                      </td>
                      <td style={{padding:"4px 8px",fontFamily:"monospace",color:t.tx1}}>{fmt$(mo.totalBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {!all.length && (
        <div style={{...panelSt(t),textAlign:"center",color:t.tx3,padding:40}}>Add a debt to see its schedule.</div>
      )}
      <AddLumpSumModal open={showLump} onClose={()=>setShowLump(false)} onAdd={ls=>setLumps(p=>[...p,ls])} t={t} />
    </div>
  );
}

// ─── ChartsTab ────────────────────────────────────────────────────────────────
function ChartsTab({ cards, loans, method, extra, lumps, lumpMode, recalcMins, t }) {
  const opts = { extraMonthly:toNum(extra), lumpSums:lumps, recalcMins, lumpMode };
  const avSched  = computeUnifiedSchedule(cards,loans,"avalanche",opts);
  const snSched  = computeUnifiedSchedule(cards,loans,"snowball",opts);
  const W=560,H=220,PL=60,PR=16,PT=16,PB=40;
  const cW=W-PL-PR, cH=H-PT-PB;

  function mkPath(months, maxVal) {
    if (!months.length||!maxVal) return "";
    return months.map((m,i)=>{
      const x=PL+i/(months.length-1||1)*cW;
      const y=PT+(1-m.totalBalance/maxVal)*cH;
      return `${i===0?"M":"L"}${x},${y}`;
    }).join(" ");
  }

  const maxMonths = Math.max(avSched.months.length, snSched.months.length,1);
  const maxBal    = Math.max(
    avSched.months[0]?.totalBalance||0,
    snSched.months[0]?.totalBalance||0, 1);

  // Per-debt balance data from current method schedule
  const schedule = method==="avalanche" ? avSched : snSched;
  const perDebt  = (schedule.debts||[]).map(d=>{
    const balData = schedule.months.map(mo=>{
      const row = mo.rows.find(r=>r.debtId===d.id);
      return row ? row.balance : 0;
    });
    return { ...d, balData };
  });

  // Interest bar chart data
  const interestByDebt = (schedule.debts||[]).map(d=>{
    let total=0;
    schedule.months.forEach(mo=>{
      mo.rows.filter(r=>r.debtId===d.id).forEach(r=>{ total+=r.interest; });
    });
    return { ...d, total };
  });
  const maxInt = Math.max(...interestByDebt.map(d=>d.total),1);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Avalanche vs Snowball */}
      <div style={panelSt(t)}>
        <div style={{fontWeight:700,fontSize:14,color:t.tx1,marginBottom:4}}>Avalanche vs Snowball — Total Balance</div>
        <div style={{fontSize:11,color:t.tx2,marginBottom:12}}>Lower curve = faster payoff</div>
        <div style={{overflowX:"auto"}}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",maxWidth:W,display:"block"}}
            preserveAspectRatio="xMidYMid meet">
            {[0,.25,.5,.75,1].map(p=>{
              const y=PT+p*cH;
              return <g key={p}>
                <line x1={PL} y1={y} x2={W-PR} y2={y} stroke="#334155" strokeWidth={0.5} strokeDasharray="4,4"/>
                <text x={PL-6} y={y+4} textAnchor="end" fontSize={9} fill="#64748b">{fmt$(maxBal*(1-p))}</text>
              </g>;
            })}
            <path d={mkPath(avSched.months,maxBal)} fill="none" stroke={COLOR.primary} strokeWidth={2.5}/>
            <path d={mkPath(snSched.months,maxBal)} fill="none" stroke={COLOR.pink} strokeWidth={2} strokeDasharray="6,3"/>
            <text x={PL+8} y={PT+14} fontSize={10} fill={COLOR.primary} fontWeight={700}>🏔 Avalanche</text>
            <text x={PL+8} y={PT+26} fontSize={10} fill={COLOR.pink} fontWeight={700}>❄ Snowball</text>
            {[0,.25,.5,.75,1].map(p=>{
              const idx=Math.round(p*(maxMonths-1));
              const mo=avSched.months[idx]||snSched.months[idx];
              if(!mo) return null;
              const x=PL+p*cW;
              return <text key={p} x={x} y={H-8} textAnchor="middle" fontSize={9} fill="#64748b">{mo.date}</text>;
            })}
          </svg>
        </div>
        <div style={{display:"flex",gap:24,marginTop:8,fontSize:12}}>
          <div>Avalanche interest: <strong style={{color:COLOR.primary,fontFamily:"monospace"}}>{fmt$(avSched.totalInterest)}</strong></div>
          <div>Snowball interest: <strong style={{color:COLOR.pink,fontFamily:"monospace"}}>{fmt$(snSched.totalInterest)}</strong></div>
          {avSched.totalInterest<snSched.totalInterest && (
            <div style={{color:COLOR.success}}>Save <strong>{fmt$(snSched.totalInterest-avSched.totalInterest)}</strong> with Avalanche</div>
          )}
        </div>
      </div>

      {/* Per-debt curves */}
      {perDebt.length>0 && (
        <div style={panelSt(t)}>
          <div style={{fontWeight:700,fontSize:14,color:t.tx1,marginBottom:4}}>Per-Debt Balance Curves</div>
          <div style={{fontSize:11,color:t.tx2,marginBottom:12}}>Each line shows one debt's balance declining over time</div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:8}}>
            {perDebt.map(d=>(
              <div key={d.id} style={{display:"flex",alignItems:"center",gap:4,fontSize:11}}>
                <div style={{width:12,height:3,background:d.color,borderRadius:2}}/>
                <span style={{color:t.tx2}}>{d.name}</span>
              </div>
            ))}
          </div>
          <div style={{overflowX:"auto"}}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",maxWidth:W,display:"block"}}
              preserveAspectRatio="xMidYMid meet">
              {[0,.25,.5,.75,1].map(p=>{
                const y=PT+p*cH;
                return <g key={p}>
                  <line x1={PL} y1={y} x2={W-PR} y2={y} stroke="#334155" strokeWidth={0.5} strokeDasharray="4,4"/>
                  <text x={PL-6} y={y+4} textAnchor="end" fontSize={9} fill="#64748b">
                    {fmt$(maxBal*(1-p))}
                  </text>
                </g>;
              })}
              {perDebt.map(d=>{
                if (!d.balData.length) return null;
                const n = d.balData.length;
                const pathD = d.balData.map((v,i)=>{
                  const x=PL+i/(n-1||1)*cW;
                  const y=PT+(1-v/maxBal)*cH;
                  return `${i===0?"M":"L"}${x},${y}`;
                }).join(" ");
                return <path key={d.id} d={pathD} fill="none" stroke={d.color} strokeWidth={2}/>;
              })}
              {[0,.25,.5,.75,1].map(p=>{
                const idx=Math.round(p*(schedule.months.length-1));
                const mo=schedule.months[idx];
                if(!mo) return null;
                const x=PL+p*cW;
                return <text key={p} x={x} y={H-8} textAnchor="middle" fontSize={9} fill="#64748b">{mo.date}</text>;
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Interest cost bar chart */}
      {interestByDebt.length>0 && (
        <div style={panelSt(t)}>
          <div style={{fontWeight:700,fontSize:14,color:t.tx1,marginBottom:12}}>Interest Cost by Debt</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {interestByDebt.sort((a,b)=>b.total-a.total).map(d=>(
              <div key={d.id}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                  <span style={{color:t.tx1,fontWeight:600}}>{d.name}</span>
                  <span style={{color:COLOR.orange,fontFamily:"monospace",fontWeight:700}}>{fmt$(d.total)}</span>
                </div>
                <div style={{height:14,borderRadius:6,background:t.surf,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(d.total/maxInt)*100}%`,
                    background:d.color,borderRadius:6,transition:"width .3s"}} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── StrategyPanel ────────────────────────────────────────────────────────────
function StrategyPanel({ cards, loans, apiKey, aiResults, onSaveAiResults, onApplyStrategy, t }) {
  const [open,setOpen] = useState(false);
  const [answers,setAnswers] = useState({});
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");

  async function buildStrategy() {
    if (!apiKey) { setError("Add your API key via 🔑 in the nav bar."); return; }
    setLoading(true); setError("");
    try {
      const debtCtx = [
        ...cards.map(c=>`Card: ${c.name}, Balance: ${fmt$(c.balance)}, APR: ${fmtPct(c.apr)}`),
        ...loans.map(l=>`Loan: ${l.name} (${l.type}), Balance: ${fmt$(l.currentBalance)}, Rate: ${fmtPct(l.interestRate)}`),
      ].join("\n");
      const qaStr = STRATEGY_QUESTIONS.map(q=>`${q.label}\nAnswer: ${answers[q.id]||"Not answered"}`).join("\n\n");
      const prompt = `You are a personal finance advisor. Based on the user's debt situation and answers, provide a specific debt payoff strategy.\n\nDebts:\n${debtCtx}\n\nUser responses:\n${qaStr}\n\nProvide:\n1. Recommended method (Avalanche or Snowball) and why\n2. Suggested extra monthly payment\n3. Specific action steps for this person\n4. Estimated payoff improvement with your recommendation\n\nBe concrete and specific. Keep it under 300 words.`;
      const res = await callClaude(apiKey,{ model:MODEL, max_tokens:700,
        messages:[{role:"user",content:prompt}] });
      const data = await res.json();
      const text = data.content?.[0]?.text||"";
      const next = {...(aiResults||{}), strategy:text};
      onSaveAiResults(next);
    } catch(e) {
      setError(e.message||"AI error");
    } finally {
      setLoading(false);
    }
  }

  const strategy = aiResults?.strategy;

  function extractMethod(text) {
    if (!text) return null;
    if (/avalanche/i.test(text)) return "avalanche";
    if (/snowball/i.test(text)) return "snowball";
    return null;
  }
  function extractExtra(text) {
    if (!text) return null;
    const m = text.match(/\$(\d[\d,]*)/);
    return m ? m[1].replace(/,/g,"") : null;
  }

  return (
    <div style={panelSt(t,{border:`1px solid ${COLOR.purple}33`})}>
      <button onClick={()=>setOpen(o=>!o)} style={{display:"flex",justifyContent:"space-between",
        alignItems:"center",width:"100%",background:"none",border:"none",cursor:"pointer",padding:0}}>
        <div style={{fontWeight:700,fontSize:14,color:COLOR.purple}}>📋 Build My Strategy</div>
        <span style={{color:COLOR.purple,fontSize:18}}>{open?"▲":"▼"}</span>
      </button>

      {open && (
        <div style={{marginTop:16}}>
          {STRATEGY_QUESTIONS.map(q=>(
            <div key={q.id} style={{marginBottom:16}}>
              <label style={{...labelSt(t),fontSize:12,color:t.tx1,fontWeight:600,lineHeight:1.4,marginBottom:8,display:"block"}}>
                {q.label}
              </label>
              {q.type==="text" ? (
                <input value={answers[q.id]||""} onChange={e=>setAnswers(p=>({...p,[q.id]:e.target.value}))}
                  placeholder={q.placeholder} style={inputStyle(t)} />
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {q.options.map(opt=>(
                    <label key={opt} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",
                      fontSize:13,color:answers[q.id]===opt?COLOR.primary:t.tx1}}>
                      <input type="radio" name={q.id} value={opt} checked={answers[q.id]===opt}
                        onChange={()=>setAnswers(p=>({...p,[q.id]:opt}))}
                        style={{accentColor:COLOR.primary}} />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          {error && <div style={{fontSize:12,color:COLOR.danger,marginBottom:8}}>{error}</div>}

          <button onClick={buildStrategy} disabled={loading} style={btnPrimary({width:"100%",
            background:COLOR.purple,opacity:loading?0.6:1})}>
            {loading?"Building Strategy…":"🧠 Generate My Strategy"}
          </button>
        </div>
      )}

      {strategy && (
        <div style={{marginTop:16}}>
          <div style={{fontSize:13,color:t.tx1,lineHeight:1.7,whiteSpace:"pre-wrap",
            background:t.surf,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
            {strategy}
          </div>
          {(extractMethod(strategy)||extractExtra(strategy)) && (
            <button onClick={()=>onApplyStrategy(extractMethod(strategy),extractExtra(strategy))}
              style={btnPrimary({width:"100%",background:COLOR.success})}>
              ✓ Apply This Strategy
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── WhatIfTab ────────────────────────────────────────────────────────────────
function WhatIfTab({ cards, loans, apiKey, profileId, aiResults, onSaveAiResults, onApplyStrategy, t }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(()=>{
    messagesEndRef.current?.scrollIntoView({ behavior:"smooth" });
  },[messages]);

  function buildSystemPrompt() {
    const debtCtx = [
      ...cards.map(c=>`Card: ${c.name}, Balance: ${fmt$(c.balance)}, APR: ${fmtPct(c.apr)}, Min pmt: ${fmt$(calcMinPmt(c.balance,c.apr))}`),
      ...loans.map(l=>`Loan: ${l.name} (${l.type}), Balance: ${fmt$(l.currentBalance)}, Rate: ${fmtPct(l.interestRate)}, Pmt: ${fmt$(l.monthlyPayment)}`),
    ].join("\n");
    return `You are a helpful personal finance advisor specializing in debt payoff strategies. The user has the following debts:\n\n${debtCtx}\n\nAnswer their what-if questions about debt payoff scenarios, extra payments, refinancing, and strategies. Be specific with numbers when possible. Keep responses concise and actionable.`;
  }

  async function sendMessage() {
    if (!input.trim()) return;
    if (!apiKey) { setError("Add your API key via 🔑 in the nav bar."); return; }
    const userMsg = { role:"user", content:input.trim() };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setInput("");
    setLoading(true); setError("");
    try {
      const res = await callClaude(apiKey,{
        model:MODEL, max_tokens:600,
        system:buildSystemPrompt(),
        messages:nextMsgs,
      });
      const data = await res.json();
      const text = data.content?.[0]?.text||"";
      setMessages(prev=>[...prev,{role:"assistant",content:text}]);
    } catch(e) {
      setError(e.message||"AI error");
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <StrategyPanel cards={cards} loans={loans} apiKey={apiKey} aiResults={aiResults}
        onSaveAiResults={onSaveAiResults} onApplyStrategy={onApplyStrategy} t={t} />

      <div style={panelSt(t)}>
        <div style={{fontWeight:700,fontSize:14,color:COLOR.purple,marginBottom:12}}>🤖 What-If Chat</div>
        {!apiKey && (
          <div style={{fontSize:12,color:COLOR.warning,background:COLOR.warning+"12",
            border:`1px solid ${COLOR.warning}44`,borderRadius:8,padding:"8px 12px",marginBottom:12}}>
            Add your API key via 🔑 to use the AI chat.
          </div>
        )}
        <div style={{minHeight:300,maxHeight:420,overflowY:"auto",display:"flex",
          flexDirection:"column",gap:12,marginBottom:12,
          background:t.surf,borderRadius:10,padding:12}}>
          {messages.length===0 && (
            <div style={{fontSize:13,color:t.tx3,textAlign:"center",padding:"40px 20px"}}>
              Ask me anything about your debt payoff — what if I paid $200 extra? What if I refinanced this loan?
            </div>
          )}
          {messages.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",
              alignItems:"flex-start",gap:6}}>
              <div style={{maxWidth:"80%",background:m.role==="user"?COLOR.primary:t.panelBg,
                color:m.role==="user"?"#fff":t.tx1,borderRadius:12,
                padding:"10px 14px",fontSize:13,lineHeight:1.6,
                border:m.role==="assistant"?`1px solid ${t.border}`:"none"}}>
                {m.content}
              </div>
              {m.role==="assistant" && (
                <CopyButton text={m.content} label="📋" t={t}
                  style={{padding:"4px 7px",flexShrink:0,marginTop:2}} />
              )}
            </div>
          ))}
          {loading && (
            <div style={{display:"flex",justifyContent:"flex-start"}}>
              <div style={{background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:12,
                padding:"10px 14px",color:t.tx2,fontSize:13}}>Thinking…</div>
            </div>
          )}
          <div ref={messagesEndRef}/>
        </div>
        {error && <div style={{fontSize:12,color:COLOR.danger,marginBottom:8}}>{error}</div>}
        <div style={{display:"flex",gap:8}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
            placeholder="What if I paid an extra $300/month?" rows={2}
            style={{...inputStyle(t),flex:1,resize:"none"}} />
          <button onClick={sendMessage} disabled={loading||!input.trim()}
            style={btnPrimary({padding:"0 16px",opacity:(loading||!input.trim())?0.6:1,alignSelf:"stretch"})}>
            Send
          </button>
        </div>
        <div style={{fontSize:11,color:t.tx3,marginTop:4}}>Press Enter to send, Shift+Enter for new line</div>
      </div>
    </div>
  );
}

// ─── ProgressTab ──────────────────────────────────────────────────────────────
function ProgressTab({ cards, loans, logs, t }) {
  const [filter,setFilter] = useState("");
  const all = [
    ...cards.map(c=>({...c,_type:"card"})),
    ...loans.map(l=>({...l,_type:"loan"})),
  ];

  const filtered = logs.filter(lg=>!filter || lg.debtName?.toLowerCase().includes(filter.toLowerCase()));

  function getMilestones(item) {
    const orig = item._type==="card" ? toNum(item.originalBalance)||toNum(item.balance)
                                     : toNum(item.originalBalance)||toNum(item.currentBalance);
    const cur  = item._type==="card" ? toNum(item.balance) : toNum(item.currentBalance);
    const paidPct = orig>0 ? Math.min(1,(orig-cur)/orig) : 0;
    return [25,50,75,100].map(pct=>({
      pct, reached:paidPct*100>=pct,
    }));
  }

  const totalLoggedPmt = logs.reduce((s,l)=>s+toNum(l.amount),0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Milestones */}
      <div style={panelSt(t)}>
        <div style={{fontWeight:700,fontSize:14,color:t.tx1,marginBottom:12}}>Milestone Badges</div>
        {all.map(item=>{
          const milestones = getMilestones(item);
          const orig = item._type==="card" ? toNum(item.originalBalance)||toNum(item.balance)
                                           : toNum(item.originalBalance)||toNum(item.currentBalance);
          const cur  = item._type==="card" ? toNum(item.balance) : toNum(item.currentBalance);
          const pct  = orig>0 ? Math.min(100,Math.max(0,(orig-cur)/orig*100)) : 0;
          return (
            <div key={item.id} style={{padding:"12px 0",borderBottom:`1px solid ${t.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:item.color}}/>
                  <span style={{fontSize:13,fontWeight:600,color:t.tx1}}>{item.name}</span>
                </div>
                <span style={{fontSize:12,color:t.tx2}}>{pct.toFixed(0)}% paid off</span>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:6}}>
                {milestones.map(m=>(
                  <div key={m.pct} style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:6,
                    background:m.reached?COLOR.success+"22":t.surf,
                    color:m.reached?COLOR.success:t.tx3,
                    border:`1px solid ${m.reached?COLOR.success+"44":t.border}`}}>
                    {m.reached?"🏆 ":""}{m.pct}%
                  </div>
                ))}
              </div>
              <div style={{height:6,borderRadius:3,background:t.surf,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct}%`,background:item.color,
                  borderRadius:3,transition:"width .3s"}}/>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment Log */}
      <div style={panelSt(t)}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:t.tx1}}>Payment Log</div>
            <div style={{fontSize:11,color:t.tx2,marginTop:2}}>
              Total logged: <span style={{color:COLOR.success,fontFamily:"monospace",fontWeight:700}}>{fmt$(totalLoggedPmt)}</span>
            </div>
          </div>
          <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter by debt…"
            style={{...inputStyle(t),width:160}} />
        </div>
        {filtered.length===0 && (
          <div style={{fontSize:13,color:t.tx3,textAlign:"center",padding:"20px 0"}}>
            {logs.length===0?"No payments logged yet.":"No payments match your filter."}
          </div>
        )}
        <div style={{overflowX:"auto"}}>
          {filtered.length>0 && (
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr>
                  {["Date","Debt","Amount","Planned","Diff"].map(h=>(
                    <th key={h} style={{textAlign:"left",padding:"6px 8px",color:t.tx2,
                      borderBottom:`1px solid ${t.border}`,fontWeight:600}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...filtered].reverse().map((lg,i)=>{
                  const diff = toNum(lg.amount)-toNum(lg.planned);
                  return (
                    <tr key={lg.id||i} style={{background:i%2===0?"transparent":t.surf+"44"}}>
                      <td style={{padding:"4px 8px",fontFamily:"monospace",color:t.tx2,fontSize:11}}>
                        {lg.date?.slice(0,10)||"—"}
                      </td>
                      <td style={{padding:"4px 8px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:lg.debtColor||"#888"}}/>
                          <span style={{color:t.tx1}}>{lg.debtName}</span>
                        </div>
                      </td>
                      <td style={{padding:"4px 8px",fontFamily:"monospace",color:COLOR.success,fontWeight:700}}>
                        {fmt$(lg.amount)}
                      </td>
                      <td style={{padding:"4px 8px",fontFamily:"monospace",color:t.tx2}}>{fmt$(lg.planned)}</td>
                      <td style={{padding:"4px 8px",fontFamily:"monospace",
                        color:diff>=0?COLOR.success:COLOR.danger}}>
                        {diff>=0?"+":""}{fmt$(diff)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PlannerModal ─────────────────────────────────────────────────────────────
function PlannerModal({ open, onClose, cards, loans, logs, method, setMethod, extra, setExtra,
  lumps, setLumps, lumpMode, setLumpMode, recalcMins, setRecalcMins, profileId, apiKey,
  aiResults, onSaveAiResults, onSavePlanner, onApplyStrategy, t, darkMode }) {
  const [activeTab, setActiveTab] = useState("schedule");
  if (!open) return null;

  const schedule = computeUnifiedSchedule(cards,loans,method,
    {extraMonthly:toNum(extra),lumpSums:lumps,recalcMins,lumpMode});

  const TABS = [
    {id:"schedule",label:"📅 Schedule"},
    {id:"single",label:"🔍 Single Debt"},
    {id:"charts",label:"📊 Charts"},
    {id:"whatif",label:"🤖 What-If"},
    {id:"progress",label:"🏆 Progress"},
  ];

  return (
    <div style={{position:"fixed",inset:0,background:darkMode?"#020617":"#f1f5f9",zIndex:1500,
      display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{background:darkMode?"#0f172a":"#ffffff",borderBottom:`1px solid ${darkMode?"#1e293b":"#e2e8f0"}`,
        padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <div style={{fontWeight:800,fontSize:18,color:darkMode?"#f1f5f9":"#0f172a"}}>📊 Debt Planner</div>
        <button onClick={onClose} style={{background:"none",border:`1px solid ${darkMode?"#334155":"#e2e8f0"}`,
          borderRadius:8,padding:"6px 14px",color:darkMode?"#94a3b8":"#64748b",cursor:"pointer",fontSize:14,fontWeight:600}}>
          ✕ Close
        </button>
      </div>
      <div style={{display:"flex",gap:6,padding:"10px 20px",overflowX:"auto",flexShrink:0,
        borderBottom:`1px solid ${darkMode?"#1e293b":"#e2e8f0"}`}}>
        {TABS.map(tb=>(
          <button key={tb.id} onClick={()=>setActiveTab(tb.id)} style={tabBtn(activeTab===tb.id,t)}>
            {tb.label}
          </button>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px"}}>
        <div style={{maxWidth:960,margin:"0 auto"}}>
          {activeTab==="schedule" && (
            <ScheduleTab cards={cards} loans={loans} method={method} setMethod={setMethod}
              extra={extra} setExtra={setExtra} lumps={lumps} setLumps={setLumps}
              lumpMode={lumpMode} setLumpMode={setLumpMode} recalcMins={recalcMins}
              setRecalcMins={setRecalcMins} profileId={profileId} aiResults={aiResults}
              apiKey={apiKey} onSaveAiResults={onSaveAiResults} onSavePlanner={onSavePlanner} t={t} darkMode={darkMode} />
          )}
          {activeTab==="single" && (
            <SingleDebtTab cards={cards} loans={loans} t={t} darkMode={darkMode} />
          )}
          {activeTab==="charts" && (
            <ChartsTab cards={cards} loans={loans} method={method} extra={extra}
              lumps={lumps} lumpMode={lumpMode} recalcMins={recalcMins} t={t} darkMode={darkMode} />
          )}
          {activeTab==="whatif" && (
            <WhatIfTab cards={cards} loans={loans} apiKey={apiKey} profileId={profileId}
              aiResults={aiResults} onSaveAiResults={onSaveAiResults}
              onApplyStrategy={onApplyStrategy} t={t} darkMode={darkMode} />
          )}
          {activeTab==="progress" && (
            <ProgressTab cards={cards} loans={loans} logs={logs} t={t} darkMode={darkMode} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── NavBar ───────────────────────────────────────────────────────────────────
function NavBar({ profiles, activeProfile, darkMode, setDarkMode, apiKey, onOpenApiKey,
  onOpenBackup, onSwitchProfile, itemCount, t }) {
  const [showProfiles, setShowProfiles] = useState(false);
  const cloud = hasCloudStorage();

  return (
    <div style={{background:t.deepBg,borderBottom:`1px solid ${t.border}`,padding:"11px 20px",
      display:"flex",justifyContent:"space-between",alignItems:"center",
      position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:32,height:32,borderRadius:8,
          background:"linear-gradient(135deg,#6366f1,#ec4899)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>💸</div>
        <span style={{fontWeight:800,fontSize:18,color:t.tx1}}>DebtTracker</span>
        <span style={{fontSize:10,color:COLOR.primary,background:COLOR.primary+"18",
          border:`1px solid ${COLOR.primary}33`,borderRadius:6,padding:"2px 8px",fontWeight:700}}>
          {itemCount} debts
        </span>
        <span style={{fontSize:10,color:cloud?COLOR.success:COLOR.warning,
          background:cloud?COLOR.success+"18":COLOR.warning+"18",
          border:`1px solid ${cloud?COLOR.success+"33":COLOR.warning+"33"}`,
          borderRadius:6,padding:"2px 8px",fontWeight:600}}>
          {cloud?"☁ Cloud Sync":"💾 Local Only"}
        </span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <button onClick={()=>setDarkMode(d=>!d)} style={{background:t.surf,border:`1px solid ${t.border}`,
          borderRadius:8,padding:"6px 11px",color:t.tx1,cursor:"pointer",fontSize:14}}>{darkMode?"☀️":"🌙"}</button>
        <button onClick={onOpenBackup} style={{background:t.surf,border:`1px solid ${t.border}`,
          borderRadius:8,padding:"6px 11px",color:t.tx2,cursor:"pointer",fontSize:14}}
          title="Backup & Restore">📦</button>
        <button onClick={onOpenApiKey} style={{background:apiKey?COLOR.purple+"18":t.surf,
          border:`1px solid ${apiKey?COLOR.purple+"44":t.border}`,
          borderRadius:8,padding:"6px 11px",color:apiKey?COLOR.purple:t.tx2,cursor:"pointer",fontSize:14}}
          title="API Key">🔑</button>
        {activeProfile && (
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowProfiles(s=>!s)}
              style={{width:34,height:34,borderRadius:"50%",
                background:activeProfile.avatarColor||COLOR.primary,
                border:"none",cursor:"pointer",fontSize:14,fontWeight:800,color:"#fff",
                display:"flex",alignItems:"center",justifyContent:"center"}}>
              {(activeProfile.name||"?")[0].toUpperCase()}
            </button>
            {showProfiles && profiles.length>0 && (
              <div style={{position:"absolute",right:0,top:40,background:t.panelBg,
                border:`1px solid ${t.border}`,borderRadius:12,padding:8,
                boxShadow:"0 8px 24px rgba(0,0,0,.3)",zIndex:200,minWidth:160}}>
                {profiles.map(p=>(
                  <button key={p.id} onClick={()=>{onSwitchProfile(p.id);setShowProfiles(false);}}
                    style={{display:"flex",alignItems:"center",gap:8,width:"100%",background:"none",
                      border:"none",padding:"8px 10px",cursor:"pointer",borderRadius:8,
                      color:t.tx1,fontSize:13,
                      background:p.id===activeProfile.id?COLOR.primary+"18":"none",textAlign:"left"}}>
                    <div style={{width:24,height:24,borderRadius:"50%",background:p.avatarColor||COLOR.primary,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,
                      fontWeight:800,color:"#fff",flexShrink:0}}>
                      {(p.name||"?")[0].toUpperCase()}
                    </div>
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [loading,setLoading]       = useState(true);
  const [darkMode,setDarkMode]     = useState(()=>localStorage.getItem("dt_dark")!=="false");
  const [profiles,setProfiles]     = useState([]);
  const [activeProfileId,setActiveProfileId] = useState(null);
  const [cards,setCards]           = useState([]);
  const [loans,setLoans]           = useState([]);
  const [logs,setLogs]             = useState([]);
  const [aiResults,setAiResults]   = useState(null);
  const [apiKey,setApiKey]         = useState("");
  const [interleave,setInterleave] = useState(false);

  // Planner state
  const [method,setMethod]         = useState("avalanche");
  const [extra,setExtra]           = useState("");
  const [lumps,setLumps]           = useState([]);
  const [lumpMode,setLumpMode]     = useState("priority");
  const [recalcMins,setRecalcMins] = useState(false);

  // UI state
  const [showPlanner,setShowPlanner]     = useState(false);
  const [showAddDebt,setShowAddDebt]     = useState(false);
  const [editCard,setEditCard]           = useState(null);
  const [editLoan,setEditLoan]           = useState(null);
  const [deleteTarget,setDeleteTarget]   = useState(null);
  const [quickPayItem,setQuickPayItem]   = useState(null);
  const [showApiKey,setShowApiKey]       = useState(false);
  const [showBackup,setShowBackup]       = useState(false);
  const [showImportBanner,setShowImportBanner] = useState(false);

  const t = useTheme(darkMode);
  const activeProfile = profiles.find(p=>p.id===activeProfileId)||null;

  useEffect(()=>{ localStorage.setItem("dt_dark",darkMode); },[darkMode]);

  useEffect(()=>{
    async function init() {
      const profs  = await storeGet("cc_profiles",true)||[];
      const actId  = await storeGet("cc_active_profile",true);
      const key    = await storeGet("cc_apikey",true);
      if (key) setApiKey(key);
      setProfiles(profs);

      const id = actId||(profs[0]?.id)||null;
      setActiveProfileId(id);

      if (id) {
        const [c,l,lg,ai,ex,lp,lm,rm] = await Promise.all([
          storeGet(`dt_cards_${id}`,true),
          storeGet(`dt_loans_${id}`,true),
          storeGet(`dt_logs_${id}`,true),
          storeGet(`dt_ai_results_${id}`,true),
          storeGet(`dt_planner_extra_${id}`,true),
          storeGet(`dt_planner_lumps_${id}`,true),
          storeGet(`dt_planner_lump_mode_${id}`,true),
          storeGet(`dt_planner_recalc_${id}`,true),
        ]);
        setCards(c||[]);
        setLoans(l||[]);
        setLogs(lg||[]);
        setAiResults(ai||null);
        if (ex!=null) setExtra(ex);
        if (lp!=null) setLumps(lp);
        if (lm!=null) setLumpMode(lm);
        if (rm!=null) setRecalcMins(rm);

        // Check import banner
        const dismissed = await storeGet(`dt_import_dismissed_${id}`,true);
        if (!dismissed) {
          const [ccCards,ltLoans,dtCards,dtLoans] = await Promise.all([
            storeGet(`cc_cards_${id}`,true),
            storeGet(`lt_loans_${id}`,true),
            storeGet(`dt_cards_${id}`,true),
            storeGet(`dt_loans_${id}`,true),
          ]);
          const hasSource = (ccCards?.length>0)||(ltLoans?.length>0);
          const hasTarget = (dtCards?.length>0)||(dtLoans?.length>0);
          if (hasSource && !hasTarget) setShowImportBanner(true);
        }
      }
      setLoading(false);
    }
    init();
  },[]);

  async function switchProfile(id) {
    setActiveProfileId(id);
    await storeSet("cc_active_profile",id,true);
    setCards([]); setLoans([]); setLogs([]);
    const [c,l,lg,ai,ex,lp,lm,rm] = await Promise.all([
      storeGet(`dt_cards_${id}`,true),
      storeGet(`dt_loans_${id}`,true),
      storeGet(`dt_logs_${id}`,true),
      storeGet(`dt_ai_results_${id}`,true),
      storeGet(`dt_planner_extra_${id}`,true),
      storeGet(`dt_planner_lumps_${id}`,true),
      storeGet(`dt_planner_lump_mode_${id}`,true),
      storeGet(`dt_planner_recalc_${id}`,true),
    ]);
    setCards(c||[]); setLoans(l||[]); setLogs(lg||[]);
    setAiResults(ai||null);
    if (ex!=null) setExtra(ex); if (lp!=null) setLumps(lp);
    if (lm!=null) setLumpMode(lm); if (rm!=null) setRecalcMins(rm);
  }

  async function saveCards(next) { setCards(next); await storeSet(`dt_cards_${activeProfileId}`,next,true); }
  async function saveLoans(next) { setLoans(next); await storeSet(`dt_loans_${activeProfileId}`,next,true); }
  async function saveLogs(next)  { setLogs(next);  await storeSet(`dt_logs_${activeProfileId}`,next,true); }
  async function saveAiResults(next) { setAiResults(next); await storeSet(`dt_ai_results_${activeProfileId}`,next,true); }

  async function savePlanner({ extra:ex, lumps:lp, lumpMode:lm, recalcMins:rm }) {
    if (ex!==undefined) { setExtra(ex); await storeSet(`dt_planner_extra_${activeProfileId}`,ex,true); }
    if (lp!==undefined) { setLumps(lp); await storeSet(`dt_planner_lumps_${activeProfileId}`,lp,true); }
    if (lm!==undefined) { setLumpMode(lm); await storeSet(`dt_planner_lump_mode_${activeProfileId}`,lm,true); }
    if (rm!==undefined) { setRecalcMins(rm); await storeSet(`dt_planner_recalc_${activeProfileId}`,rm,true); }
  }

  async function saveApiKey(key) {
    setApiKey(key); setShowApiKey(false);
    await storeSet("cc_apikey",key,true);
  }

  function handleSaveCard(card) {
    const exists = cards.find(c=>c.id===card.id);
    const next = exists ? cards.map(c=>c.id===card.id?card:c) : [...cards,card];
    saveCards(next);
    setEditCard(null); setShowAddDebt(false);
  }

  function handleSaveLoan(loan) {
    const exists = loans.find(l=>l.id===loan.id);
    const next = exists ? loans.map(l=>l.id===loan.id?loan:l) : [...loans,loan];
    saveLoans(next);
    setEditLoan(null); setShowAddDebt(false);
  }

  function handleEdit(item, _type) {
    if (_type==="card") { setEditCard(item); setEditLoan(null); }
    else { setEditLoan(item); setEditCard(null); }
    setShowAddDebt(true);
  }

  function handleDelete(item, _type) { setDeleteTarget({item,_type}); }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { item, _type } = deleteTarget;
    if (_type==="card") await saveCards(cards.filter(c=>c.id!==item.id));
    else await saveLoans(loans.filter(l=>l.id!==item.id));
    setDeleteTarget(null);
  }

  async function handleQuickPay({ item, amount, date }) {
    const planned = item._type==="card"
      ? toNum(item.monthlyPayment)||calcMinPmt(item.balance,item.apr)
      : toNum(item.monthlyPayment);
    const logEntry = {
      id:generateId(), _type:item._type, debtId:item.id,
      debtName:item.name, debtColor:item.color,
      loanType:item.type||null, amount, planned, date,
    };
    const nextLogs = [...logs, logEntry];
    await saveLogs(nextLogs);

    if (item._type==="card") {
      const newBal = Math.max(0, toNum(item.balance)-amount);
      await saveCards(cards.map(c=>c.id===item.id?{...c,balance:newBal.toFixed(2)}:c));
    } else {
      const rate = toNum(item.interestRate)/100/12;
      const curBal = toNum(item.currentBalance);
      const intPortion = curBal*rate;
      const newBal = Math.max(0, curBal-Math.max(0,amount-intPortion));
      const newRemaining = Math.max(0,(toNum(item.remainingMonths)||1)-1);
      await saveLoans(loans.map(l=>l.id===item.id
        ?{...l,currentBalance:newBal.toFixed(2),remainingMonths:newRemaining.toString()}:l));
    }
  }

  async function handleImportBanner() {
    const [ccCards,ltLoans] = await Promise.all([
      storeGet(`cc_cards_${activeProfileId}`,true),
      storeGet(`lt_loans_${activeProfileId}`,true),
    ]);
    if (ccCards?.length) await saveCards(ccCards);
    if (ltLoans?.length) await saveLoans(ltLoans);
    setShowImportBanner(false);
    await storeSet(`dt_import_dismissed_${activeProfileId}`,true,true);
  }

  async function dismissImportBanner() {
    setShowImportBanner(false);
    await storeSet(`dt_import_dismissed_${activeProfileId}`,true,true);
  }

  async function handleBackupImport(data, mode) {
    if (mode==="replace") {
      if (data.cards) await saveCards(data.cards);
      if (data.loans) await saveLoans(data.loans);
      if (data.logs)  await saveLogs(data.logs);
    } else {
      if (data.cards) {
        const existing = new Set(cards.map(c=>c.id));
        await saveCards([...cards,...data.cards.filter(c=>!existing.has(c.id))]);
      }
      if (data.loans) {
        const existing = new Set(loans.map(l=>l.id));
        await saveLoans([...loans,...data.loans.filter(l=>!existing.has(l.id))]);
      }
      if (data.logs) {
        const existing = new Set(logs.map(lg=>lg.id));
        await saveLogs([...logs,...data.logs.filter(lg=>!existing.has(lg.id))]);
      }
    }
  }

  function applyStrategy(meth, extraAmt) {
    if (meth) setMethod(meth);
    if (extraAmt) {
      setExtra(extraAmt);
      storeSet(`dt_planner_extra_${activeProfileId}`,extraAmt,true);
    }
    if (meth) storeSet(`dt_planner_lump_mode_${activeProfileId}`,meth,true);
  }

  const schedule = computeUnifiedSchedule(cards, loans, method,
    { extraMonthly:toNum(extra), lumpSums:lumps, recalcMins, lumpMode });

  if (loading) return (
    <div style={{minHeight:"100vh",background:t.bg,display:"flex",alignItems:"center",
      justifyContent:"center",flexDirection:"column",gap:16,padding:20}}>
      <div style={{width:40,height:40,border:"3px solid #6366f1",borderTopColor:"transparent",
        borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
      <div style={{fontSize:14,color:t.tx2,textAlign:"center"}}>Loading DebtTracker…</div>
      <div style={{fontSize:12,color:t.tx3,textAlign:"center",maxWidth:280}}>
        If a login prompt appeared, close it — the app loads in local mode automatically.
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!activeProfile && profiles.length===0) return (
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif",color:t.tx1}}>
      <div style={{maxWidth:440,margin:"0 auto",padding:"80px 20px",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:16}}>💸</div>
        <div style={{fontWeight:800,fontSize:24,marginBottom:8}}>DebtTracker</div>
        <div style={{fontSize:14,color:t.tx2,marginBottom:32}}>
          No profile found. Create a profile in CardTracker or LoanTracker first, or use those modules to get started.
        </div>
        <div style={{...panelSt(t,{textAlign:"left",marginBottom:16})}}>
          <div style={{fontSize:13,color:t.tx2,lineHeight:1.7}}>
            DebtTracker uses the shared profile system from CardTracker. To get started:<br/>
            1. Open CardTracker and create a profile<br/>
            2. Return here — your profile will appear automatically
          </div>
        </div>
        <button onClick={()=>setDarkMode(d=>!d)} style={btnGhost(t,{margin:"0 auto"})}>
          {darkMode?"☀️ Light Mode":"🌙 Dark Mode"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif",color:t.tx1}}>
      <NavBar profiles={profiles} activeProfile={activeProfile} darkMode={darkMode}
        setDarkMode={setDarkMode} apiKey={apiKey} onOpenApiKey={()=>setShowApiKey(true)}
        onOpenBackup={()=>setShowBackup(true)} onSwitchProfile={switchProfile}
        itemCount={cards.length+loans.length} t={t} />

      <div style={{maxWidth:960,margin:"0 auto",padding:"20px 16px"}}>
        {showImportBanner && (
          <ImportBanner onImport={handleImportBanner} onDismiss={dismissImportBanner} t={t} />
        )}

        <PortfolioSummary cards={cards} loans={loans} schedule={schedule} t={t} />

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontWeight:800,fontSize:18,color:t.tx1}}>Your Debts</div>
            <button onClick={()=>setInterleave(i=>!i)} style={{...btnGhost(t,{padding:"5px 10px",fontSize:11})}}>
              {interleave?"Group by Type":"Sort by APR"}
            </button>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowPlanner(true)} style={{...btnPrimary({padding:"9px 16px",fontSize:13,
              background:COLOR.purple})}}>
              📊 Open Planner
            </button>
            <button onClick={()=>{setEditCard(null);setEditLoan(null);setShowAddDebt(true);}}
              style={btnPrimary({padding:"9px 16px",fontSize:13})}>
              + Add Debt
            </button>
          </div>
        </div>

        {cards.length===0 && loans.length===0 ? (
          <div style={{...panelSt(t,{textAlign:"center",padding:"60px 20px"})}}>
            <div style={{fontSize:48,marginBottom:16}}>💸</div>
            <div style={{fontWeight:700,fontSize:18,color:t.tx1,marginBottom:8}}>No debts added yet</div>
            <div style={{fontSize:14,color:t.tx2,marginBottom:24}}>
              Add your credit cards and loans to start tracking and planning your payoff.
            </div>
            <button onClick={()=>setShowAddDebt(true)} style={btnPrimary({padding:"12px 32px",fontSize:15})}>
              + Add First Debt
            </button>
          </div>
        ) : (
          <DebtList cards={cards} loans={loans} interleave={interleave}
            onPay={setQuickPayItem} onEdit={handleEdit} onDelete={handleDelete}
            schedule={schedule} t={t} darkMode={darkMode} />
        )}
      </div>

      <PlannerModal open={showPlanner} onClose={()=>setShowPlanner(false)}
        cards={cards} loans={loans} logs={logs}
        method={method} setMethod={setMethod}
        extra={extra} setExtra={setExtra}
        lumps={lumps} setLumps={setLumps}
        lumpMode={lumpMode} setLumpMode={setLumpMode}
        recalcMins={recalcMins} setRecalcMins={setRecalcMins}
        profileId={activeProfileId} apiKey={apiKey}
        aiResults={aiResults} onSaveAiResults={saveAiResults}
        onSavePlanner={savePlanner} onApplyStrategy={applyStrategy}
        t={t} darkMode={darkMode} />

      <AddDebtModal open={showAddDebt} onClose={()=>{setShowAddDebt(false);setEditCard(null);setEditLoan(null);}}
        editCard={editCard} editLoan={editLoan}
        onSaveCard={handleSaveCard} onSaveLoan={handleSaveLoan} t={t} />

      <QuickPayModal open={!!quickPayItem} onClose={()=>setQuickPayItem(null)}
        item={quickPayItem} onConfirm={handleQuickPay} t={t} />

      <ConfirmDeleteModal open={!!deleteTarget} onClose={()=>setDeleteTarget(null)}
        onConfirm={confirmDelete} itemName={deleteTarget?.item?.name} t={t} />

      <ApiKeyModal open={showApiKey} onClose={()=>setShowApiKey(false)}
        apiKey={apiKey} onSave={saveApiKey} t={t} />

      <BackupModal open={showBackup} onClose={()=>setShowBackup(false)}
        cards={cards} loans={loans} logs={logs}
        profileId={activeProfileId} onImport={handleBackupImport} t={t} />
    </div>
  );
}
