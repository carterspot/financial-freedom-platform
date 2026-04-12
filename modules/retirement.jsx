// RetirementModule v1.1
import { useState, useEffect, useRef } from "react";

// --- Constants ----------------------------------------------------------------
const AVATAR_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];
const COLOR = {
  primary:"#6366f1", success:"#10b981", warning:"#f59e0b", danger:"#ef4444",
  pink:"#ec4899",    blue:"#3b82f6",    orange:"#f97316",  purple:"#8b5cf6", teal:"#06b6d4",
};
const ACCENT = "#f59e0b";

const ACCOUNT_TYPES = [
  { id:"401k",           label:"401(k)",         group:"deferred", emoji:"🏢" },
  { id:"roth401k",       label:"Roth 401(k)",    group:"free",     emoji:"🏢" },
  { id:"403b",           label:"403(b)",          group:"deferred", emoji:"🏫" },
  { id:"traditionalira", label:"Traditional IRA", group:"deferred", emoji:"📋" },
  { id:"rothira",        label:"Roth IRA",        group:"free",     emoji:"💎" },
  { id:"hsa",            label:"HSA",             group:"other",    emoji:"🏥" },
  { id:"pension",        label:"Pension",         group:"other",    emoji:"🏛" },
  { id:"socialsecurity", label:"Social Security", group:"other",    emoji:"🇺🇸" },
];

const PLANS = [
  { id:"4pct",   label:"4% Rule",   rate:4.0, desc:"Classic safe withdrawal rate. Proven to last 30 years in most market conditions." },
  { id:"3pct",   label:"3.3% Rule", rate:3.3, desc:"Conservative choice for retirements of 35+ years or early retirees." },
  { id:"5pct",   label:"5% Rule",   rate:5.0, desc:"Aggressive — best for shorter retirements or higher risk tolerance." },
  { id:"custom", label:"Custom %",  rate:null, desc:"Set your own withdrawal rate." },
];

const GROUP_LABELS = { deferred:"Tax-Deferred", free:"Tax-Free", other:"Other" };

// --- Helpers ------------------------------------------------------------------
const generateId  = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const fmt$        = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n||0);
const toNum       = (s) => parseFloat(s)||0;
const getInitials = (n) => !n?"?":n.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
const typeLabel   = (id) => ACCOUNT_TYPES.find(a=>a.id===id)?.label||id;
const typeEmoji   = (id) => ACCOUNT_TYPES.find(a=>a.id===id)?.emoji||"💼";
const typeGroup   = (id) => ACCOUNT_TYPES.find(a=>a.id===id)?.group||"other";
const fmtK        = (v) => v>=1000000?`$${(v/1000000).toFixed(1)}M`:v>=1000?`$${(v/1000).toFixed(0)}K`:`$${Math.round(v)}`;

// --- Projection math ----------------------------------------------------------
function projectBalance(accounts, retProfile, assumptions) {
  const currentAge    = toNum(retProfile.currentAge);
  const retirementAge = toNum(retProfile.retirementAge)||65;
  const annualSalary  = toNum(retProfile.annualSalary);
  const returnRate    = toNum(assumptions.returnRate);
  const salaryGrowth  = toNum(assumptions.salaryGrowthRate);
  const years         = Math.max(0, retirementAge - currentAge);
  const r = returnRate / 100;
  const g = salaryGrowth / 100;

  const investable = accounts.filter(a => !["pension","socialsecurity"].includes(a.type));
  let balance = investable.reduce((s,a) => s+toNum(a.currentBalance), 0);
  const yearlyData = [{ age:currentAge, balance }];

  for (let y = 1; y <= years; y++) {
    let annualContrib = 0;
    const salary = annualSalary * Math.pow(1+g, y);
    investable.forEach(a => {
      const rate = toNum(a.contribRate);
      if (a.contribType === "percent") {
        annualContrib += (rate/100)*salary;
        const matchLimit = toNum(a.employerMatchLimit);
        const matchRate  = toNum(a.employerMatch);
        const effectiveContrib = Math.min(rate, matchLimit);
        annualContrib += (matchRate/100)*(effectiveContrib/100)*salary;
      } else {
        annualContrib += rate;
      }
    });
    balance = balance*(1+r) + annualContrib;
    yearlyData.push({ age:currentAge+y, balance });
  }
  return yearlyData;
}

function calcMonthlySSIncome(accounts) {
  let monthly = 0;
  accounts.forEach(a => {
    if (a.type==="socialsecurity") monthly += toNum(a.estimatedMonthlyBenefit);
    if (a.type==="pension")        monthly += toNum(a.monthlyBenefit);
  });
  return monthly;
}

function calcRequiredNestEgg(targetMonthlyIncome, monthlySSIncome, withdrawalRate) {
  const annualFromNestEgg = (toNum(targetMonthlyIncome)-monthlySSIncome)*12;
  return Math.max(0, annualFromNestEgg / ((withdrawalRate||4)/100));
}

function describeArc(cx, cy, r, pct) {
  if (pct <= 0) return "";
  if (pct >= 100) return `M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`;
  const angle = Math.PI - (pct/100)*Math.PI;
  const endX = cx + r*Math.cos(angle);
  const endY = cy - r*Math.sin(angle);
  return `M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`;
}

// --- Theme --------------------------------------------------------------------
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

// --- useBreakpoint ------------------------------------------------------------
function useBreakpoint() {
  const [w, setW] = useState(960);
  useEffect(() => {
    const fn = () => setW(typeof window !== "undefined" ? window.innerWidth : 960);
    fn();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile:w<640, isTablet:w<960, isDesktop:w>=960 };
}

// --- Storage ------------------------------------------------------------------
let _cloudAvailable = null;
async function probeCloudStorage() {
  if (_cloudAvailable !== null) return _cloudAvailable;
  if (!window?.storage?.get) { _cloudAvailable = false; return false; }
  try {
    await Promise.race([
      window.storage.get("__probe__", false),
      new Promise((_,r) => setTimeout(()=>r(new Error("timeout")),2500))
    ]);
    _cloudAvailable = true;
  } catch { _cloudAvailable = false; }
  return _cloudAvailable;
}
async function storeGet(key, shared=false) {
  if (await probeCloudStorage()) {
    try { const r = await window.storage.get(key,shared); return r?JSON.parse(r.value):null; }
    catch { _cloudAvailable = false; }
  }
  try { const v = localStorage.getItem(key); return v?JSON.parse(v):null; } catch { return null; }
}
async function storeSet(key, value, shared=false) {
  if (await probeCloudStorage()) {
    try { await window.storage.set(key,JSON.stringify(value),shared); return; }
    catch { _cloudAvailable = false; }
  }
  try { localStorage.setItem(key,JSON.stringify(value)); } catch {}
}
const hasCloudStorage = () => _cloudAvailable === true;

// --- Style helpers ------------------------------------------------------------
function inputStyle(t) {
  return { width:"100%", background:t.surf, border:`1px solid ${t.border}`,
    borderRadius:8, padding:"8px 12px", color:t.tx1, fontSize:13,
    boxSizing:"border-box", outline:"none" };
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
    padding:"7px 16px", cursor:"pointer", fontWeight:600, fontSize:13,
    transition:"all .15s", whiteSpace:"nowrap" };
}
function panelSt(t, extra={}) {
  return { background:t.panelBg, border:`1px solid ${t.border}`, borderRadius:16,
    padding:"16px 20px", ...extra };
}
function overlayContainer(t, maxW=440) {
  return {
    overlay:{ position:"fixed", inset:0, background:"rgba(0,0,0,.72)", zIndex:2000,
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:16, overflowY:"auto" },
    box:{ background:t.panelBg, borderRadius:20, width:"100%", maxWidth:maxW,
      padding:24, boxShadow:"0 20px 60px rgba(0,0,0,.5)", maxHeight:"90vh", overflowY:"auto" },
  };
}

// --- InfoTooltip --------------------------------------------------------------
function InfoTooltip({ text, t }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{position:"relative",display:"inline-block",verticalAlign:"middle"}}>
      <span onClick={()=>setShow(s=>!s)}
        style={{fontSize:10,color:t.tx3,cursor:"pointer",marginLeft:4,
          background:t.surf,borderRadius:"50%",width:15,height:15,
          display:"inline-flex",alignItems:"center",justifyContent:"center",
          border:`1px solid ${t.border}`,fontWeight:700}}>
        i
      </span>
      {show && (
        <div onClick={()=>setShow(false)}
          style={{position:"absolute",left:"50%",bottom:"calc(100% + 6px)",
            transform:"translateX(-50%)",background:t.panelBg,
            border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 10px",
            fontSize:11,color:t.tx2,width:200,zIndex:500,
            boxShadow:"0 4px 16px rgba(0,0,0,.2)",lineHeight:1.5,whiteSpace:"normal"}}>
          {text}
        </div>
      )}
    </span>
  );
}

// --- ConfirmModal -------------------------------------------------------------
function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel, danger, t }) {
  if (!open) return null;
  const s = overlayContainer(t, 380);
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:800,fontSize:17,color:t.tx1,marginBottom:12}}>
          {title||"Confirm"}
        </div>
        <div style={{fontSize:14,color:t.tx2,marginBottom:24,lineHeight:1.6}}>{message}</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
          <button onClick={()=>{onConfirm();onClose();}}
            style={{flex:1,background:danger?COLOR.danger:COLOR.primary,border:"none",
              borderRadius:10,padding:"9px 20px",color:"#fff",cursor:"pointer",
              fontWeight:700,fontSize:14}}>
            {confirmLabel||"Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- ProfileModal -------------------------------------------------------------
function ProfileModal({ open, onClose, editProfile, onSave, t }) {
  const [name,        setName]        = useState("");
  const [pin,         setPin]         = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

  useEffect(()=>{
    if (open) {
      setName(editProfile?.name||"");
      setPin(editProfile?.pin||"");
      setAvatarColor(editProfile?.avatarColor||AVATAR_COLORS[0]);
    }
  },[open,editProfile]);

  if (!open) return null;
  const s = overlayContainer(t, 440);

  function handleSave() {
    if (!name.trim()) return;
    const profile = editProfile
      ? { ...editProfile, name:name.trim(), avatarColor, pin:pin.trim() }
      : { id:pin.trim()?"pin_"+pin.trim().toLowerCase().replace(/\s+/g,"_"):generateId(),
          name:name.trim(), avatarColor, pin:pin.trim(), createdAt:new Date().toISOString() };
    onSave(profile);
    onClose();
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>
            {editProfile?"Edit Profile":"Add New Profile"}
          </span>
          <button onClick={onClose}
            style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>
            x
          </button>
        </div>
        <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:avatarColor,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:22,fontWeight:800,color:"#fff",boxShadow:`0 0 0 4px ${avatarColor}44`}}>
            {getInitials(name)||"?"}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={labelSt(t)}>Display Name *</label>
            <input value={name} onChange={e=>setName(e.target.value)}
              placeholder="Your Name" style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>
              Recovery PIN <span style={{color:t.tx3,fontWeight:400}}>(optional)</span>
            </label>
            <input value={pin} onChange={e=>setPin(e.target.value)}
              placeholder="e.g. smithfamily" style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>Avatar Color</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {AVATAR_COLORS.map(c=>(
                <div key={c} onClick={()=>setAvatarColor(c)}
                  style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",
                    border:avatarColor===c?"3px solid #fff":"2px solid transparent",
                    boxShadow:avatarColor===c?`0 0 0 2px ${c}`:"none"}} />
              ))}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()}
            style={{...btnPrimary({flex:1,
              background:name.trim()?avatarColor:t.surf,
              color:name.trim()?"#fff":t.tx3,
              cursor:name.trim()?"pointer":"default"})}}>
            {editProfile?"Save Changes":"Create Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- ApiKeyModal --------------------------------------------------------------
function ApiKeyModal({ open, onClose, apiKey, onSave, t }) {
  const [val,  setVal]  = useState(apiKey||"");
  const [show, setShow] = useState(false);
  useEffect(()=>{ if (open) setVal(apiKey||""); },[open,apiKey]);
  if (!open) return null;
  const s = overlayContainer(t, 460);
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>🔑 Anthropic API Key</span>
          <button onClick={onClose}
            style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>
            x
          </button>
        </div>
        <div style={{fontSize:12,color:t.tx2,marginBottom:16,lineHeight:1.6}}>
          Your API key is stored in your profile and never sent anywhere except Anthropic's API.
          Get one at <span style={{color:COLOR.primary}}>console.anthropic.com</span>.
        </div>
        <label style={labelSt(t)}>API Key</label>
        <div style={{display:"flex",gap:8}}>
          <input type={show?"text":"password"} value={val}
            onChange={e=>setVal(e.target.value)}
            placeholder="sk-ant-..."
            style={{...inputStyle(t),flex:1}} />
          <button onClick={()=>setShow(s=>!s)}
            style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,
              padding:"9px 12px",color:t.tx2,cursor:"pointer",fontSize:12}}>
            {show?"Hide":"Show"}
          </button>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
          <button onClick={()=>onSave(val)} style={{...btnPrimary({flex:1})}}>Save Key</button>
        </div>
        {apiKey && (
          <button onClick={()=>onSave("")}
            style={{width:"100%",marginTop:8,background:"none",
              border:`1px solid ${COLOR.danger}33`,borderRadius:8,padding:"7px",
              color:COLOR.danger,cursor:"pointer",fontSize:12}}>
            Remove Key
          </button>
        )}
      </div>
    </div>
  );
}

// --- FirstRunSetup ------------------------------------------------------------
function FirstRunSetup({ darkMode, setDarkMode, onSave }) {
  const [name,        setName]        = useState("");
  const [pin,         setPin]         = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [saving,      setSaving]      = useState(false);
  const t = useTheme(darkMode);

  async function handleCreate() {
    if (!name.trim()||saving) return;
    setSaving(true);
    const stableId = pin.trim()
      ? "pin_"+pin.trim().toLowerCase().replace(/\s+/g,"_")
      : generateId();
    const profile = { id:stableId, name:name.trim(), avatarColor,
      pin:pin.trim(), createdAt:new Date().toISOString() };
    await onSave(profile);
    setSaving(false);
  }

  return (
    <div style={{minHeight:"100vh",background:t.bg,
      fontFamily:"'DM Sans','Segoe UI',sans-serif",color:t.tx1,
      display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",padding:"40px 16px"}}>
      <div style={{width:"100%",maxWidth:440}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:52,marginBottom:12}}>📈</div>
          <div style={{fontWeight:800,fontSize:26,color:t.tx1,marginBottom:8}}>
            Welcome to Retirement Planner
          </div>
          <div style={{fontSize:14,color:t.tx2,lineHeight:1.6,maxWidth:340,margin:"0 auto"}}>
            Track your retirement accounts, project your balance, and find out
            if you're on track to retire when you want.
          </div>
        </div>
        <div style={{background:t.panelBg,border:`1px solid ${t.border}`,
          borderRadius:20,padding:24,boxShadow:"0 8px 32px rgba(0,0,0,.12)"}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
            <div style={{width:64,height:64,borderRadius:"50%",background:avatarColor,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:22,fontWeight:800,color:"#fff",
              boxShadow:`0 0 0 4px ${avatarColor}44`}}>
              {getInitials(name)||"?"}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <label style={labelSt(t)}>
                Display Name <span style={{color:COLOR.danger}}>*</span>
              </label>
              <input style={inputStyle(t)} value={name}
                onChange={e=>setName(e.target.value)} placeholder="Your Name" />
            </div>
            <div>
              <label style={labelSt(t)}>
                Recovery PIN <span style={{color:t.tx3,fontWeight:400}}>(optional)</span>
              </label>
              <input style={inputStyle(t)} value={pin}
                onChange={e=>setPin(e.target.value)} placeholder="e.g. smithfamily" />
            </div>
            <div>
              <label style={labelSt(t)}>Avatar Color</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {AVATAR_COLORS.map(c=>(
                  <div key={c} onClick={()=>setAvatarColor(c)}
                    style={{width:28,height:28,borderRadius:"50%",background:c,
                      cursor:"pointer",
                      border:avatarColor===c?"3px solid #fff":"2px solid transparent",
                      boxShadow:avatarColor===c?`0 0 0 2px ${c}`:"none"}} />
                ))}
              </div>
            </div>
            <button onClick={handleCreate} disabled={!name.trim()||saving}
              style={{background:name.trim()?avatarColor:t.surf,border:"none",
                borderRadius:10,padding:"12px 0",
                color:name.trim()?"#fff":t.tx3,width:"100%",
                cursor:name.trim()?"pointer":"default",fontWeight:700,fontSize:15}}>
              {saving?"Creating…":"Create Profile & Continue"}
            </button>
          </div>
        </div>
        <div style={{textAlign:"center",marginTop:20}}>
          <button onClick={()=>setDarkMode(d=>!d)}
            style={btnGhost(t,{fontSize:12,padding:"6px 14px"})}>
            {darkMode?"☀️ Light Mode":"🌙 Dark Mode"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- OnTrackGauge -------------------------------------------------------------
function OnTrackGauge({ projectedBalance, requiredNestEggVal, t }) {
  const pct = requiredNestEggVal > 0 ? (projectedBalance/requiredNestEggVal)*100 : 0;
  const displayPct = Math.min(100, pct);
  const color = pct >= 100 ? COLOR.success : pct >= 75 ? COLOR.warning : COLOR.danger;
  const statusLabel = pct >= 100 ? "On Track" : pct >= 75 ? "Close" : "Behind";
  const CX = 100, CY = 100, R = 78;

  return (
    <div style={{textAlign:"center"}}>
      <svg viewBox="0 0 200 115" style={{width:"100%",maxWidth:220,height:"auto",display:"block",margin:"0 auto"}}>
        <path d={`M ${CX-R} ${CY} A ${R} ${R} 0 0 1 ${CX+R} ${CY}`}
          fill="none" stroke={t.border2} strokeWidth="14" strokeLinecap="round" />
        {displayPct > 0 && (
          <path d={describeArc(CX, CY, R, displayPct)}
            fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
        )}
        <text x={CX} y={CY-18} textAnchor="middle" fontSize="22" fontWeight="800" fill={color}
          fontFamily="monospace">
          {pct.toFixed(0)}%
        </text>
        <text x={CX} y={CY+2} textAnchor="middle" fontSize="12" fontWeight="700" fill={color}>
          {statusLabel}
        </text>
      </svg>
    </div>
  );
}

// --- AccountCard --------------------------------------------------------------
function AccountCard({ account, onEdit, onDelete, t }) {
  const isInvestable = !["pension","socialsecurity"].includes(account.type);
  const hasMatch     = ["401k","roth401k","403b"].includes(account.type);
  const isSS         = account.type === "socialsecurity";
  const isPension    = account.type === "pension";

  return (
    <div style={{...panelSt(t,{marginBottom:12,
      borderLeft:`4px solid ${account.color||COLOR.primary}`,
      borderTopLeftRadius:4,borderBottomLeftRadius:4})}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
            <span style={{fontSize:18}}>{typeEmoji(account.type)}</span>
            <span style={{fontWeight:700,fontSize:14,color:t.tx1}}>{account.name}</span>
            <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,
              background:(account.color||COLOR.primary)+"22",
              color:account.color||COLOR.primary}}>
              {typeLabel(account.type)}
            </span>
          </div>
          <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
            {isInvestable && (
              <div>
                <div style={{fontSize:10,color:t.tx3,fontWeight:600,marginBottom:2}}>BALANCE</div>
                <div style={{fontFamily:"monospace",fontWeight:800,fontSize:16,color:t.tx1}}>
                  {fmt$(toNum(account.currentBalance))}
                </div>
              </div>
            )}
            {isInvestable && account.contribRate && (
              <div>
                <div style={{fontSize:10,color:t.tx3,fontWeight:600,marginBottom:2}}>CONTRIBUTION</div>
                <div style={{fontFamily:"monospace",fontWeight:700,fontSize:14,color:COLOR.success}}>
                  {account.contribType==="percent"
                    ? `${account.contribRate}% of salary`
                    : fmt$(toNum(account.contribRate))+"/yr"}
                </div>
              </div>
            )}
            {hasMatch && account.employerMatch && (
              <div>
                <div style={{fontSize:10,color:t.tx3,fontWeight:600,marginBottom:2}}>EMPLOYER MATCH</div>
                <div style={{fontFamily:"monospace",fontWeight:700,fontSize:13,color:COLOR.teal}}>
                  {account.employerMatch}% up to {account.employerMatchLimit||"?"}%
                </div>
              </div>
            )}
            {isPension && (
              <div>
                <div style={{fontSize:10,color:t.tx3,fontWeight:600,marginBottom:2}}>MONTHLY BENEFIT</div>
                <div style={{fontFamily:"monospace",fontWeight:800,fontSize:16,color:ACCENT}}>
                  {fmt$(toNum(account.monthlyBenefit))}/mo
                </div>
              </div>
            )}
            {isSS && (
              <>
                <div>
                  <div style={{fontSize:10,color:t.tx3,fontWeight:600,marginBottom:2}}>MONTHLY BENEFIT</div>
                  <div style={{fontFamily:"monospace",fontWeight:800,fontSize:16,color:ACCENT}}>
                    {fmt$(toNum(account.estimatedMonthlyBenefit))}/mo
                  </div>
                </div>
                <div>
                  <div style={{fontSize:10,color:t.tx3,fontWeight:600,marginBottom:2}}>CLAIM AGE</div>
                  <div style={{fontFamily:"monospace",fontWeight:700,fontSize:14,color:t.tx2}}>
                    Age {account.ssBenefitAge||"67"}
                  </div>
                </div>
              </>
            )}
          </div>
          {account.notes && (
            <div style={{fontSize:12,color:t.tx3,marginTop:6}}>{account.notes}</div>
          )}
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          <button onClick={()=>onEdit(account)}
            style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,
              padding:"6px 12px",color:t.tx2,cursor:"pointer",fontSize:12}}>
            Edit
          </button>
          <button onClick={()=>onDelete(account)}
            style={{background:"none",border:`1px solid ${COLOR.danger}33`,borderRadius:8,
              padding:"6px 12px",color:COLOR.danger,cursor:"pointer",fontSize:12}}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// --- AddAccountModal ----------------------------------------------------------
function AddAccountModal({ open, onClose, editAccount, onSave, t }) {
  const [type,               setType]               = useState("401k");
  const [name,               setName]               = useState("");
  const [color,              setColor]              = useState(AVATAR_COLORS[0]);
  const [currentBalance,     setCurrentBalance]     = useState("");
  const [notes,              setNotes]              = useState("");
  const [contribType,        setContribType]        = useState("percent");
  const [contribRate,        setContribRate]        = useState("");
  const [employerMatch,      setEmployerMatch]      = useState("");
  const [employerMatchLimit, setEmployerMatchLimit] = useState("");
  const [monthlyBenefit,     setMonthlyBenefit]     = useState("");
  const [estMonthlyBenefit,  setEstMonthlyBenefit]  = useState("");
  const [ssBenefitAge,       setSsBenefitAge]       = useState("67");

  useEffect(()=>{
    if (open) {
      const a = editAccount;
      setType(a?.type||"401k");
      setName(a?.name||"");
      setColor(a?.color||AVATAR_COLORS[0]);
      setCurrentBalance(a?.currentBalance||"");
      setNotes(a?.notes||"");
      setContribType(a?.contribType||"percent");
      setContribRate(a?.contribRate||"");
      setEmployerMatch(a?.employerMatch||"");
      setEmployerMatchLimit(a?.employerMatchLimit||"");
      setMonthlyBenefit(a?.monthlyBenefit||"");
      setEstMonthlyBenefit(a?.estimatedMonthlyBenefit||"");
      setSsBenefitAge(a?.ssBenefitAge||"67");
    }
  },[open,editAccount]);

  if (!open) return null;
  const s = overlayContainer(t, 520);
  const isWorkplace  = ["401k","roth401k","403b"].includes(type);
  const isIra        = ["traditionalira","rothira"].includes(type);
  const isHsa        = type === "hsa";
  const isPension    = type === "pension";
  const isSS         = type === "socialsecurity";
  const isInvestable = !isPension && !isSS;

  function handleSave() {
    onSave({
      id:editAccount?.id||generateId(),
      type, name:name.trim()||typeLabel(type),
      color, currentBalance, notes,
      contribType:isWorkplace?contribType:"fixed",
      contribRate, employerMatch, employerMatchLimit,
      monthlyBenefit,
      estimatedMonthlyBenefit:estMonthlyBenefit,
      ssBenefitAge,
    });
    onClose();
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>
            {editAccount?"Edit Account":"Add Account"}
          </span>
          <button onClick={onClose}
            style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>
            x
          </button>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={labelSt(t)}>Account Type</label>
            <select value={type} onChange={e=>setType(e.target.value)}
              style={{...inputStyle(t),cursor:"pointer"}}>
              {ACCOUNT_TYPES.map(at=>(
                <option key={at.id} value={at.id}>{at.emoji} {at.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelSt(t)}>Account Name</label>
            <input value={name} onChange={e=>setName(e.target.value)}
              placeholder={typeLabel(type)} style={inputStyle(t)} />
          </div>

          {isInvestable && (
            <div>
              <label style={labelSt(t)}>Current Balance ($)</label>
              <input type="number" value={currentBalance}
                onChange={e=>setCurrentBalance(e.target.value)}
                placeholder="0" style={inputStyle(t)} />
            </div>
          )}

          {isWorkplace && (
            <>
              <div>
                <label style={labelSt(t)}>Contribution Type</label>
                <div style={{display:"flex",gap:8}}>
                  {[{id:"percent",label:"% of Salary"},{id:"fixed",label:"Annual $"}].map(ct=>(
                    <button key={ct.id} onClick={()=>setContribType(ct.id)}
                      style={{...tabBtn(contribType===ct.id,t),flex:1}}>
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelSt(t)}>
                  {contribType==="percent"?"Your Contribution (% of salary)":"Annual Contribution ($)"}
                </label>
                <input type="number" value={contribRate}
                  onChange={e=>setContribRate(e.target.value)}
                  placeholder={contribType==="percent"?"6":"5000"} style={inputStyle(t)} />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={labelSt(t)}>Employer Match (%)</label>
                  <input type="number" value={employerMatch}
                    onChange={e=>setEmployerMatch(e.target.value)}
                    placeholder="50" style={inputStyle(t)} />
                </div>
                <div>
                  <label style={labelSt(t)}>Match Limit (% of salary)</label>
                  <input type="number" value={employerMatchLimit}
                    onChange={e=>setEmployerMatchLimit(e.target.value)}
                    placeholder="6" style={inputStyle(t)} />
                </div>
              </div>
            </>
          )}

          {(isIra||isHsa) && (
            <div>
              <label style={labelSt(t)}>
                Annual Contribution ($)
                {isIra && <span style={{fontSize:10,color:t.tx3,fontWeight:400}}> (max $7,000 for 2026)</span>}
              </label>
              <input type="number" value={contribRate}
                onChange={e=>setContribRate(e.target.value)}
                placeholder="7000" style={inputStyle(t)} />
              {isHsa && (
                <div style={{fontSize:11,color:t.tx3,marginTop:4}}>
                  HSA funds can be used tax-free for medical expenses in retirement.
                </div>
              )}
            </div>
          )}

          {isPension && (
            <div>
              <label style={labelSt(t)}>Estimated Monthly Benefit at Retirement ($)</label>
              <input type="number" value={monthlyBenefit}
                onChange={e=>setMonthlyBenefit(e.target.value)}
                placeholder="2000" style={inputStyle(t)} />
            </div>
          )}

          {isSS && (
            <>
              <div>
                <label style={labelSt(t)}>Estimated Monthly Benefit ($)</label>
                <input type="number" value={estMonthlyBenefit}
                  onChange={e=>setEstMonthlyBenefit(e.target.value)}
                  placeholder="2000" style={inputStyle(t)} />
                <div style={{fontSize:11,color:t.tx3,marginTop:4}}>
                  Get your estimate at ssa.gov/estimator
                </div>
              </div>
              <div>
                <label style={labelSt(t)}>Claim Age</label>
                <div style={{display:"flex",gap:8}}>
                  {["62","67","70"].map(age=>(
                    <button key={age} onClick={()=>setSsBenefitAge(age)}
                      style={{...tabBtn(ssBenefitAge===age,t),flex:1}}>
                      {age}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <label style={labelSt(t)}>Color</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {AVATAR_COLORS.map(c=>(
                <div key={c} onClick={()=>setColor(c)}
                  style={{width:24,height:24,borderRadius:"50%",background:c,cursor:"pointer",
                    border:color===c?"3px solid #fff":"2px solid transparent",
                    boxShadow:color===c?`0 0 0 2px ${c}`:"none"}} />
              ))}
            </div>
          </div>

          <div>
            <label style={labelSt(t)}>
              Notes <span style={{fontWeight:400,color:t.tx3}}>(optional)</span>
            </label>
            <input value={notes} onChange={e=>setNotes(e.target.value)}
              placeholder="e.g. Company match vests in 3 years" style={inputStyle(t)} />
          </div>
        </div>

        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
          <button onClick={handleSave} style={{...btnPrimary({flex:1})}}>
            {editAccount?"Save Changes":"Add Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- AssumptionsPanel ---------------------------------------------------------
function AssumptionsPanel({ assumptions, setAssumptions, retProfile, setRetProfile, t }) {
  const SLIDERS = [
    { key:"returnRate",      label:"Expected Annual Return", min:1,  max:15, step:0.5, unit:"%",
      desc:"Historical US stock market average (S&P 500 ~10%, inflation-adjusted ~7%)" },
    { key:"inflationRate",   label:"Inflation Rate",         min:0,  max:8,  step:0.5, unit:"%",
      desc:"Long-term US average (Federal Reserve target 2%, historical ~3%)" },
    { key:"salaryGrowthRate",label:"Salary Growth Rate",     min:0,  max:10, step:0.5, unit:"%",
      desc:"Average annual raises including promotions" },
  ];

  return (
    <div style={panelSt(t,{marginBottom:20})}>
      <div style={{fontWeight:700,fontSize:15,color:t.tx1,marginBottom:16}}>
        Settings & Assumptions
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:20}}>
        <div>
          <label style={labelSt(t)}>Current Age *</label>
          <input type="number" value={retProfile.currentAge}
            onChange={e=>setRetProfile(p=>({...p,currentAge:e.target.value}))}
            placeholder="35" min="18" max="80" style={inputStyle(t)} />
        </div>
        <div>
          <label style={labelSt(t)}>Target Retirement Age</label>
          <input type="number" value={retProfile.retirementAge}
            onChange={e=>setRetProfile(p=>({...p,retirementAge:e.target.value}))}
            placeholder="65" min="50" max="80" style={inputStyle(t)} />
        </div>
        <div>
          <label style={labelSt(t)}>Annual Salary ($)</label>
          <input type="number" value={retProfile.annualSalary}
            onChange={e=>setRetProfile(p=>({...p,annualSalary:e.target.value}))}
            placeholder="80000" style={inputStyle(t)} />
        </div>
        <div>
          <label style={labelSt(t)}>
            Target Monthly Income in Retirement
            <InfoTooltip text="How much you want to spend each month in retirement, in today's dollars." t={t} />
          </label>
          <input type="number" value={retProfile.targetMonthlyIncome}
            onChange={e=>setRetProfile(p=>({...p,targetMonthlyIncome:e.target.value}))}
            placeholder="5000" style={inputStyle(t)} />
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {SLIDERS.map(s=>(
          <div key={s.key}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <label style={{...labelSt(t),marginBottom:0}}>{s.label}</label>
              <span style={{fontFamily:"monospace",fontWeight:800,fontSize:13,color:ACCENT}}>
                {toNum(assumptions[s.key]).toFixed(s.step<1?1:0)}{s.unit}
              </span>
            </div>
            <input type="range" min={s.min} max={s.max} step={s.step}
              value={assumptions[s.key]}
              onChange={e=>setAssumptions(a=>({...a,[s.key]:parseFloat(e.target.value)}))}
              style={{width:"100%",accentColor:ACCENT}} />
            <div style={{fontSize:11,color:t.tx3,marginTop:2}}>{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- ProjectionChart ----------------------------------------------------------
function ProjectionChart({ yearlyData, lockedPlanRate, retProfile, monthlySSIncome, t }) {
  const [hoveredAge, setHoveredAge] = useState(null);

  if (!yearlyData || yearlyData.length < 2) {
    return (
      <div style={panelSt(t,{textAlign:"center",padding:"40px 20px",marginBottom:20})}>
        <div style={{fontSize:14,color:t.tx2}}>
          Add at least one account and set your current age to see the projection chart.
        </div>
      </div>
    );
  }

  const W = 560, H = 260;
  const PAD = { top:24, right:36, bottom:36, left:72 };
  const cW = W-PAD.left-PAD.right;
  const cH = H-PAD.top-PAD.bottom;

  const nestEgg = lockedPlanRate && retProfile.targetMonthlyIncome
    ? calcRequiredNestEgg(retProfile.targetMonthlyIncome, monthlySSIncome, lockedPlanRate)
    : 0;

  const maxBal = Math.max(...yearlyData.map(d=>d.balance), nestEgg);
  const yMax = maxBal*1.1||1;
  const minAge = yearlyData[0].age;
  const maxAge = yearlyData[yearlyData.length-1].age;
  const ageRange = Math.max(1, maxAge-minAge);

  const xS = (age) => PAD.left + ((age-minAge)/ageRange)*cW;
  const yS = (val) => PAD.top + cH - (val/yMax)*cH;

  const balPath = yearlyData.map((d,i)=>
    `${i===0?"M":"L"} ${xS(d.age).toFixed(1)} ${yS(d.balance).toFixed(1)}`
  ).join(" ");

  const areaPath = balPath
    + ` L ${xS(maxAge).toFixed(1)} ${yS(0).toFixed(1)}`
    + ` L ${xS(minAge).toFixed(1)} ${yS(0).toFixed(1)} Z`;

  const nestEggY = nestEgg > 0 ? yS(nestEgg) : null;

  const yTicks = [0,0.25,0.5,0.75,1].map(p=>({v:p*yMax,y:yS(p*yMax)}));
  const xTickStep = ageRange>20?10:ageRange>10?5:2;
  const xTicks = yearlyData.filter(d=>(d.age-minAge)%xTickStep===0);
  const hovered = hoveredAge!==null ? yearlyData.find(d=>d.age===hoveredAge)||null : null;

  function handleSvgMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = (e.clientX-rect.left)/rect.width*W;
    const ageF = minAge + (svgX-PAD.left)/cW*ageRange;
    const closest = Math.round(Math.max(minAge, Math.min(maxAge, ageF)));
    setHoveredAge(closest);
  }

  return (
    <div style={panelSt(t,{marginBottom:20})}>
      <div style={{fontWeight:700,fontSize:15,color:t.tx1,marginBottom:12}}>
        Balance Projection
      </div>
      <svg viewBox={`0 0 ${W} ${H}`}
        style={{width:"100%",height:"auto",display:"block",cursor:"crosshair"}}
        onMouseMove={handleSvgMouseMove}
        onMouseLeave={()=>setHoveredAge(null)}>

        {yTicks.map((tick,i)=>(
          <g key={i}>
            <line x1={PAD.left} y1={tick.y} x2={W-PAD.right} y2={tick.y}
              stroke={t.border} strokeWidth="1" strokeDasharray="4,4" />
            <text x={PAD.left-6} y={tick.y+4} textAnchor="end" fontSize="10" fill={t.tx3}
              fontFamily="monospace">
              {fmtK(tick.v)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={COLOR.primary} fillOpacity="0.08" />

        {nestEggY !== null && (
          <>
            <line x1={PAD.left} y1={nestEggY} x2={W-PAD.right} y2={nestEggY}
              stroke={ACCENT} strokeWidth="2" strokeDasharray="8,4" />
            <text x={W-PAD.right+3} y={nestEggY+4} fontSize="9" fill={ACCENT}>Target</text>
          </>
        )}

        <path d={balPath} fill="none" stroke={COLOR.primary} strokeWidth="2.5"
          strokeLinejoin="round" />

        {xTicks.map((d,i)=>(
          <text key={i} x={xS(d.age)} y={H-PAD.bottom+14} textAnchor="middle"
            fontSize="10" fill={t.tx3}>
            {d.age}
          </text>
        ))}

        {hovered && (
          <g>
            <line x1={xS(hovered.age)} y1={PAD.top} x2={xS(hovered.age)} y2={PAD.top+cH}
              stroke={t.border2} strokeWidth="1" strokeDasharray="4,2" />
            <circle cx={xS(hovered.age)} cy={yS(hovered.balance)} r="4"
              fill={COLOR.primary} stroke={t.panelBg} strokeWidth="2" />
          </g>
        )}
      </svg>

      <div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:8,alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:16,height:3,background:COLOR.primary,borderRadius:2}} />
          <span style={{fontSize:11,color:t.tx2}}>Projected Balance</span>
        </div>
        {nestEggY !== null && (
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:16,height:2,background:ACCENT,borderRadius:2}} />
            <span style={{fontSize:11,color:t.tx2}}>Target Nest Egg</span>
          </div>
        )}
        {hovered && (
          <div style={{marginLeft:"auto",fontSize:11,color:t.tx2,fontFamily:"monospace"}}>
            Age {hovered.age}:{" "}
            <strong style={{color:COLOR.primary}}>{fmt$(hovered.balance)}</strong>
            {nestEgg > 0 && (
              <span style={{color:hovered.balance>=nestEgg?COLOR.success:COLOR.warning,marginLeft:6}}>
                {hovered.balance>=nestEgg?"+":"-"}{fmt$(Math.abs(hovered.balance-nestEgg))}
                {" "}{hovered.balance>=nestEgg?"surplus":"gap"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- PlanComparisonTable ------------------------------------------------------
function PlanComparisonTable({ projectedBalance, retProfile, monthlySSIncome,
  onLockPlan, customRate, setCustomRate, baseline, t }) {
  const lockedPlan = retProfile.lockedPlan;

  return (
    <div style={panelSt(t,{marginBottom:20})}>
      <div style={{fontWeight:700,fontSize:15,color:t.tx1,marginBottom:16}}>
        Withdrawal Plan Comparison
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:520}}>
          <thead>
            <tr>
              {["Plan","Required Nest Egg","Monthly Income","On Track",""].map(h=>(
                <th key={h} style={{fontSize:10,color:t.tx3,fontWeight:700,padding:"0 10px 10px",
                  textAlign:h==="Plan"?"left":"center",
                  borderBottom:`1px solid ${t.border}`}}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLANS.map(plan=>{
              const rate = plan.id==="custom" ? (toNum(customRate)||4) : plan.rate;
              const nest = calcRequiredNestEgg(retProfile.targetMonthlyIncome, monthlySSIncome, rate);
              const monthlyFromProjBal = projectedBalance*rate/100/12;
              const monthlyNeeded = Math.max(0, toNum(retProfile.targetMonthlyIncome)-monthlySSIncome);
              const onTrack = projectedBalance >= nest;
              const gap = monthlyFromProjBal - monthlyNeeded;
              const isLocked = lockedPlan === plan.id;

              return (
                <tr key={plan.id}
                  style={{background:isLocked?ACCENT+"0f":"transparent",
                    borderLeft:isLocked?`3px solid ${ACCENT}`:"3px solid transparent"}}>
                  <td style={{padding:"14px 10px",minWidth:140}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {isLocked && <span style={{fontSize:12}}>🔒</span>}
                      <span style={{fontWeight:700,fontSize:13,color:t.tx1}}>{plan.label}</span>
                    </div>
                    {plan.id==="custom" ? (
                      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}>
                        <input type="number" value={customRate}
                          onChange={e=>setCustomRate(e.target.value)}
                          placeholder="4.0" min="0.5" max="15" step="0.5"
                          style={{...inputStyle(t),width:64,padding:"4px 8px",fontSize:12}} />
                        <span style={{fontSize:12,color:t.tx2}}>%</span>
                      </div>
                    ) : (
                      <div style={{fontSize:11,color:t.tx3,marginTop:3,lineHeight:1.4,maxWidth:170}}>
                        {plan.desc}
                      </div>
                    )}
                  </td>
                  <td style={{padding:"14px 10px",textAlign:"right"}}>
                    <div style={{fontFamily:"monospace",fontWeight:700,fontSize:13,color:t.tx1}}>
                      {fmt$(nest)}
                    </div>
                  </td>
                  <td style={{padding:"14px 10px",textAlign:"right"}}>
                    <div style={{fontFamily:"monospace",fontWeight:700,fontSize:13,color:t.tx1}}>
                      {fmt$(monthlyFromProjBal)}/mo
                    </div>
                    {baseline && baseline.amount > 0 && monthlyFromProjBal > 0 && monthlyFromProjBal < baseline.amount && (
                      <div style={{fontSize:10,color:COLOR.warning,fontWeight:600,marginTop:3}}>
                        ⚠️ Below your {fmt$(baseline.amount)}/mo spending baseline
                      </div>
                    )}
                  </td>
                  <td style={{padding:"14px 10px",textAlign:"center"}}>
                    <div style={{fontSize:15,fontWeight:700,
                      color:onTrack?COLOR.success:COLOR.danger}}>
                      {onTrack?"✓":"✗"}
                    </div>
                    <div style={{fontSize:11,fontFamily:"monospace",
                      color:gap>=0?COLOR.success:COLOR.danger}}>
                      {gap>=0?"+":""}{fmt$(Math.abs(gap))}/mo
                    </div>
                  </td>
                  <td style={{padding:"14px 10px",textAlign:"center"}}>
                    <button onClick={()=>onLockPlan(plan.id)}
                      style={{background:isLocked?ACCENT:t.surf,
                        border:`1px solid ${isLocked?ACCENT:t.border}`,
                        borderRadius:8,padding:"6px 12px",
                        color:isLocked?"#fff":t.tx2,cursor:"pointer",
                        fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>
                      {isLocked?"Locked":"Lock Plan"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!lockedPlan && (
        <div style={{fontSize:12,color:t.tx3,marginTop:12,textAlign:"center"}}>
          Lock a plan to track your on-track status on the Overview tab.
        </div>
      )}
    </div>
  );
}

// --- AiAnalysisTab ------------------------------------------------------------
function AiAnalysisTab({ apiKey, retProfile, accounts, monthlySSIncome, projectedBalance,
  lockedPlanObj, lockedPlanRate, savedResults, onSaveResults, baseline, t }) {
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(savedResults||null);
  const [error,   setError]   = useState(null);

  useEffect(()=>{ if (savedResults) setResult(savedResults); },[savedResults]);

  const nestEgg = lockedPlanRate
    ? calcRequiredNestEgg(retProfile.targetMonthlyIncome, monthlySSIncome, lockedPlanRate)
    : 0;
  const monthlyFromProjBal = projectedBalance*(lockedPlanRate||4)/100/12;
  const monthlyNeeded = Math.max(0, toNum(retProfile.targetMonthlyIncome)-monthlySSIncome);
  const monthlyGap = monthlyFromProjBal - monthlyNeeded;

  async function analyze() {
    if (!apiKey) { setError("No API key set. Click 🔑 in the toolbar."); return; }
    if (!retProfile.currentAge) { setError("Set your current age in Settings first."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-api-key":apiKey,
          "anthropic-version":"2023-06-01",
          "anthropic-dangerous-direct-browser-access":"true",
        },
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1024,
          messages:[{
            role:"user",
            content:`You are a retirement planning advisor. Analyze this person's retirement situation:

Current age: ${retProfile.currentAge}
Target retirement age: ${retProfile.retirementAge}
Annual salary: $${retProfile.annualSalary}
Target monthly income in retirement: $${retProfile.targetMonthlyIncome}
Locked plan: ${lockedPlanObj?.label||"None selected"}

Accounts: ${JSON.stringify(accounts.map(a=>({type:a.type,name:a.name,balance:a.currentBalance,contrib:a.contribRate,match:a.employerMatch})))}

Projected balance at retirement: $${projectedBalance.toLocaleString()}
Required nest egg (${lockedPlanObj?.label||"4% Rule"}): $${nestEgg.toLocaleString()}
Monthly surplus/gap: $${Math.abs(monthlyGap).toLocaleString()} ${monthlyGap>=0?"surplus":"gap"}
Social Security + Pension monthly estimate: $${monthlySSIncome}${baseline
  ? `\n\nCurrent Spending Profile (from SpendingTracker):\n- Minimum monthly expenses (essential spending): ${fmt$(baseline.amount)}\n- Top essential categories: ${baseline.breakdown.slice(0,5).map(b=>`${b.catName} $${b.avg.toFixed(0)}/mo`).join(", ")}\n- This represents the user's real cost of living floor. Their retirement income must exceed this to cover basic needs.`
  : "\n\nCurrent Spending Profile: Not available (user hasn't run SpendingTracker v1.8+ yet)."}

Provide:
1. A direct assessment: are they on track, ahead, or behind?
2. Three specific, actionable recommendations to improve their retirement outcome.
Keep it concise, plain language, no jargon. Be direct.`
          }]
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text||"No response received.";
      setResult(text);
      onSaveResults(text);
    } catch {
      setError("Analysis failed. Check your API key and try again.");
    }
    setLoading(false);
  }

  function copyResult() {
    if (result) navigator.clipboard?.writeText(result);
  }

  function downloadResult() {
    if (!result) return;
    const blob = new Blob([result],{type:"text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download="retirement-analysis.txt";
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{fontWeight:700,fontSize:15,color:t.tx1}}>AI Retirement Analysis</div>
        <button onClick={analyze} disabled={loading}
          style={{...btnPrimary({background:ACCENT,opacity:loading?0.7:1})}}>
          {loading?"Analyzing…":"Analyze My Retirement"}
        </button>
      </div>

      {error && (
        <div style={{background:COLOR.danger+"18",border:`1px solid ${COLOR.danger}33`,
          borderRadius:10,padding:"10px 14px",fontSize:13,color:COLOR.danger,marginBottom:12}}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{textAlign:"center",padding:"32px 20px"}}>
          <div style={{width:36,height:36,border:`3px solid ${ACCENT}`,borderTopColor:"transparent",
            borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 12px"}} />
          <div style={{fontSize:14,color:t.tx2}}>Analyzing your retirement plan…</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {!result && !loading && (
        <div style={{textAlign:"center",padding:"32px 20px"}}>
          <div style={{fontSize:32,marginBottom:12}}>🤖</div>
          <div style={{fontSize:14,color:t.tx2,lineHeight:1.6}}>
            Get a personalized retirement assessment with actionable recommendations from Claude AI.
          </div>
        </div>
      )}

      {result && !loading && (
        <div>
          <div style={{whiteSpace:"pre-wrap",fontSize:14,color:t.tx1,lineHeight:1.7,marginBottom:16}}>
            {result}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={copyResult} style={btnGhost(t,{fontSize:12,padding:"7px 14px"})}>
              Copy
            </button>
            <button onClick={downloadResult} style={btnGhost(t,{fontSize:12,padding:"7px 14px"})}>
              Download .txt
            </button>
            <button onClick={()=>setResult(null)}
              style={{...btnGhost(t,{fontSize:12,padding:"7px 14px",
                color:COLOR.danger,border:`1px solid ${COLOR.danger}33`})}}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- BackupRestorePanel -------------------------------------------------------
function BackupRestorePanel({ open, onClose, accounts, retProfile, assumptions,
  profileId, onImport, t }) {
  const [importMode,  setImportMode]  = useState("replace");
  const [importError, setImportError] = useState(null);
  const fileRef = useRef(null);

  if (!open) return null;
  const s = overlayContainer(t, 480);

  function exportJSON() {
    const data = { accounts, retProfile, assumptions,
      exportDate:new Date().toISOString(), profileId };
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`retirement-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  function exportAccountsCSV() {
    const headers = ["id","type","name","currentBalance","contribType","contribRate",
      "employerMatch","employerMatchLimit","monthlyBenefit","estimatedMonthlyBenefit",
      "ssBenefitAge","notes","color"];
    const rows = accounts.map(a=>
      headers.map(h=>`"${(a[h]||"").toString().replace(/"/g,'""')}"`).join(",")
    );
    const csv = [headers.join(","),...rows].join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`retirement-accounts-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function exportProfileCSV() {
    const csv = [
      "currentAge,retirementAge,annualSalary,targetMonthlyIncome,lockedPlan",
      `"${retProfile.currentAge||""}","${retProfile.retirementAge||""}","${retProfile.annualSalary||""}","${retProfile.targetMonthlyIncome||""}","${retProfile.lockedPlan||""}"`,
      "",
      "returnRate,inflationRate,salaryGrowthRate",
      `"${assumptions.returnRate}","${assumptions.inflationRate}","${assumptions.salaryGrowthRate}"`,
    ].join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`retirement-profile-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        setImportError(null);
        onImport(data, importMode);
        onClose();
      } catch {
        setImportError("Invalid file. Please upload a valid JSON backup.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>💾 Backup & Restore</span>
          <button onClick={onClose}
            style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>
            x
          </button>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={panelSt(t,{})}>
            <div style={{fontWeight:700,fontSize:13,color:t.tx1,marginBottom:10}}>Export</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <button onClick={exportJSON}
                style={{...btnPrimary({textAlign:"left",padding:"10px 14px"})}}>
                💾 Save Backup (JSON)
                <span style={{fontSize:11,opacity:.8,display:"block",fontWeight:400}}>
                  All accounts, profile and assumptions
                </span>
              </button>
              <button onClick={exportAccountsCSV}
                style={btnGhost(t,{textAlign:"left",padding:"10px 14px"})}>
                Export CSV — Accounts
              </button>
              <button onClick={exportProfileCSV}
                style={btnGhost(t,{textAlign:"left",padding:"10px 14px"})}>
                Export CSV — Profile & Assumptions
              </button>
            </div>
          </div>

          <div style={panelSt(t,{})}>
            <div style={{fontWeight:700,fontSize:13,color:t.tx1,marginBottom:10}}>
              Restore Backup
            </div>
            <div style={{marginBottom:12}}>
              <label style={labelSt(t)}>Import Mode</label>
              <div style={{display:"flex",gap:8}}>
                {[{id:"replace",label:"Replace All"},{id:"merge",label:"Merge Accounts"}].map(m=>(
                  <button key={m.id} onClick={()=>setImportMode(m.id)}
                    style={{...tabBtn(importMode===m.id,t),flex:1}}>
                    {m.label}
                  </button>
                ))}
              </div>
              <div style={{fontSize:11,color:t.tx3,marginTop:6}}>
                {importMode==="replace"
                  ? "Replaces all data with the backup."
                  : "Merges accounts by ID, keeps existing ones."}
              </div>
            </div>
            {importError && (
              <div style={{background:COLOR.danger+"18",border:`1px solid ${COLOR.danger}33`,
                borderRadius:8,padding:"8px 12px",fontSize:12,color:COLOR.danger,marginBottom:8}}>
                {importError}
              </div>
            )}
            <button onClick={()=>fileRef.current?.click()}
              style={btnGhost(t,{width:"100%",textAlign:"center"})}>
              Import JSON Backup
            </button>
            <input ref={fileRef} type="file" accept=".json"
              onChange={handleFileChange} style={{display:"none"}} />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- NavBar -------------------------------------------------------------------
function NavBar({ profiles, activeProfile, darkMode, setDarkMode,
  onOpenApiKey, onOpenBackup, onSwitchProfile, onEditProfile, onAddProfile, t }) {
  const [showProfiles, setShowProfiles] = useState(false);
  const bp    = useBreakpoint();
  const cloud = hasCloudStorage();

  return (
    <div style={{background:t.deepBg,borderBottom:`1px solid ${t.border}`,
      padding:"11px 20px",display:"flex",justifyContent:"space-between",
      alignItems:"center",position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:bp.isMobile?6:10}}>
        <div style={{width:32,height:32,borderRadius:8,
          background:`linear-gradient(135deg,${ACCENT},#6366f1)`,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
          📈
        </div>
        {!bp.isMobile && (
          <span style={{fontWeight:800,fontSize:18,color:t.tx1}}>Retirement</span>
        )}
        {!bp.isMobile && (
          <span style={{fontSize:10,
            color:cloud?COLOR.success:COLOR.warning,
            background:cloud?COLOR.success+"18":COLOR.warning+"18",
            border:`1px solid ${cloud?COLOR.success+"33":COLOR.warning+"33"}`,
            borderRadius:6,padding:"2px 8px",fontWeight:600}}>
            {cloud?"☁ Cloud Sync":"💾 Local Only"}
          </span>
        )}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <button onClick={()=>setDarkMode(d=>!d)}
          style={{background:t.surf,border:`1px solid ${t.border}`,
            borderRadius:8,padding:"6px 11px",color:t.tx1,cursor:"pointer",fontSize:14}}>
          {darkMode?"☀️":"🌙"}
        </button>
        <button onClick={onOpenBackup}
          style={{background:t.surf,border:`1px solid ${t.border}`,
            borderRadius:8,padding:"6px 11px",color:t.tx2,cursor:"pointer",fontSize:14}}
          title="Backup & Restore">
          💾
        </button>
        <button onClick={onOpenApiKey}
          style={{background:t.surf,border:`1px solid ${t.border}`,
            borderRadius:8,padding:"6px 11px",color:t.tx2,cursor:"pointer",fontSize:14}}
          title="API Key">
          🔑
        </button>
        {activeProfile && (
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowProfiles(s=>!s)}
              style={{width:34,height:34,borderRadius:"50%",
                background:activeProfile.avatarColor||COLOR.primary,
                border:"none",cursor:"pointer",fontSize:14,fontWeight:800,color:"#fff",
                display:"flex",alignItems:"center",justifyContent:"center"}}>
              {(activeProfile.name||"?")[0].toUpperCase()}
            </button>
            {showProfiles && (
              <div style={{position:"absolute",right:0,top:40,background:t.panelBg,
                border:`1px solid ${t.border}`,borderRadius:12,padding:8,
                boxShadow:"0 8px 24px rgba(0,0,0,.3)",zIndex:200,minWidth:180}}>
                <div style={{fontSize:10,color:t.tx2,padding:"4px 10px",
                  fontWeight:700,letterSpacing:0.5}}>
                  SWITCH PROFILE
                </div>
                {profiles.map(p=>(
                  <button key={p.id}
                    onClick={()=>{onSwitchProfile(p.id);setShowProfiles(false);}}
                    style={{display:"flex",alignItems:"center",gap:8,width:"100%",
                      border:"none",padding:"8px 10px",cursor:"pointer",borderRadius:8,
                      color:t.tx1,fontSize:13,textAlign:"left",
                      background:p.id===activeProfile.id?COLOR.primary+"18":"transparent"}}>
                    <div style={{width:24,height:24,borderRadius:"50%",
                      background:p.avatarColor||COLOR.primary,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:11,fontWeight:800,color:"#fff",flexShrink:0}}>
                      {(p.name||"?")[0].toUpperCase()}
                    </div>
                    <span style={{color:t.tx1}}>{p.name}</span>
                  </button>
                ))}
                <div style={{borderTop:`1px solid ${t.border}`,marginTop:6,paddingTop:6}}>
                  <button onClick={()=>{onEditProfile(activeProfile);setShowProfiles(false);}}
                    style={{display:"flex",alignItems:"center",gap:8,width:"100%",
                      border:"none",padding:"8px 10px",cursor:"pointer",borderRadius:8,
                      color:t.tx2,fontSize:12,background:"transparent",textAlign:"left"}}>
                    Edit Profile
                  </button>
                  <button onClick={()=>{onAddProfile();setShowProfiles(false);}}
                    style={{display:"flex",alignItems:"center",gap:8,width:"100%",
                      border:"none",padding:"8px 10px",cursor:"pointer",borderRadius:8,
                      color:COLOR.primary,fontSize:12,background:"transparent",
                      textAlign:"left",fontWeight:600}}>
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

// --- OverviewTab --------------------------------------------------------------
function OverviewTab({ projectedBalance, nestEggForLocked, monthlyGap, yearsToRetirement,
  monthlySSIncome, retProfile, accounts, investableBalance, lockedPlanObj,
  onSetupPlan, baseline, t, bp }) {
  const hasInputs = retProfile.currentAge && retProfile.targetMonthlyIncome;

  return (
    <div>
      <div style={panelSt(t,{marginBottom:20,padding:"24px 20px"})}>
        {hasInputs && nestEggForLocked > 0 ? (
          <>
            <OnTrackGauge projectedBalance={projectedBalance}
              requiredNestEggVal={nestEggForLocked} t={t} />
            {!lockedPlanObj && (
              <div style={{fontSize:12,color:t.tx3,marginTop:10,textAlign:"center"}}>
                Lock a plan in{" "}
                <button onClick={onSetupPlan}
                  style={{background:"none",border:"none",color:COLOR.primary,
                    cursor:"pointer",fontSize:12,fontWeight:600,padding:0}}>
                  Plan & AI
                </button>{" "}
                to see on-track status.
              </div>
            )}
          </>
        ) : (
          <div style={{textAlign:"center",padding:"16px 0"}}>
            <div style={{fontSize:48,marginBottom:12}}>📈</div>
            <div style={{fontWeight:700,fontSize:16,color:t.tx1,marginBottom:8}}>
              Set up your retirement plan
            </div>
            <div style={{fontSize:13,color:t.tx2,marginBottom:16,lineHeight:1.6}}>
              Enter your age, salary, and income goal to see your on-track status.
            </div>
            <button onClick={onSetupPlan} style={btnPrimary({background:ACCENT})}>
              Set Up Your Plan
            </button>
          </div>
        )}
      </div>

      <div style={{display:"grid",
        gridTemplateColumns:bp.isMobile?"1fr 1fr":"repeat(4,1fr)",
        gap:12,marginBottom:20}}>
        {[
          { label:"Projected Balance",  value:fmt$(projectedBalance),    color:COLOR.primary },
          { label:"Required Nest Egg",  value:nestEggForLocked>0?fmt$(nestEggForLocked):"—", color:ACCENT },
          { label:"Monthly Surplus/Gap",
            value:lockedPlanObj
              ? (monthlyGap>=0?"+":"")+fmt$(Math.abs(monthlyGap))+"/mo"
              : "—",
            color:monthlyGap>=0?COLOR.success:COLOR.danger },
          { label:"Years to Retirement",
            value:(retProfile.currentAge&&retProfile.retirementAge)
              ? `${yearsToRetirement} yrs`
              : "—",
            color:COLOR.teal },
        ].map(stat=>(
          <div key={stat.label} style={panelSt(t,{textAlign:"center",padding:"14px 12px"})}>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600,marginBottom:4}}>
              {stat.label}
            </div>
            <div style={{fontFamily:"monospace",fontWeight:800,fontSize:16,color:stat.color}}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {baseline && baseline.amount > 0 && toNum(retProfile.targetMonthlyIncome) > 0 &&
       toNum(retProfile.targetMonthlyIncome) < baseline.amount && (
        <div style={{background:COLOR.warning+"18",border:`1px solid ${COLOR.warning}44`,
          borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,lineHeight:1.6}}>
          <span style={{color:COLOR.warning,fontWeight:700}}>⚠️</span>{" "}
          Your target (<strong style={{fontFamily:"monospace"}}>{fmt$(toNum(retProfile.targetMonthlyIncome))}/mo</strong>) is below your current minimum monthly expenses{" "}
          (<strong style={{fontFamily:"monospace"}}>{fmt$(baseline.amount)}/mo</strong> from SpendingTracker). Consider increasing your target to at least{" "}
          <strong style={{fontFamily:"monospace"}}>{fmt$(baseline.amount)}/mo</strong>.
        </div>
      )}

      <div style={panelSt(t,{marginBottom:20})}>
        <div style={{fontWeight:700,fontSize:14,color:t.tx1,marginBottom:12}}>
          Guaranteed Monthly Income
        </div>
        <div style={{fontSize:13,color:t.tx2,marginBottom:12,lineHeight:1.6}}>
          Social Security and pension income reduces the nest egg you need to build from savings.
          Add SS and pension accounts in the Accounts tab.
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          background:t.surf,borderRadius:10,padding:"12px 16px",flexWrap:"wrap",gap:8}}>
          <span style={{fontSize:13,color:t.tx2}}>Monthly income from SS + Pension:</span>
          <span style={{fontFamily:"monospace",fontWeight:800,fontSize:18,color:ACCENT}}>
            {fmt$(monthlySSIncome)}/mo
          </span>
        </div>
        {monthlySSIncome > 0 && retProfile.targetMonthlyIncome && (
          <div style={{marginTop:10,fontSize:13,color:t.tx2}}>
            Monthly income needed from savings:{" "}
            <strong style={{fontFamily:"monospace",color:t.tx1}}>
              {fmt$(Math.max(0,toNum(retProfile.targetMonthlyIncome)-monthlySSIncome))}/mo
            </strong>
          </div>
        )}
        {monthlySSIncome === 0 && (
          <div style={{marginTop:8,fontSize:12,color:t.tx3}}>
            Get your Social Security estimate at ssa.gov/estimator
          </div>
        )}
      </div>

      <div style={panelSt(t,{})}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:14,color:t.tx1}}>Account Summary</div>
          <span style={{fontSize:12,color:t.tx3}}>
            {accounts.length} account{accounts.length===1?"":"s"}
          </span>
        </div>
        {accounts.length === 0 ? (
          <div style={{fontSize:13,color:t.tx3,textAlign:"center",padding:"16px 0"}}>
            No accounts yet. Add your first account in the Accounts tab.
          </div>
        ) : (
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              background:t.surf,borderRadius:10,padding:"12px 16px",flexWrap:"wrap",gap:8}}>
              <span style={{fontSize:13,color:t.tx2}}>Total investable balance:</span>
              <span style={{fontFamily:"monospace",fontWeight:800,fontSize:18,color:COLOR.success}}>
                {fmt$(investableBalance)}
              </span>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:12}}>
              {accounts.map(a=>(
                <div key={a.id} style={{display:"flex",alignItems:"center",gap:6,
                  background:t.surf,borderRadius:8,padding:"6px 10px"}}>
                  <span style={{fontSize:14}}>{typeEmoji(a.type)}</span>
                  <span style={{fontSize:12,color:t.tx1,fontWeight:600}}>{a.name}</span>
                  {!["pension","socialsecurity"].includes(a.type) && (
                    <span style={{fontSize:11,fontFamily:"monospace",color:t.tx2}}>
                      {fmt$(toNum(a.currentBalance))}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- AccountsTab --------------------------------------------------------------
function AccountsTab({ accounts, groupedAccounts, investableBalance, onEditAccount,
  onDeleteAccount, onAddAccount, t }) {
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",
        marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontWeight:800,fontSize:16,color:t.tx1}}>Retirement Accounts</div>
          <div style={{fontFamily:"monospace",fontWeight:700,fontSize:20,
            color:COLOR.success,marginTop:4}}>
            {fmt$(investableBalance)}{" "}
            <span style={{fontSize:13,fontWeight:400,color:t.tx2}}>investable balance</span>
          </div>
        </div>
        <button onClick={onAddAccount} style={btnPrimary({background:ACCENT})}>
          + Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div style={panelSt(t,{textAlign:"center",padding:"60px 20px"})}>
          <div style={{fontSize:48,marginBottom:16}}>🏦</div>
          <div style={{fontWeight:700,fontSize:18,color:t.tx1,marginBottom:8}}>
            No accounts yet
          </div>
          <div style={{fontSize:14,color:t.tx2,marginBottom:24}}>
            Add your 401(k), IRA, and other retirement accounts to get started.
          </div>
          <button onClick={onAddAccount}
            style={btnPrimary({padding:"12px 32px",fontSize:15,background:ACCENT})}>
            + Add Your First Account
          </button>
        </div>
      ) : (
        <>
          {["deferred","free","other"].map(group=>{
            const grpAccs = groupedAccounts[group];
            if (!grpAccs||grpAccs.length===0) return null;
            return (
              <div key={group} style={{marginBottom:24}}>
                <div style={{fontSize:11,fontWeight:700,color:t.tx3,letterSpacing:0.8,
                  marginBottom:10,textTransform:"uppercase"}}>
                  {GROUP_LABELS[group]}
                </div>
                {grpAccs.map(a=>(
                  <AccountCard key={a.id} account={a}
                    onEdit={onEditAccount} onDelete={onDeleteAccount} t={t} />
                ))}
              </div>
            );
          })}
          <button onClick={onAddAccount}
            style={{...btnPrimary({width:"100%",marginBottom:16,background:ACCENT})}}>
            + Add Account
          </button>
        </>
      )}
    </div>
  );
}

// --- PlanTab ------------------------------------------------------------------
function PlanTab({ yearlyData, projectedBalance, retProfile, setRetProfile,
  assumptions, setAssumptions, monthlySSIncome, lockedPlanObj,
  customRate, setCustomRate, onLockPlan, aiResults, onSaveAiResults, apiKey, accounts, baseline, t }) {
  const effectiveRate = lockedPlanObj
    ? (lockedPlanObj.id==="custom" ? toNum(customRate)||4 : lockedPlanObj.rate)
    : null;

  return (
    <div>
      <AssumptionsPanel
        assumptions={assumptions} setAssumptions={setAssumptions}
        retProfile={retProfile} setRetProfile={setRetProfile} t={t} />

      <ProjectionChart
        yearlyData={yearlyData}
        lockedPlanRate={effectiveRate}
        retProfile={retProfile}
        monthlySSIncome={monthlySSIncome}
        t={t} />

      <PlanComparisonTable
        projectedBalance={projectedBalance}
        retProfile={retProfile}
        monthlySSIncome={monthlySSIncome}
        onLockPlan={onLockPlan}
        customRate={customRate}
        setCustomRate={setCustomRate}
        baseline={baseline}
        t={t} />

      <div style={panelSt(t,{})}>
        <AiAnalysisTab
          apiKey={apiKey}
          retProfile={retProfile}
          accounts={accounts}
          monthlySSIncome={monthlySSIncome}
          projectedBalance={projectedBalance}
          lockedPlanObj={lockedPlanObj}
          lockedPlanRate={effectiveRate}
          savedResults={aiResults}
          onSaveResults={onSaveAiResults}
          baseline={baseline}
          t={t} />
      </div>
    </div>
  );
}

// --- writeRetSummary ----------------------------------------------------------
async function writeRetSummary(accounts, profile, assumptions, profileId) {
  if (!profile || !profileId) return;

  const currentBalance = (accounts||[]).reduce((s,a) =>
    s + parseFloat(a.currentBalance||0), 0
  );

  const planRates = { four_percent: 4, three_point_three: 3.3, five_percent: 5 };
  const rate = planRates[profile.lockedPlan] || parseFloat(profile.customPlanRate||4);
  const monthlySSIncome = calcMonthlySSIncome(accounts||[]);
  const targetNestEgg = profile.targetMonthlyIncome
    ? calcRequiredNestEgg(profile.targetMonthlyIncome, monthlySSIncome, rate)
    : 0;

  const fundedPct = targetNestEgg > 0
    ? Math.min(Math.round((currentBalance/targetNestEgg)*100), 100)
    : 0;

  const yearsToRetirement = Math.max(
    (parseInt(profile.retirementAge||65) - parseInt(profile.currentAge||35)), 0
  );

  // Use projectBalance (same function as the projection chart) to derive onTrack
  const assm = assumptions || { returnRate:7, inflationRate:3, salaryGrowthRate:3 };
  const yearlyData = (accounts||[]).length > 0 && profile.currentAge
    ? projectBalance(accounts, profile, assm)
    : [];
  const projectedBalance = yearlyData.length > 0 ? yearlyData[yearlyData.length-1].balance : 0;
  const onTrack = targetNestEgg > 0 ? projectedBalance >= targetNestEgg : false;

  const monthlyContribution = (accounts||[]).reduce((s,a) => {
    if (a.type === 'socialsecurity' || a.type === 'pension') return s;
    if (a.contribType === 'percent' && profile.annualSalary) {
      return s + (parseFloat(profile.annualSalary||0) * parseFloat(a.contribRate||0) / 100 / 12);
    }
    return s + parseFloat(a.contribRate||0);
  }, 0);

  const summary = {
    currentBalance:      Math.round(currentBalance),
    targetNestEgg:       Math.round(targetNestEgg),
    fundedPct,
    onTrack,
    yearsToRetirement,
    monthlyContribution: Math.round(monthlyContribution * 100) / 100,
    lockedPlan:          profile.lockedPlan || 'four_percent',
    calculatedOn:        new Date().toISOString()
  };
  await storeSet(`ret_summary_${profileId}`, summary, true);
  console.log('summary written:', await storeGet(`ret_summary_${profileId}`, true));
}

// --- RetirementModule (export default) ----------------------------------------
export default function RetirementModule() {
  const [loading,         setLoading]         = useState(true);
  const [darkMode,        setDarkMode]        = useState(
    () => localStorage.getItem("ret_dark") !== "false"
  );
  const [profiles,        setProfiles]        = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [accounts,        setAccounts]        = useState([]);
  const [retProfile,      setRetProfile]      = useState({
    currentAge:"", retirementAge:"65", annualSalary:"",
    targetMonthlyIncome:"", lockedPlan:null,
  });
  const [assumptions,     setAssumptions]     = useState({
    returnRate:7, inflationRate:3, salaryGrowthRate:3,
  });
  const [aiResults,       setAiResults]       = useState(null);
  const [apiKey,          setApiKey]          = useState("");
  const [activeTab,       setActiveTab]       = useState("overview");
  const [customRate,      setCustomRate]      = useState("4");

  const [showApiKey,       setShowApiKey]       = useState(false);
  const [showBackup,       setShowBackup]       = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile,   setEditingProfile]   = useState(null);
  const [showAddAccount,   setShowAddAccount]   = useState(false);
  const [editAccount,      setEditAccount]      = useState(null);
  const [confirmTarget,    setConfirmTarget]    = useState(null);
  const [baseline,         setBaseline]         = useState(null);

  const t = useTheme(darkMode);
  const bp = useBreakpoint();
  const activeProfile = profiles.find(p=>p.id===activeProfileId)||null;

  const yearlyData = (accounts.length>0 && retProfile.currentAge)
    ? projectBalance(accounts, retProfile, assumptions)
    : (retProfile.currentAge ? [{age:toNum(retProfile.currentAge),balance:0}] : []);

  const projectedBalance  = yearlyData.length>0 ? yearlyData[yearlyData.length-1].balance : 0;
  const monthlySSIncome   = calcMonthlySSIncome(accounts);
  const lockedPlanObj     = PLANS.find(p=>p.id===retProfile.lockedPlan)||null;
  const lockedPlanRate    = lockedPlanObj
    ? (lockedPlanObj.id==="custom" ? toNum(customRate)||4 : lockedPlanObj.rate)
    : null;
  const nestEggForLocked  = lockedPlanRate && retProfile.targetMonthlyIncome
    ? calcRequiredNestEgg(retProfile.targetMonthlyIncome, monthlySSIncome, lockedPlanRate)
    : 0;
  const yearsToRetirement = Math.max(0,
    toNum(retProfile.retirementAge||65) - toNum(retProfile.currentAge||0));
  const monthlyFromProjBal = lockedPlanRate ? projectedBalance*lockedPlanRate/100/12 : 0;
  const monthlyNeeded      = Math.max(0, toNum(retProfile.targetMonthlyIncome)-monthlySSIncome);
  const monthlyGap         = monthlyFromProjBal - monthlyNeeded;

  const investableBalance = accounts
    .filter(a=>!["pension","socialsecurity"].includes(a.type))
    .reduce((s,a)=>s+toNum(a.currentBalance),0);

  const groupedAccounts = {
    deferred: accounts.filter(a=>typeGroup(a.type)==="deferred"),
    free:     accounts.filter(a=>typeGroup(a.type)==="free"),
    other:    accounts.filter(a=>typeGroup(a.type)==="other"),
  };

  useEffect(()=>{
    async function init() {
      const [profs, activeId, key] = await Promise.all([
        storeGet("cc_profiles",true),
        storeGet("cc_active_profile",true),
        storeGet("cc_apikey",true),
      ]);
      const ps  = profs||[];
      const aid = activeId||ps[0]?.id||null;
      setProfiles(ps);
      setActiveProfileId(aid);
      setApiKey(key||"");
      if (aid) {
        const [accs,rp,assm,ai] = await Promise.all([
          storeGet(`ret_accounts_${aid}`,true),
          storeGet(`ret_profile_${aid}`,true),
          storeGet(`ret_assumptions_${aid}`,true),
          storeGet(`ret_ai_results_${aid}`,true),
        ]);
        const bl = await storeGet(`ffp_baseline_${aid}`, true);
        if (accs) setAccounts(accs);
        if (rp)   setRetProfile(p=>({...p,...rp}));
        if (assm) setAssumptions(a=>({...a,...assm}));
        if (ai)   setAiResults(ai);
        setBaseline(bl||null);
        await writeRetSummary(
          accs||[],
          { currentAge:"", retirementAge:"65", annualSalary:"", targetMonthlyIncome:"", lockedPlan:null, ...(rp||{}) },
          { returnRate:7, inflationRate:3, salaryGrowthRate:3, ...(assm||{}) },
          aid
        );
      }
      setLoading(false);
    }
    init();
  },[]);

  useEffect(()=>{
    localStorage.setItem("ret_dark", darkMode);
  },[darkMode]);

  useEffect(()=>{
    if (!activeProfileId||loading) return;
    (async()=>{
      await storeSet(`ret_profile_${activeProfileId}`, retProfile, true);
      await writeRetSummary(accounts, retProfile, assumptions, activeProfileId);
    })();
  },[retProfile,activeProfileId,loading]);

  useEffect(()=>{
    if (!activeProfileId||loading) return;
    const timer = setTimeout(async()=>{
      await storeSet(`ret_assumptions_${activeProfileId}`, assumptions, true);
      await writeRetSummary(accounts, retProfile, assumptions, activeProfileId);
    }, 500);
    return ()=>clearTimeout(timer);
  },[assumptions,activeProfileId,loading]);

  async function switchProfile(id) {
    setActiveProfileId(id);
    await storeSet("cc_active_profile",id,true);
    setAccounts([]);
    setRetProfile({ currentAge:"",retirementAge:"65",annualSalary:"",
      targetMonthlyIncome:"",lockedPlan:null });
    setAssumptions({ returnRate:7, inflationRate:3, salaryGrowthRate:3 });
    setAiResults(null);
    const [accs,rp,assm,ai] = await Promise.all([
      storeGet(`ret_accounts_${id}`,true),
      storeGet(`ret_profile_${id}`,true),
      storeGet(`ret_assumptions_${id}`,true),
      storeGet(`ret_ai_results_${id}`,true),
    ]);
    if (accs) setAccounts(accs);
    if (rp)   setRetProfile(p=>({...p,...rp}));
    if (assm) setAssumptions(a=>({...a,...assm}));
    if (ai)   setAiResults(ai);
    const bl = await storeGet(`ffp_baseline_${id}`, true);
    setBaseline(bl||null);
  }

  async function handleSaveProfile(profile) {
    const exists  = profiles.some(p=>p.id===profile.id);
    const updated = exists
      ? profiles.map(p=>p.id===profile.id?profile:p)
      : [...profiles,profile];
    setProfiles(updated);
    await storeSet("cc_profiles",updated,true);
    if (!exists) await switchProfile(profile.id);
    setShowProfileModal(false);
  }

  async function handleCreateFirstProfile(profile) {
    const updated = [profile];
    setProfiles(updated); setActiveProfileId(profile.id);
    await storeSet("cc_profiles",updated,true);
    await storeSet("cc_active_profile",profile.id,true);
  }

  async function saveAccounts(next) {
    setAccounts(next);
    await storeSet(`ret_accounts_${activeProfileId}`,next,true);
    await writeRetSummary(next, retProfile, assumptions, activeProfileId);
  }

  async function saveApiKey(key) {
    setApiKey(key); setShowApiKey(false);
    await storeSet("cc_apikey",key,true);
  }

  function handleSaveAccount(account) {
    const exists = accounts.some(a=>a.id===account.id);
    const next   = exists
      ? accounts.map(a=>a.id===account.id?account:a)
      : [...accounts,account];
    saveAccounts(next);
    setEditAccount(null); setShowAddAccount(false);
  }

  function handleDeleteAccount(account) {
    setConfirmTarget({ id:account.id, name:account.name,
      message:`Delete account "${account.name}"? This cannot be undone.` });
  }

  async function handleConfirmDelete() {
    if (!confirmTarget) return;
    await saveAccounts(accounts.filter(a=>a.id!==confirmTarget.id));
    setConfirmTarget(null);
  }

  async function handleLockPlan(planId) {
    const next = { ...retProfile, lockedPlan:planId };
    setRetProfile(next);
    await storeSet(`ret_profile_${activeProfileId}`,next,true);
    await writeRetSummary(accounts, next, assumptions, activeProfileId);
  }

  async function handleSaveAiResults(text) {
    setAiResults(text);
    await storeSet(`ret_ai_results_${activeProfileId}`,text,true);
  }

  async function handleBackupImport(data, mode) {
    if (mode==="replace") {
      if (data.accounts)    await saveAccounts(data.accounts);
      if (data.retProfile)  setRetProfile(p=>({...p,...data.retProfile}));
      if (data.assumptions) setAssumptions(a=>({...a,...data.assumptions}));
    } else {
      if (data.accounts) {
        const existing = [...accounts];
        data.accounts.forEach(a=>{
          const idx = existing.findIndex(e=>e.id===a.id);
          if (idx>=0) existing[idx]=a; else existing.push(a);
        });
        await saveAccounts(existing);
      }
    }
  }

  if (loading) return (
    <div style={{minHeight:"100vh",background:t.bg,display:"flex",alignItems:"center",
      justifyContent:"center",flexDirection:"column",gap:16,padding:20}}>
      <div style={{width:40,height:40,border:`3px solid ${ACCENT}`,
        borderTopColor:"transparent",borderRadius:"50%",
        animation:"spin .8s linear infinite"}} />
      <div style={{fontSize:14,color:t.tx2}}>Loading Retirement Planner…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!activeProfile && profiles.length===0) return (
    <FirstRunSetup darkMode={darkMode} setDarkMode={setDarkMode}
      onSave={handleCreateFirstProfile} />
  );

  return (
    <div style={{minHeight:"100vh",background:t.bg,
      fontFamily:"'DM Sans','Segoe UI',sans-serif",color:t.tx1}}>

      <NavBar profiles={profiles} activeProfile={activeProfile}
        darkMode={darkMode} setDarkMode={setDarkMode}
        onOpenApiKey={()=>setShowApiKey(true)}
        onOpenBackup={()=>setShowBackup(true)}
        onSwitchProfile={switchProfile}
        onEditProfile={(p)=>{setEditingProfile(p);setShowProfileModal(true);}}
        onAddProfile={()=>{setEditingProfile(null);setShowProfileModal(true);}}
        t={t} />

      <div style={{maxWidth:960,margin:"0 auto",padding:"20px 16px"}}>
        <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
          {[
            {id:"overview",label:"Overview"},
            {id:"accounts",label:"Accounts"},
            {id:"plan",    label:"Plan & AI"},
          ].map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
              style={tabBtn(activeTab===tab.id,t)}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab==="overview" && (
          <OverviewTab
            projectedBalance={projectedBalance}
            nestEggForLocked={nestEggForLocked}
            monthlyGap={monthlyGap}
            yearsToRetirement={yearsToRetirement}
            monthlySSIncome={monthlySSIncome}
            retProfile={retProfile}
            accounts={accounts}
            investableBalance={investableBalance}
            lockedPlanObj={lockedPlanObj}
            onSetupPlan={()=>setActiveTab("plan")}
            baseline={baseline}
            t={t} bp={bp} />
        )}

        {activeTab==="accounts" && (
          <AccountsTab
            accounts={accounts}
            groupedAccounts={groupedAccounts}
            investableBalance={investableBalance}
            onEditAccount={(a)=>{setEditAccount(a);setShowAddAccount(true);}}
            onDeleteAccount={handleDeleteAccount}
            onAddAccount={()=>{setEditAccount(null);setShowAddAccount(true);}}
            t={t} />
        )}

        {activeTab==="plan" && (
          <PlanTab
            yearlyData={yearlyData}
            projectedBalance={projectedBalance}
            retProfile={retProfile}
            setRetProfile={setRetProfile}
            assumptions={assumptions}
            setAssumptions={setAssumptions}
            monthlySSIncome={monthlySSIncome}
            lockedPlanObj={lockedPlanObj}
            customRate={customRate}
            setCustomRate={setCustomRate}
            onLockPlan={handleLockPlan}
            aiResults={aiResults}
            onSaveAiResults={handleSaveAiResults}
            apiKey={apiKey}
            accounts={accounts}
            baseline={baseline}
            t={t} />
        )}
      </div>

      <AddAccountModal open={showAddAccount}
        onClose={()=>{setShowAddAccount(false);setEditAccount(null);}}
        editAccount={editAccount} onSave={handleSaveAccount} t={t} />

      <ConfirmModal open={!!confirmTarget}
        onClose={()=>setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Account"
        message={confirmTarget?.message}
        confirmLabel="Delete" danger t={t} />

      <BackupRestorePanel open={showBackup}
        onClose={()=>setShowBackup(false)}
        accounts={accounts} retProfile={retProfile} assumptions={assumptions}
        profileId={activeProfileId}
        onImport={handleBackupImport} t={t} />

      <ApiKeyModal open={showApiKey}
        onClose={()=>setShowApiKey(false)}
        apiKey={apiKey} onSave={saveApiKey} t={t} />

      <ProfileModal open={showProfileModal}
        onClose={()=>setShowProfileModal(false)}
        editProfile={editingProfile} onSave={handleSaveProfile} t={t} />

    </div>
  );
}
