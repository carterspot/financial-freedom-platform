// InsuranceTracker v1.0
// modules/insurance.jsx
import { useState, useEffect, useRef } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];
const COLOR = {
  primary:"#6366f1", success:"#10b981", warning:"#f59e0b", danger:"#ef4444",
  pink:"#ec4899", blue:"#3b82f6", orange:"#f97316", purple:"#8b5cf6", cyan:"#06b6d4",
};
const POLICY_TYPES = ["life","disability","health","auto","home","renters","umbrella","other"];
const POLICY_LABELS = {
  life:"Life", disability:"Disability", health:"Health", auto:"Auto",
  home:"Home", renters:"Renters", umbrella:"Umbrella", other:"Other",
};
const TYPE_COLORS = {
  life:"#6366f1", disability:"#3b82f6", health:"#10b981", auto:"#f59e0b",
  home:"#f97316", renters:"#ec4899", umbrella:"#8b5cf6", other:"#94a3b8",
};

// ── Storage ───────────────────────────────────────────────────────────────────
let _cloudAvail = null;
async function probeCloud() {
  if (_cloudAvail !== null) return _cloudAvail;
  if (!window?.storage?.get) { _cloudAvail = false; return false; }
  try {
    await Promise.race([
      window.storage.get("__probe__", false),
      new Promise((_,r) => setTimeout(() => r(new Error("t")), 2500))
    ]);
    _cloudAvail = true;
  } catch { _cloudAvail = false; }
  return _cloudAvail;
}
async function storeGet(key, shared=false) {
  if (await probeCloud()) {
    try { const r = await window.storage.get(key, shared); return r ? JSON.parse(r.value) : null; }
    catch { _cloudAvail = false; }
  }
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function storeSet(key, value, shared=false) {
  if (await probeCloud()) {
    try { await window.storage.set(key, JSON.stringify(value), shared); return; }
    catch { _cloudAvail = false; }
  }
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
const hasCloud = () => _cloudAvail === true;

// ── API ───────────────────────────────────────────────────────────────────────
const API_URL = "https://ffp-api-proxy.carterspot.workers.dev/";
const MODEL   = "claude-sonnet-4-20250514";
async function probeApiKey(key) {
  if (!key?.trim().startsWith("sk-ant-")) return "invalid";
  try {
    const res = await fetch(API_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json","anthropic-version":"2023-06-01","x-api-key":key.trim()},
      body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:1,messages:[{role:"user",content:"hi"}]})
    });
    return res.ok ? "valid" : "invalid";
  } catch { return "unknown"; }
}
async function callClaude(apiKey, body) {
  const headers = {"Content-Type":"application/json","anthropic-version":"2023-06-01"};
  if (apiKey?.trim()) headers["x-api-key"] = apiKey.trim();
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(API_URL, {method:"POST", headers, body:JSON.stringify(body), signal:ctrl.signal});
    clearTimeout(tid);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res;
  } catch(e) { clearTimeout(tid); throw e; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const generateId  = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const fmt$        = (n) => (parseFloat(n)||0).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0});
const toNum       = (s) => parseFloat(s)||0;
const getInitials = (n) => !n?"?":(n.trim().split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase());
const hashPin     = (pin,id) => btoa(unescape(encodeURIComponent(pin+id)));

function fmt$k(n) {
  const v = parseFloat(n)||0;
  if (v >= 1000000) return `$${(v/1000000).toFixed(1)}M`;
  if (v >= 1000)    return `$${Math.round(v/1000)}K`;
  return `$${fmt$(v)}`;
}
function fmtFreq(f) {
  if (!f) return "";
  const m = {monthly:"/mo",annual:"/yr",quarterly:"/qtr"};
  return m[f] || `/${f}`;
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr) - new Date()) / (1000*60*60*24));
}
function fmtDate(s) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}
function normalizeMonthly(stream) {
  const amt  = toNum(stream.amount);
  const freq = (stream.frequency||"monthly").toLowerCase();
  if (freq.includes("annual"))   return amt/12;
  if (freq.includes("bi-weekly")||freq.includes("biweekly")) return amt*26/12;
  if (freq.includes("weekly"))   return amt*52/12;
  if (freq.includes("semi"))     return amt*2;
  if (freq.includes("quarterly"))return amt/3;
  return amt;
}
function calcMonthlyIncome(streams) {
  if (!Array.isArray(streams)) return 0;
  return streams.filter(s=>s.active!==false).reduce((sum,s)=>sum+normalizeMonthly(s),0);
}
function calcLegacyHealth(policies, targets, incomeMonthly) {
  if (!policies?.length || !incomeMonthly) return 0;
  const annualIncome = incomeMonthly * 12;
  const scores = [];
  const lifeCoverage = policies.filter(p=>p.type==="life"&&!p.isApproximate).reduce((s,p)=>s+(p.coverageAmount||0),0);
  const lifeApprox   = policies.filter(p=>p.type==="life"&&p.isApproximate).reduce((s,p)=>s+(p.coverageAmount||0),0);
  const lifeTotalEst = lifeCoverage + lifeApprox;
  const lifeTarget   = targets?.life || annualIncome * 10;
  scores.push({w:40, v:Math.min((lifeTotalEst/lifeTarget)*100,100)});
  const disMonthly = policies.filter(p=>p.type==="disability").reduce((s,p)=>s+(p.monthlyBenefit||0),0);
  const disTarget  = targets?.disability || incomeMonthly * 0.6;
  scores.push({w:30, v:disMonthly>0?Math.min((disMonthly/disTarget)*100,100):0});
  scores.push({w:20, v:policies.some(p=>p.type==="health")?100:0});
  scores.push({w:10, v:policies.some(p=>p.type==="auto")?100:0});
  return Math.round(scores.reduce((s,x)=>s+(x.v*x.w/100),0));
}
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], {type:mimeType});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// ── Theme & Breakpoint ────────────────────────────────────────────────────────
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
function useBreakpoint() {
  const [w, setW] = useState(() => typeof window!=="undefined"?window.innerWidth:1280);
  useEffect(() => {
    const fn = () => setW(typeof window!=="undefined"?window.innerWidth:1280);
    window.addEventListener("resize",fn);
    return () => window.removeEventListener("resize",fn);
  }, []);
  return {isMobile:w<640, isTablet:w<960, isDesktop:w>=960};
}

// ── usePinLock ────────────────────────────────────────────────────────────────
function usePinLock(modulePrefix) {
  const [locked, setLocked]   = useState(true);
  const [hasPin, setHasPin]   = useState(false);
  const [pinHash, setPinHash_] = useState(null);

  useEffect(() => {
    const handler = () => {
      if (document.hidden && hasPin) setLocked(true);
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [hasPin]);

  function init(storedHash, profileId) {
    setPinHash_(storedHash||null);
    setHasPin(!!storedHash);
    const lockState = localStorage.getItem(`${modulePrefix}_locked_${profileId}`);
    setLocked(lockState!=="false" && !!storedHash);
  }
  async function unlock(pin, profileId) {
    const h = hashPin(pin, profileId);
    if (h === pinHash) {
      localStorage.setItem(`${modulePrefix}_locked_${profileId}`,"false");
      setLocked(false);
      return true;
    }
    return false;
  }
  async function setPin(pin, profileId) {
    const h = hashPin(pin, profileId);
    await storeSet(`${modulePrefix}_pin_${profileId}`, h, true);
    setPinHash_(h);
    setHasPin(true);
    localStorage.setItem(`${modulePrefix}_locked_${profileId}`,"false");
    setLocked(false);
  }
  async function clearPin(profileId) {
    await storeSet(`${modulePrefix}_pin_${profileId}`, null, true);
    localStorage.removeItem(`${modulePrefix}_locked_${profileId}`);
    setPinHash_(null);
    setHasPin(false);
    setLocked(false);
  }
  return { locked, hasPin, pinHash, init, unlock, setPin, clearPin };
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function inputSt(t) {
  return {width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,
    padding:"8px 12px",color:t.tx1,fontSize:13,boxSizing:"border-box",outline:"none"};
}
function labelSt(t) {
  return {fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600};
}
function btnPrimary(extra={}) {
  return {background:COLOR.primary,border:"none",borderRadius:10,padding:"9px 20px",
    color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14,transition:"all .2s",...extra};
}
function btnGhost(t,extra={}) {
  return {background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 20px",
    color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13,transition:"all .15s",...extra};
}
function tabBtnSt(active,t) {
  return {background:active?COLOR.primary:t.surf,color:active?"#fff":t.tx2,
    border:`1px solid ${active?COLOR.primary:t.border}`,borderRadius:8,
    padding:"7px 18px",cursor:"pointer",fontWeight:600,fontSize:13,
    transition:"all .15s",whiteSpace:"nowrap"};
}
function cardSt(t) {
  return {background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:16,padding:"16px 20px"};
}
function pillSt(color) {
  return {fontSize:10,color,background:color+"18",border:`1px solid ${color}33`,
    borderRadius:6,padding:"2px 8px",fontWeight:700};
}

// ── PinDigitInput ─────────────────────────────────────────────────────────────
function PinDigitInput({ onComplete, t, autoFocus=true }) {
  const [digits, setDigits] = useState(["","","",""]);
  const refs = useRef([]);

  function handleChange(i, val) {
    const d = val.replace(/\D/g,"").slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 3) refs.current[i+1]?.focus();
    if (next.every(x=>x)) onComplete(next.join(""));
  }
  function handleKeyDown(i, e) {
    if (e.key==="Backspace" && !digits[i] && i>0) {
      refs.current[i-1]?.focus();
    }
  }
  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  return (
    <div style={{display:"flex",gap:10,justifyContent:"center",margin:"16px 0"}}>
      {digits.map((d,i) => (
        <input key={i}
          ref={el => refs.current[i] = el}
          type="password"
          maxLength={1}
          value={d}
          onChange={e => handleChange(i,e.target.value)}
          onKeyDown={e => handleKeyDown(i,e)}
          style={{width:52,height:56,textAlign:"center",fontSize:22,fontWeight:800,
            background:t.surf,border:`2px solid ${d?COLOR.primary:t.border2}`,
            borderRadius:12,color:t.tx1,outline:"none",transition:"border-color .15s"}}
        />
      ))}
    </div>
  );
}

// ── PinOverlay ────────────────────────────────────────────────────────────────
function PinOverlay({ onUnlock, onForgot, t }) {
  const [error, setError] = useState("");

  async function handleComplete(pin) {
    setError("");
    const ok = await onUnlock(pin);
    if (!ok) setError("Incorrect PIN. Try again.");
  }

  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(2,6,23,.97)",
      display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}>
      <div style={{...cardSt(t),maxWidth:360,width:"100%",textAlign:"center",padding:"32px 24px"}}>
        <div style={{fontSize:44,marginBottom:8}}>🛡️</div>
        <div style={{fontSize:20,fontWeight:800,color:t.tx1,marginBottom:4}}>Insurance Tracker</div>
        <div style={{fontSize:13,color:t.tx2,marginBottom:4}}>Enter your PIN to continue</div>
        <PinDigitInput onComplete={handleComplete} t={t}/>
        {error && <div style={{fontSize:12,color:COLOR.danger,marginBottom:12}}>{error}</div>}
        <button onClick={onForgot}
          style={{background:"none",border:"none",color:COLOR.primary,cursor:"pointer",fontSize:13}}>
          Forgot PIN?
        </button>
      </div>
    </div>
  );
}

// ── RecoveryModal ─────────────────────────────────────────────────────────────
function RecoveryModal({ profiles, activeProfileId, onRecovered, onClose, t }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function attempt() {
    const prof = profiles.find(p=>p.id===activeProfileId);
    if (!prof?.pin) { setError("No recovery PIN found for this profile."); return; }
    if (pin === prof.pin) { onRecovered(); }
    else setError("Incorrect recovery PIN.");
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2100,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{...cardSt(t),maxWidth:400,width:"100%",padding:24}}>
        <div style={{fontSize:16,fontWeight:800,color:t.tx1,marginBottom:8}}>Recover Access</div>
        <div style={{fontSize:13,color:t.tx2,marginBottom:16}}>
          Enter your profile Recovery PIN to reset your Insurance PIN.
        </div>
        <label style={labelSt(t)}>Recovery PIN</label>
        <input type="password" value={pin} onChange={e=>setPin(e.target.value)}
          placeholder="Recovery PIN" style={{...inputSt(t),marginBottom:12}}/>
        {error && <div style={{fontSize:12,color:COLOR.danger,marginBottom:8}}>{error}</div>}
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <button onClick={attempt} style={{...btnPrimary(),flex:1}}>Verify & Reset</button>
          <button onClick={onClose} style={{...btnGhost(t),flex:1}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── SetPinModal ───────────────────────────────────────────────────────────────
function SetPinModal({ onSet, onClose, t }) {
  const [step, setStep] = useState(1);
  const [pin1, setPin1] = useState("");
  const [error, setError] = useState("");

  function handleStep1(pin) { setPin1(pin); setStep(2); }
  function handleStep2(pin) {
    if (pin !== pin1) { setError("PINs don't match. Try again."); setStep(1); setPin1(""); }
    else { setError(""); onSet(pin); }
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2100,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{...cardSt(t),maxWidth:380,width:"100%",padding:28,textAlign:"center"}}>
        <div style={{fontSize:17,fontWeight:800,color:t.tx1,marginBottom:4}}>
          {step===1?"Set Your PIN":"Confirm Your PIN"}
        </div>
        <div style={{fontSize:13,color:t.tx2,marginBottom:4}}>
          {step===1?"Choose a 4-digit PIN to protect your insurance data.":"Enter the same PIN again to confirm."}
        </div>
        {error && <div style={{fontSize:12,color:COLOR.danger,marginBottom:4}}>{error}</div>}
        <PinDigitInput key={step} onComplete={step===1?handleStep1:handleStep2} t={t}/>
        <button onClick={onClose} style={{...btnGhost(t),width:"100%",marginTop:4}}>Cancel</button>
      </div>
    </div>
  );
}

// ── ChangePinModal ────────────────────────────────────────────────────────────
function ChangePinModal({ pinHash, profileId, onChanged, onClose, t }) {
  const [step, setStep] = useState(0);
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState("");

  function handleStep0(pin) {
    if (hashPin(pin,profileId) === pinHash) { setError(""); setStep(1); }
    else setError("Incorrect current PIN.");
  }
  function handleStep1(pin) { setNewPin(pin); setStep(2); }
  function handleStep2(pin) {
    if (pin !== newPin) { setError("PINs don't match."); setStep(1); setNewPin(""); }
    else { setError(""); onChanged(pin); }
  }

  const labels = ["Verify Current PIN","New PIN","Confirm New PIN"];
  const handlers = [handleStep0,handleStep1,handleStep2];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2100,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{...cardSt(t),maxWidth:380,width:"100%",padding:28,textAlign:"center"}}>
        <div style={{fontSize:17,fontWeight:800,color:t.tx1,marginBottom:4}}>{labels[step]}</div>
        {error && <div style={{fontSize:12,color:COLOR.danger,marginBottom:4}}>{error}</div>}
        <PinDigitInput key={step} onComplete={handlers[step]} t={t}/>
        <button onClick={onClose} style={{...btnGhost(t),width:"100%",marginTop:4}}>Cancel</button>
      </div>
    </div>
  );
}

// ── RemovePinModal ────────────────────────────────────────────────────────────
function RemovePinModal({ pinHash, profileId, onRemoved, onClose, t }) {
  const [error, setError] = useState("");

  function handleComplete(pin) {
    if (hashPin(pin,profileId) === pinHash) { onRemoved(); }
    else setError("Incorrect PIN.");
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2100,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{...cardSt(t),maxWidth:380,width:"100%",padding:28,textAlign:"center"}}>
        <div style={{fontSize:17,fontWeight:800,color:t.tx1,marginBottom:4}}>Remove PIN</div>
        <div style={{fontSize:13,color:t.tx2,marginBottom:4}}>
          Enter your current PIN to confirm removal.
        </div>
        {error && <div style={{fontSize:12,color:COLOR.danger,marginBottom:4}}>{error}</div>}
        <PinDigitInput onComplete={handleComplete} t={t}/>
        <button onClick={onClose} style={{...btnGhost(t),width:"100%",marginTop:4}}>Cancel</button>
      </div>
    </div>
  );
}

// ── ApiKeyModal ───────────────────────────────────────────────────────────────
function ApiKeyModal({ apiKey: current, onSave, onClose, t }) {
  const [key, setKey] = useState(current||"");

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{...cardSt(t),maxWidth:440,width:"100%",padding:24}}>
        <div style={{fontSize:17,fontWeight:800,color:t.tx1,marginBottom:12}}>🔑 API Key</div>
        <label style={labelSt(t)}>Anthropic API Key</label>
        <input type="password" value={key} onChange={e=>setKey(e.target.value)}
          placeholder="sk-ant-..." style={{...inputSt(t),marginBottom:16}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>onSave(key)} style={{...btnPrimary(),flex:1}}>Save</button>
          <button onClick={onClose} style={{...btnGhost(t),flex:1}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── AiResultBox ───────────────────────────────────────────────────────────────
function AiResultBox({ text, ts, name, onCopy, onDownload, t }) {
  if (!text) return null;
  return (
    <div style={{marginTop:12}}>
      <div style={{background:t.surf,borderRadius:10,padding:"12px 14px",fontSize:13,
        color:t.tx1,lineHeight:1.6,whiteSpace:"pre-wrap",maxHeight:320,overflowY:"auto"}}>
        {text}
      </div>
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <button onClick={()=>onCopy(text)} style={btnGhost(t,{padding:"4px 12px",fontSize:12})}>
          📋 Copy
        </button>
        <button onClick={()=>onDownload(text,name)} style={btnGhost(t,{padding:"4px 12px",fontSize:12})}>
          ⬇ Download .txt
        </button>
      </div>
      {ts && (
        <div style={{fontSize:11,color:t.tx3,marginTop:4}}>
          Last run: {new Date(ts).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ── AddEditPolicyModal ────────────────────────────────────────────────────────
function AddEditPolicyModal({ policy: init, incomeMonthly, onSave, onClose, t }) {
  const isNew = !init?.id;
  const [form, setForm] = useState(init || {
    type:"life", name:"", carrier:"", policyNumber:"", agentName:"", agentPhone:"", agentEmail:"",
    source:"personal", coverageAmount:"", isApproximate:false, premium:"", premiumFrequency:"monthly",
    startDate:"", endDate:"", notes:"", color:COLOR.primary,
    beneficiaries:[{name:"",relationship:"",percentage:100}],
    monthlyBenefit:"", eliminationDays:"", benefitPeriod:"",
    planType:"", deductible:"", outOfPocketMax:"", familyCoverage:false,
    vehicles:[], liabilityLimit:"", dwellingCoverage:"", liabilityCoverage:"",
  });

  function set(k,v) { setForm(f=>({...f,[k]:v})); }
  function setBene(i,k,v) {
    setForm(f => { const b=[...f.beneficiaries]; b[i]={...b[i],[k]:v}; return {...f,beneficiaries:b}; });
  }
  function addBene() {
    setForm(f=>({...f,beneficiaries:[...f.beneficiaries,{name:"",relationship:"",percentage:0}]}));
  }
  function removeBene(i) {
    setForm(f=>({...f,beneficiaries:f.beneficiaries.filter((_,j)=>j!==i)}));
  }
  function applyLifeMult(mult) {
    set("coverageAmount", Math.round(incomeMonthly*12*mult).toString());
    set("isApproximate", true);
  }
  function applyDisMult(pct) {
    set("monthlyBenefit", Math.round(incomeMonthly*pct).toString());
    set("isApproximate", true);
  }
  function submit() {
    if (!form.name.trim()) return;
    onSave({
      ...form,
      id: form.id || generateId(),
      coverageAmount:  toNum(form.coverageAmount),
      premium:         toNum(form.premium),
      monthlyBenefit:  toNum(form.monthlyBenefit),
      deductible:      toNum(form.deductible),
      outOfPocketMax:  toNum(form.outOfPocketMax),
      dwellingCoverage:toNum(form.dwellingCoverage),
      liabilityCoverage:toNum(form.liabilityCoverage),
    });
  }

  const inp = {background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",
    color:t.tx1,fontSize:13,boxSizing:"border-box",outline:"none"};

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      <div style={{...cardSt(t),maxWidth:580,width:"100%",padding:24,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{fontSize:17,fontWeight:800,color:t.tx1,marginBottom:16}}>
          {isNew?"Add Policy":"Edit Policy"}
        </div>

        {/* Type */}
        <label style={labelSt(t)}>Policy Type</label>
        <select value={form.type} onChange={e=>set("type",e.target.value)}
          style={{...inp,width:"100%",marginBottom:12}}>
          {POLICY_TYPES.map(ty=>(
            <option key={ty} value={ty}>{POLICY_LABELS[ty]}</option>
          ))}
        </select>

        {/* Quick multipliers — life */}
        {form.type==="life" && incomeMonthly > 0 && (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:t.tx2,marginBottom:6,fontWeight:600}}>Quick — Employer Estimate</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[1,2,3].map(m => (
                <button key={m} onClick={()=>applyLifeMult(m)}
                  style={btnGhost(t,{padding:"4px 10px",fontSize:12})}>
                  {m}× salary ≈ {fmt$k(incomeMonthly*12*m)}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Quick multipliers — disability */}
        {form.type==="disability" && incomeMonthly > 0 && (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:t.tx2,marginBottom:6,fontWeight:600}}>Quick — Employer Estimate</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[0.5,0.6,0.7].map(p => (
                <button key={p} onClick={()=>applyDisMult(p)}
                  style={btnGhost(t,{padding:"4px 10px",fontSize:12})}>
                  {Math.round(p*100)}% ≈ ${fmt$(incomeMonthly*p)}/mo
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Core fields — always shown */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 12px",marginBottom:12}}>
          <div>
            <label style={labelSt(t)}>Policy Name *</label>
            <input value={form.name} onChange={e=>set("name",e.target.value)}
              placeholder="e.g. Term Life — Protective" style={{...inp,width:"100%"}}/>
          </div>
          <div>
            <label style={labelSt(t)}>Carrier</label>
            <input value={form.carrier} onChange={e=>set("carrier",e.target.value)}
              placeholder="Carrier name" style={{...inp,width:"100%"}}/>
          </div>
          <div>
            <label style={labelSt(t)}>Policy Number</label>
            <input value={form.policyNumber} onChange={e=>set("policyNumber",e.target.value)}
              placeholder="TL-123456" style={{...inp,width:"100%"}}/>
          </div>
          <div>
            <label style={labelSt(t)}>Source</label>
            <select value={form.source} onChange={e=>set("source",e.target.value)} style={{...inp,width:"100%"}}>
              <option value="personal">Personal</option>
              <option value="employer">Employer</option>
              <option value="government">Government</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Life / Umbrella / Other — coverage amount */}
        {(form.type==="life"||form.type==="umbrella"||form.type==="other") && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 12px",marginBottom:12}}>
            <div>
              <label style={labelSt(t)}>
                Coverage Amount
                {form.isApproximate && <span style={{color:COLOR.warning}}> (~approx)</span>}
              </label>
              <input type="number" value={form.coverageAmount}
                onChange={e=>set("coverageAmount",e.target.value)}
                placeholder="500000" style={{...inp,width:"100%"}}/>
            </div>
          </div>
        )}

        {/* Disability-specific */}
        {form.type==="disability" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px 12px",marginBottom:12}}>
            <div>
              <label style={labelSt(t)}>
                Monthly Benefit
                {form.isApproximate && <span style={{color:COLOR.warning}}> (~)</span>}
              </label>
              <input type="number" value={form.monthlyBenefit}
                onChange={e=>set("monthlyBenefit",e.target.value)}
                placeholder="4500" style={{...inp,width:"100%"}}/>
            </div>
            <div>
              <label style={labelSt(t)}>Elimination Days</label>
              <select value={form.eliminationDays} onChange={e=>set("eliminationDays",e.target.value)}
                style={{...inp,width:"100%"}}>
                <option value="">—</option>
                {[30,60,90,180].map(d=><option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt(t)}>Benefit Period</label>
              <select value={form.benefitPeriod} onChange={e=>set("benefitPeriod",e.target.value)}
                style={{...inp,width:"100%"}}>
                <option value="">—</option>
                <option value="short_term">Short-term</option>
                <option value="long_term">Long-term</option>
                <option value="to_age_65">To age 65</option>
              </select>
            </div>
          </div>
        )}

        {/* Health-specific */}
        {form.type==="health" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 12px",marginBottom:12}}>
            <div>
              <label style={labelSt(t)}>Plan Type</label>
              <select value={form.planType} onChange={e=>set("planType",e.target.value)}
                style={{...inp,width:"100%"}}>
                <option value="">—</option>
                {["HMO","PPO","HDHP","EPO","Other"].map(p=>(
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelSt(t)}>Deductible</label>
              <input type="number" value={form.deductible} onChange={e=>set("deductible",e.target.value)}
                placeholder="1500" style={{...inp,width:"100%"}}/>
            </div>
            <div>
              <label style={labelSt(t)}>Out-of-Pocket Max</label>
              <input type="number" value={form.outOfPocketMax} onChange={e=>set("outOfPocketMax",e.target.value)}
                placeholder="7500" style={{...inp,width:"100%"}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:18}}>
              <input type="checkbox" id="famcov" checked={!!form.familyCoverage}
                onChange={e=>set("familyCoverage",e.target.checked)}/>
              <label htmlFor="famcov" style={{fontSize:13,color:t.tx1,cursor:"pointer"}}>Family Coverage</label>
            </div>
          </div>
        )}

        {/* Auto-specific */}
        {form.type==="auto" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 12px",marginBottom:12}}>
            <div>
              <label style={labelSt(t)}>Coverage Amount</label>
              <input type="number" value={form.coverageAmount}
                onChange={e=>set("coverageAmount",e.target.value)}
                placeholder="100000" style={{...inp,width:"100%"}}/>
            </div>
            <div>
              <label style={labelSt(t)}>Liability Limit</label>
              <input value={form.liabilityLimit} onChange={e=>set("liabilityLimit",e.target.value)}
                placeholder="100/300/100" style={{...inp,width:"100%"}}/>
            </div>
          </div>
        )}

        {/* Home / Renters-specific */}
        {(form.type==="home"||form.type==="renters") && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 12px",marginBottom:12}}>
            <div>
              <label style={labelSt(t)}>Dwelling Coverage</label>
              <input type="number" value={form.dwellingCoverage}
                onChange={e=>set("dwellingCoverage",e.target.value)}
                placeholder="350000" style={{...inp,width:"100%"}}/>
            </div>
            <div>
              <label style={labelSt(t)}>Liability Coverage</label>
              <input type="number" value={form.liabilityCoverage}
                onChange={e=>set("liabilityCoverage",e.target.value)}
                placeholder="100000" style={{...inp,width:"100%"}}/>
            </div>
          </div>
        )}

        {/* Premium — all types */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 12px",marginBottom:12}}>
          <div>
            <label style={labelSt(t)}>Premium</label>
            <input type="number" value={form.premium} onChange={e=>set("premium",e.target.value)}
              placeholder="87.50" style={{...inp,width:"100%"}}/>
          </div>
          <div>
            <label style={labelSt(t)}>Frequency</label>
            <select value={form.premiumFrequency} onChange={e=>set("premiumFrequency",e.target.value)}
              style={{...inp,width:"100%"}}>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
          <div>
            <label style={labelSt(t)}>Start Date</label>
            <input type="date" value={form.startDate||""} onChange={e=>set("startDate",e.target.value)}
              style={{...inp,width:"100%"}}/>
          </div>
          <div>
            <label style={labelSt(t)}>End Date (blank = permanent)</label>
            <input type="date" value={form.endDate||""} onChange={e=>set("endDate",e.target.value)}
              style={{...inp,width:"100%"}}/>
          </div>
        </div>

        {/* Agent info */}
        <div style={{fontSize:13,fontWeight:700,color:t.tx2,marginBottom:8}}>Agent / Contact Info</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px 12px",marginBottom:12}}>
          <div>
            <label style={labelSt(t)}>Agent Name</label>
            <input value={form.agentName} onChange={e=>set("agentName",e.target.value)}
              placeholder="Jane Smith" style={{...inp,width:"100%"}}/>
          </div>
          <div>
            <label style={labelSt(t)}>Agent Phone</label>
            <input value={form.agentPhone} onChange={e=>set("agentPhone",e.target.value)}
              placeholder="(555) 555-5555" style={{...inp,width:"100%"}}/>
          </div>
          <div>
            <label style={labelSt(t)}>Agent Email</label>
            <input value={form.agentEmail} onChange={e=>set("agentEmail",e.target.value)}
              placeholder="agent@email.com" style={{...inp,width:"100%"}}/>
          </div>
        </div>

        {/* Beneficiaries — life only */}
        {form.type==="life" && (
          <div style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:700,color:t.tx2}}>Beneficiaries</div>
              <button onClick={addBene} style={btnGhost(t,{padding:"3px 10px",fontSize:12})}>+ Add</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"auto auto auto auto",gap:4,marginBottom:4}}>
              {["Full Name","Relationship","% Share",""].map((h,i)=>(
                <div key={i} style={{fontSize:10,color:t.tx3,fontWeight:600,padding:"0 2px"}}>{h}</div>
              ))}
            </div>
            {form.beneficiaries.map((b,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:4,marginBottom:4}}>
                <input value={b.name} onChange={e=>setBene(i,"name",e.target.value)}
                  placeholder="Full name" style={{...inp,padding:"6px 8px"}}/>
                <input value={b.relationship} onChange={e=>setBene(i,"relationship",e.target.value)}
                  placeholder="Spouse" style={{...inp,padding:"6px 8px"}}/>
                <input type="number" value={b.percentage}
                  onChange={e=>setBene(i,"percentage",toNum(e.target.value))}
                  placeholder="100" style={{...inp,padding:"6px 8px"}}/>
                {i>0 ? (
                  <button onClick={()=>removeBene(i)} style={{background:"none",border:"none",
                    color:COLOR.danger,cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>
                ) : <div/>}
              </div>
            ))}
          </div>
        )}

        {/* Notes + Color */}
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,marginBottom:16}}>
          <div>
            <label style={labelSt(t)}>Notes</label>
            <input value={form.notes} onChange={e=>set("notes",e.target.value)}
              placeholder="Optional notes" style={{...inp,width:"100%"}}/>
          </div>
          <div>
            <label style={labelSt(t)}>Color</label>
            <input type="color" value={form.color} onChange={e=>set("color",e.target.value)}
              style={{height:38,width:48,border:`1px solid ${t.border}`,borderRadius:8,
                cursor:"pointer",background:"none",display:"block"}}/>
          </div>
        </div>

        <div style={{display:"flex",gap:8}}>
          <button onClick={submit} style={{...btnPrimary(),flex:1}}>
            {isNew?"Add Policy":"Save Changes"}
          </button>
          <button onClick={onClose} style={{...btnGhost(t),flex:1}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── PolicyCard ────────────────────────────────────────────────────────────────
function PolicyCard({ policy: p, onEdit, onDelete, t }) {
  const days    = daysUntil(p.endDate);
  const expiring = p.endDate && days !== null && days >= 0 && days <= 90;
  const expired  = p.endDate && days !== null && days < 0;
  const srcLabel = { personal:"Personal", employer:"Employer", government:"Government", other:"Other" };
  const srcColor = { personal:COLOR.primary, employer:COLOR.blue, government:COLOR.success, other:t.tx3 };

  return (
    <div style={{...cardSt(t),position:"relative",borderLeft:`4px solid ${p.color||COLOR.primary}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:t.tx1}}>{p.name}</div>
          {p.carrier && <div style={{fontSize:12,color:t.tx2}}>{p.carrier}</div>}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span style={pillSt(srcColor[p.source]||COLOR.primary)}>
            {srcLabel[p.source]||"Personal"}
          </span>
          <button onClick={()=>onEdit(p)}
            style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:14,padding:"2px 5px"}}>
            ✏️
          </button>
          <button onClick={()=>onDelete(p.id)}
            style={{background:"none",border:"none",color:COLOR.danger,cursor:"pointer",fontSize:14,padding:"2px 5px"}}>
            🗑
          </button>
        </div>
      </div>

      <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-start"}}>
        {p.type==="disability" && (p.monthlyBenefit > 0) && (
          <div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>MONTHLY BENEFIT</div>
            <div style={{fontSize:16,fontWeight:800,color:t.tx1,fontFamily:"monospace"}}>
              {p.isApproximate?"~":""}${fmt$(p.monthlyBenefit)}/mo
            </div>
          </div>
        )}
        {p.type!=="disability" && (p.coverageAmount > 0 || p.dwellingCoverage > 0) && (
          <div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>COVERAGE</div>
            <div style={{fontSize:16,fontWeight:800,color:t.tx1,fontFamily:"monospace"}}>
              {p.isApproximate?"~":""}
              {p.dwellingCoverage > 0 ? fmt$k(p.dwellingCoverage) : fmt$k(p.coverageAmount)}
            </div>
          </div>
        )}
        {p.premium > 0 && (
          <div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>PREMIUM</div>
            <div style={{fontSize:14,fontWeight:700,color:t.tx2,fontFamily:"monospace"}}>
              ${fmt$(p.premium)}{fmtFreq(p.premiumFrequency)}
            </div>
          </div>
        )}
        {p.type==="health" && p.planType && (
          <div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>PLAN TYPE</div>
            <div style={{fontSize:13,color:t.tx1,fontWeight:600}}>{p.planType}</div>
          </div>
        )}
        {p.type==="health" && p.deductible > 0 && (
          <div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>DEDUCTIBLE</div>
            <div style={{fontSize:13,color:t.tx1,fontFamily:"monospace"}}>${fmt$(p.deductible)}</div>
          </div>
        )}
        {p.type==="auto" && p.liabilityLimit && (
          <div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>LIABILITY</div>
            <div style={{fontSize:13,color:t.tx1,fontFamily:"monospace"}}>{p.liabilityLimit}</div>
          </div>
        )}
        {p.type==="disability" && p.benefitPeriod && (
          <div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>BENEFIT PERIOD</div>
            <div style={{fontSize:12,color:t.tx1}}>{p.benefitPeriod.replace("_"," ")}</div>
          </div>
        )}
      </div>

      {p.type==="life" && p.beneficiaries?.filter(b=>b.name).length > 0 && (
        <div style={{marginTop:8,fontSize:11,color:t.tx2}}>
          <span style={{color:t.tx3}}>Beneficiaries: </span>
          {p.beneficiaries.filter(b=>b.name).map(b=>`${b.name} (${b.percentage}%)`).join(" · ")}
        </div>
      )}

      {(expiring||expired) && (
        <div style={{marginTop:8,display:"inline-block",...pillSt(expired||days<=30?COLOR.danger:COLOR.warning)}}>
          {expired?"⚠ Expired":`⚠ Expires in ${days}d`}
        </div>
      )}
    </div>
  );
}

// ── CoverageTab ───────────────────────────────────────────────────────────────
function CoverageTab({ policies, targets, incomeMonthly, onAdd, onEdit, onDelete, t }) {
  const presentTypes = POLICY_TYPES.filter(ty => policies.some(p=>p.type===ty));
  const annualIncome = incomeMonthly * 12;
  const lifeTotal   = policies.filter(p=>p.type==="life").reduce((s,p)=>s+(p.coverageAmount||0),0);
  const lifeTarget  = targets?.life || (annualIncome>0 ? annualIncome*10 : null);
  const disTotal    = policies.filter(p=>p.type==="disability").reduce((s,p)=>s+(p.monthlyBenefit||0),0);
  const disTarget   = targets?.disability || (incomeMonthly>0 ? incomeMonthly*0.6 : null);
  const hasHealth   = policies.some(p=>p.type==="health");
  const hasAuto     = policies.some(p=>p.type==="auto");

  return (
    <div>
      {/* No income advisory */}
      {incomeMonthly === 0 && (
        <div style={{...cardSt(t),marginBottom:12,borderColor:COLOR.warning+"55",
          background:COLOR.warning+"08",padding:"10px 16px"}}>
          <div style={{fontSize:12,color:COLOR.warning}}>
            ⚠ Add income streams in IncomeTracker for accurate coverage targets
          </div>
        </div>
      )}

      {/* Coverage summary */}
      {policies.length > 0 && (
        <div style={{...cardSt(t),marginBottom:20}}>
          <div style={{fontSize:14,fontWeight:800,color:t.tx1,marginBottom:12}}>Coverage Summary</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {lifeTarget && (
              <div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                  <span style={{color:t.tx2}}>
                    Life — {policies.some(p=>p.type==="life"&&p.isApproximate)&&"~"}
                    {fmt$k(lifeTotal)} of {fmt$k(lifeTarget)} target
                  </span>
                  {lifeTotal>=lifeTarget
                    ? <span style={{color:COLOR.success,fontWeight:700}}>✓ Covered</span>
                    : <span style={{color:COLOR.warning,fontWeight:700}}>gap {fmt$k(lifeTarget-lifeTotal)}</span>}
                </div>
                <div style={{height:6,background:t.surf,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:3,transition:"width .4s",
                    width:`${Math.min((lifeTotal/lifeTarget)*100,100)}%`,
                    background:lifeTotal>=lifeTarget?COLOR.success:COLOR.primary}}/>
                </div>
              </div>
            )}
            {disTarget && (
              <div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                  <span style={{color:t.tx2}}>
                    Disability — ${fmt$(disTotal)}/mo of ${fmt$(disTarget)}/mo target
                  </span>
                  {disTotal>=disTarget
                    ? <span style={{color:COLOR.success,fontWeight:700}}>✓ Covered</span>
                    : <span style={{color:COLOR.warning,fontWeight:700}}>gap ${fmt$(disTarget-disTotal)}/mo</span>}
                </div>
                <div style={{height:6,background:t.surf,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:3,transition:"width .4s",
                    width:`${Math.min((disTotal/disTarget)*100,100)}%`,
                    background:disTotal>=disTarget?COLOR.success:COLOR.blue}}/>
                </div>
              </div>
            )}
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <span style={pillSt(hasHealth?COLOR.success:COLOR.warning)}>
                🏥 Health {hasHealth?"✓":"⚠ Not covered"}
              </span>
              <span style={pillSt(hasAuto?COLOR.success:COLOR.warning)}>
                🚗 Auto {hasAuto?"✓":"⚠ Not covered"}
              </span>
            </div>
          </div>
        </div>
      )}

      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
        <button onClick={onAdd} style={btnPrimary()}>+ Add Policy</button>
      </div>

      {presentTypes.length === 0 && (
        <div style={{textAlign:"center",padding:"56px 0",color:t.tx3}}>
          <div style={{fontSize:44,marginBottom:12}}>🛡️</div>
          <div style={{fontSize:15,fontWeight:600,color:t.tx2,marginBottom:6}}>No policies yet</div>
          <div style={{fontSize:13}}>Add your first policy to get started.</div>
        </div>
      )}

      {presentTypes.map(ty => (
        <div key={ty} style={{marginBottom:20}}>
          <div style={{fontSize:12,fontWeight:700,color:TYPE_COLORS[ty]||COLOR.primary,
            marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>
            {POLICY_LABELS[ty]}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {policies.filter(p=>p.type===ty).map(p => (
              <PolicyCard key={p.id} policy={p} onEdit={onEdit} onDelete={onDelete} t={t}/>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── BeneficiariesTab ──────────────────────────────────────────────────────────
function BeneficiariesTab({ policies, t }) {
  const lifePolicies = policies.filter(p=>p.type==="life"&&p.beneficiaries?.length);
  const byPerson = {};
  lifePolicies.forEach(pol => {
    pol.beneficiaries.forEach(b => {
      if (!b.name) return;
      const key = b.name.toLowerCase().trim();
      if (!byPerson[key]) byPerson[key] = {name:b.name, relationship:b.relationship, entries:[]};
      byPerson[key].entries.push({
        policy:  pol.name,
        coverage:pol.coverageAmount||0,
        percentage:b.percentage,
        receives:Math.round((pol.coverageAmount||0)*(b.percentage/100)),
      });
    });
  });
  const people = Object.values(byPerson);

  if (people.length === 0) {
    return (
      <div style={{textAlign:"center",padding:"56px 0",color:t.tx3}}>
        <div style={{fontSize:44,marginBottom:12}}>👥</div>
        <div style={{fontSize:14,fontWeight:600,color:t.tx2,marginBottom:6}}>No beneficiaries added yet</div>
        <div style={{fontSize:13}}>Add life insurance policies to see beneficiaries here.</div>
      </div>
    );
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {people.map((person,i) => (
        <div key={i} style={cardSt(t)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:t.tx1}}>{person.name}</div>
              {person.relationship && (
                <div style={{fontSize:12,color:t.tx2}}>{person.relationship}</div>
              )}
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:10,color:t.tx3,fontWeight:600}}>TOTAL RECEIVES</div>
              <div style={{fontSize:20,fontWeight:800,color:COLOR.success,fontFamily:"monospace"}}>
                {fmt$k(person.entries.reduce((s,e)=>s+e.receives,0))}
              </div>
            </div>
          </div>
          {person.entries.map((e,j) => (
            <div key={j} style={{display:"flex",justifyContent:"space-between",
              padding:"6px 0",borderTop:`1px solid ${t.border}`,fontSize:12}}>
              <span style={{color:t.tx2}}>{e.policy}</span>
              <span style={{color:t.tx1,fontFamily:"monospace"}}>
                {e.percentage}% of {fmt$k(e.coverage)} = {fmt$k(e.receives)}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── EmergencyTab ──────────────────────────────────────────────────────────────
function EmergencyTab({ policies, t }) {
  function exportTxt() {
    const lines = [
      "INSURANCE EMERGENCY INFORMATION",
      "================================",
      `Generated: ${new Date().toLocaleDateString()}`,
      "",
    ];
    policies.forEach(p => {
      lines.push(`${POLICY_LABELS[p.type].toUpperCase()}: ${p.name}`);
      if (p.carrier)      lines.push(`  Carrier:         ${p.carrier}`);
      if (p.policyNumber) lines.push(`  Policy #:        ${p.policyNumber}`);
      if (p.agentName)    lines.push(`  Agent:           ${p.agentName}`);
      if (p.agentPhone)   lines.push(`  Agent Phone:     ${p.agentPhone}`);
      if (p.agentEmail)   lines.push(`  Agent Email:     ${p.agentEmail}`);
      if (p.type==="disability" && p.monthlyBenefit>0)
        lines.push(`  Monthly Benefit: $${fmt$(p.monthlyBenefit)}/mo`);
      else if (p.coverageAmount>0)
        lines.push(`  Coverage:        ${p.isApproximate?"~":""}$${fmt$(p.coverageAmount)}`);
      if (p.type==="life" && p.beneficiaries?.length) {
        lines.push(`  Beneficiaries:`);
        p.beneficiaries.filter(b=>b.name).forEach(b =>
          lines.push(`    - ${b.name} (${b.relationship||"—"}) ${b.percentage}%`)
        );
      }
      if (p.endDate) lines.push(`  Expires:         ${fmtDate(p.endDate)}`);
      if (p.notes)   lines.push(`  Notes:           ${p.notes}`);
      lines.push("");
    });
    downloadFile(lines.join("\n"), "insurance-emergency-info.txt", "text/plain");
  }

  if (policies.length === 0) {
    return (
      <div style={{textAlign:"center",padding:"56px 0",color:t.tx3}}>
        <div style={{fontSize:44,marginBottom:12}}>📋</div>
        <div style={{fontSize:14,fontWeight:600,color:t.tx2}}>No policies to display</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{...cardSt(t),marginBottom:16,background:COLOR.blue+"10",borderColor:COLOR.blue+"33",padding:"10px 16px"}}>
        <div style={{fontSize:13,color:COLOR.blue,fontWeight:600}}>
          📢 Share this page with a trusted family member or store it somewhere they can find it.
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <button onClick={()=>window.print()} style={btnGhost(t)}>🖨️ Print</button>
        <button onClick={exportTxt} style={btnGhost(t)}>⬇ Download .txt</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {policies.map((p,i) => (
          <div key={i} style={{...cardSt(t),borderLeft:`4px solid ${p.color||TYPE_COLORS[p.type]||COLOR.primary}`}}>
            <div style={{fontSize:14,fontWeight:800,color:t.tx1,marginBottom:8}}>
              {POLICY_LABELS[p.type]} — {p.name}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px 16px",fontSize:13}}>
              {p.carrier && (
                <div>
                  <span style={{color:t.tx3}}>Carrier: </span>
                  <span style={{color:t.tx1,fontWeight:600}}>{p.carrier}</span>
                </div>
              )}
              {p.policyNumber && (
                <div>
                  <span style={{color:t.tx3}}>Policy #: </span>
                  <span style={{color:t.tx1,fontFamily:"monospace"}}>{p.policyNumber}</span>
                </div>
              )}
              {p.agentName && (
                <div>
                  <span style={{color:t.tx3}}>Agent: </span>
                  <span style={{color:t.tx1}}>{p.agentName}</span>
                </div>
              )}
              {p.agentPhone && (
                <div>
                  <span style={{color:t.tx3}}>Phone: </span>
                  <a href={`tel:${p.agentPhone}`} style={{color:COLOR.primary}}>{p.agentPhone}</a>
                </div>
              )}
              {p.agentEmail && (
                <div style={{gridColumn:"1/-1"}}>
                  <span style={{color:t.tx3}}>Email: </span>
                  <a href={`mailto:${p.agentEmail}`} style={{color:COLOR.primary}}>{p.agentEmail}</a>
                </div>
              )}
              {p.type==="disability" && p.monthlyBenefit>0 && (
                <div>
                  <span style={{color:t.tx3}}>Monthly Benefit: </span>
                  <span style={{color:t.tx1,fontFamily:"monospace",fontWeight:700}}>${fmt$(p.monthlyBenefit)}/mo</span>
                </div>
              )}
              {p.type!=="disability" && p.coverageAmount>0 && (
                <div>
                  <span style={{color:t.tx3}}>Coverage: </span>
                  <span style={{color:t.tx1,fontFamily:"monospace",fontWeight:700}}>
                    {p.isApproximate?"~":""}${fmt$(p.coverageAmount)}
                  </span>
                </div>
              )}
              {p.endDate && (
                <div>
                  <span style={{color:t.tx3}}>Expires: </span>
                  <span style={{color:t.tx1}}>{fmtDate(p.endDate)}</span>
                </div>
              )}
            </div>
            {p.type==="life" && p.beneficiaries?.filter(b=>b.name).length>0 && (
              <div style={{marginTop:8,fontSize:12,color:t.tx2}}>
                <span style={{color:t.tx3}}>Beneficiaries: </span>
                {p.beneficiaries.filter(b=>b.name)
                  .map(b=>`${b.name} (${b.relationship||"—"}) ${b.percentage}%`).join(" · ")}
              </div>
            )}
            {p.notes && (
              <div style={{marginTop:6,fontSize:12,color:t.tx2,fontStyle:"italic"}}>{p.notes}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AnalysisTab ───────────────────────────────────────────────────────────────
function AnalysisTab({ policies, targets, incomeMonthly, apiKey, aiResults, onAiResult, t }) {
  const [dependents, setDependents] = useState(0);
  const [age, setAge]               = useState("");
  const [quotes, setQuotes]         = useState([
    {carrier:"",type:"",coverage:"",premium:"",term:""},
    {carrier:"",type:"",coverage:"",premium:"",term:""},
    {carrier:"",type:"",coverage:"",premium:"",term:""},
  ]);
  const [loading, setLoading] = useState({gap:false,term:false,quote:false});
  const [errors, setErrors]   = useState({gap:"",term:"",quote:""});

  function setLoad(k,v) { setLoading(l=>({...l,[k]:v})); }
  function setErr(k,v)  { setErrors(e=>({...e,[k]:v})); }
  function setQ(i,k,v)  { setQuotes(qs=>{const n=[...qs]; n[i]={...n[i],[k]:v}; return n;}); }

  function copyResult(text)           { navigator.clipboard?.writeText(text); }
  function downloadResult(text, name) { downloadFile(text, `${name}-${Date.now()}.txt`, "text/plain"); }

  async function runGapAnalysis() {
    if (!apiKey) { setErr("gap","No API key set. Add one via the 🔑 button."); return; }
    setLoad("gap",true); setErr("gap","");
    const annualIncome = incomeMonthly * 12;
    const lifeTotal    = policies.filter(p=>p.type==="life").reduce((s,p)=>s+(p.coverageAmount||0),0);
    const lifeTarget   = targets?.life || annualIncome * 10;
    const disTotal     = policies.filter(p=>p.type==="disability").reduce((s,p)=>s+(p.monthlyBenefit||0),0);
    const disTarget    = targets?.disability || incomeMonthly * 0.6;
    const prompt = `You are a financial advisor reviewing my insurance coverage.
Annual income: $${fmt$(annualIncome)}
Number of dependents: ${dependents}
Life insurance total: $${fmt$(lifeTotal)} (target: $${fmt$(lifeTarget)})
Disability monthly benefit: $${fmt$(disTotal)}/mo (target: $${fmt$(disTarget)}/mo)
Health insurance: ${policies.some(p=>p.type==="health")?"Yes":"No"}
Auto insurance: ${policies.some(p=>p.type==="auto")?"Yes":"No"}
Home/Renters: ${policies.some(p=>p.type==="home"||p.type==="renters")?"Yes":"No"}

Please:
1. Summarize my current coverage status
2. Identify the most critical coverage gaps
3. Estimate monthly cost range to close each gap (general ranges, not quotes)
4. Prioritize which gap to close first given my situation
Keep your response clear and actionable, under 500 words.`;
    try {
      const res  = await callClaude(apiKey, {model:MODEL,max_tokens:1024,messages:[{role:"user",content:prompt}]});
      const data = await res.json();
      onAiResult("gapAnalysis", data.content[0].text);
    } catch(e) { setErr("gap",`Error: ${e.message}`); }
    setLoad("gap",false);
  }

  async function runTermAnalysis() {
    if (!apiKey) { setErr("term","No API key set."); return; }
    setLoad("term",true); setErr("term","");
    const lifeTotal = policies.filter(p=>p.type==="life").reduce((s,p)=>s+(p.coverageAmount||0),0);
    const lifeNames = [...new Set(policies.filter(p=>p.type==="life").map(p=>p.name||"Life"))].join(", ");
    const prompt = `You are a financial advisor. Should I have term or permanent life insurance?
${age?`My age: ${age}`:""}
Current life insurance: ${lifeTotal>0?`$${fmt$(lifeTotal)} (${lifeNames})`:"None"}
Annual income: $${fmt$(incomeMonthly*12)}

Please:
- Explain the tradeoffs of term vs. permanent given my situation
- Give a clear recommendation with reasoning
- Note what circumstances might change the recommendation
Under 400 words.`;
    try {
      const res  = await callClaude(apiKey, {model:MODEL,max_tokens:1024,messages:[{role:"user",content:prompt}]});
      const data = await res.json();
      onAiResult("termVsPermanent", data.content[0].text);
    } catch(e) { setErr("term",`Error: ${e.message}`); }
    setLoad("term",false);
  }

  async function runQuoteComparison() {
    if (!apiKey) { setErr("quote","No API key set."); return; }
    const valid = quotes.filter(q=>q.carrier&&q.coverage&&q.premium);
    if (valid.length < 2) { setErr("quote","Enter at least 2 complete quotes."); return; }
    setLoad("quote",true); setErr("quote","");
    const quoteText = valid.map((q,i) =>
      `Quote ${i+1}: ${q.carrier} — ${q.type||"Life"}, $${fmt$(toNum(q.coverage))} coverage, $${fmt$(toNum(q.premium))}/yr${q.term?`, ${q.term}-year term`:""}`
    ).join("\n");
    const prompt = `Compare these insurance quotes:
${quoteText}

Please:
1. Calculate cost per $1,000 of coverage for each
2. Show total premium over the full term
3. Identify which aligns best with typical coverage needs
4. Note any red flags or important considerations
Under 350 words.`;
    try {
      const res  = await callClaude(apiKey, {model:MODEL,max_tokens:1024,messages:[{role:"user",content:prompt}]});
      const data = await res.json();
      onAiResult("quoteComparison", data.content[0].text);
    } catch(e) { setErr("quote",`Error: ${e.message}`); }
    setLoad("quote",false);
  }

  const qInp = {background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 10px",
    color:t.tx1,fontSize:12,boxSizing:"border-box",outline:"none"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Coverage Gap Analysis */}
      <div style={cardSt(t)}>
        <div style={{fontSize:15,fontWeight:800,color:t.tx1,marginBottom:4}}>Coverage Gap Analysis</div>
        <div style={{fontSize:12,color:t.tx2,marginBottom:12}}>
          Identifies critical gaps and estimates the monthly cost to close them.
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <label style={{fontSize:12,color:t.tx2}}>Number of dependents:</label>
          <input type="number" value={dependents} min={0}
            onChange={e=>setDependents(toNum(e.target.value))}
            style={{...qInp,width:70}}/>
        </div>
        <button onClick={runGapAnalysis} disabled={loading.gap}
          style={btnPrimary(loading.gap?{opacity:.65,cursor:"not-allowed"}:{})}>
          {loading.gap?"Analyzing…":"Analyze My Coverage"}
        </button>
        {errors.gap && <div style={{fontSize:12,color:COLOR.danger,marginTop:8}}>{errors.gap}</div>}
        <AiResultBox text={aiResults.gapAnalysis} ts={aiResults.gapAnalysisTs}
          name="gap-analysis" onCopy={copyResult} onDownload={downloadResult} t={t}/>
      </div>

      {/* Term vs Permanent */}
      <div style={cardSt(t)}>
        <div style={{fontSize:15,fontWeight:800,color:t.tx1,marginBottom:4}}>
          Term vs. Permanent Life Insurance
        </div>
        <div style={{fontSize:12,color:t.tx2,marginBottom:12}}>
          Get a tailored recommendation based on your financial situation.
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <label style={{fontSize:12,color:t.tx2}}>Your age (optional):</label>
          <input type="number" value={age} onChange={e=>setAge(e.target.value)}
            placeholder="35" style={{...qInp,width:70}}/>
        </div>
        <button onClick={runTermAnalysis} disabled={loading.term}
          style={btnPrimary(loading.term?{opacity:.65,cursor:"not-allowed"}:{})}>
          {loading.term?"Analyzing…":"Should I Have Term or Permanent?"}
        </button>
        {errors.term && <div style={{fontSize:12,color:COLOR.danger,marginTop:8}}>{errors.term}</div>}
        <AiResultBox text={aiResults.termVsPermanent} ts={aiResults.termVsPermanentTs}
          name="term-vs-permanent" onCopy={copyResult} onDownload={downloadResult} t={t}/>
      </div>

      {/* Quote Comparison */}
      <div style={cardSt(t)}>
        <div style={{fontSize:15,fontWeight:800,color:t.tx1,marginBottom:4}}>Quote Comparison</div>
        <div style={{fontSize:12,color:t.tx2,marginBottom:12}}>
          Enter up to 3 quotes. AI will compare cost-per-$1K, total premium, and red flags.
        </div>
        <div style={{overflowX:"auto",marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",gap:6,minWidth:480}}>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600,padding:"0 2px"}}>Carrier</div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600,padding:"0 2px"}}>Type</div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600,padding:"0 2px"}}>Coverage $</div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600,padding:"0 2px"}}>Annual $</div>
            <div style={{fontSize:10,color:t.tx3,fontWeight:600,padding:"0 2px"}}>Term (yrs)</div>
            {quotes.map((q,i) => (
              <div key={i} style={{display:"contents"}}>
                <input value={q.carrier} onChange={e=>setQ(i,"carrier",e.target.value)}
                  placeholder={`Carrier ${i+1}`} style={qInp}/>
                <input value={q.type}    onChange={e=>setQ(i,"type",e.target.value)}
                  placeholder="Life" style={qInp}/>
                <input type="number" value={q.coverage} onChange={e=>setQ(i,"coverage",e.target.value)}
                  placeholder="500000" style={qInp}/>
                <input type="number" value={q.premium}  onChange={e=>setQ(i,"premium",e.target.value)}
                  placeholder="1200" style={qInp}/>
                <input type="number" value={q.term}     onChange={e=>setQ(i,"term",e.target.value)}
                  placeholder="20" style={qInp}/>
              </div>
            ))}
          </div>
        </div>
        <button onClick={runQuoteComparison} disabled={loading.quote}
          style={btnPrimary(loading.quote?{opacity:.65,cursor:"not-allowed"}:{})}>
          {loading.quote?"Comparing…":"Compare These Quotes"}
        </button>
        {errors.quote && <div style={{fontSize:12,color:COLOR.danger,marginTop:8}}>{errors.quote}</div>}
        <AiResultBox text={aiResults.quoteComparison} ts={aiResults.quoteComparisonTs}
          name="quote-comparison" onCopy={copyResult} onDownload={downloadResult} t={t}/>
      </div>
    </div>
  );
}

// ── SettingsTab ───────────────────────────────────────────────────────────────
function SettingsTab({ hasPin, onSetPin, onChangePin, onRemovePin, t }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={cardSt(t)}>
        <div style={{fontSize:15,fontWeight:800,color:t.tx1,marginBottom:16}}>PIN Lock</div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <div style={{width:10,height:10,borderRadius:"50%",flexShrink:0,
            background:hasPin?COLOR.success:COLOR.warning}}/>
          <span style={{fontSize:13,color:t.tx1}}>
            {hasPin?"PIN is active — your insurance data is protected.":"No PIN set."}
          </span>
        </div>
        {hasPin ? (
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={onChangePin} style={btnGhost(t)}>Change PIN</button>
            <button onClick={onRemovePin}
              style={btnGhost(t,{color:COLOR.danger,borderColor:COLOR.danger+"55"})}>
              Remove PIN
            </button>
          </div>
        ) : (
          <button onClick={onSetPin} style={btnPrimary()}>Set PIN</button>
        )}
      </div>
    </div>
  );
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────
function DeleteConfirmModal({ onConfirm, onClose, t }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{...cardSt(t),maxWidth:360,width:"100%",padding:24,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:8}}>🗑</div>
        <div style={{fontSize:16,fontWeight:800,color:t.tx1,marginBottom:8}}>Delete Policy?</div>
        <div style={{fontSize:13,color:t.tx2,marginBottom:20}}>
          This will permanently remove the policy and update your coverage health.
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onConfirm} style={{...btnPrimary({background:COLOR.danger}),flex:1}}>Delete</button>
          <button onClick={onClose}   style={{...btnGhost(t),flex:1}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [loading, setLoading]             = useState(true);
  const [profiles, setProfiles]           = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [apiKey, setApiKey]               = useState("");
  const [apiKeyStatus, setApiKeyStatus]   = useState("unknown");
  const [darkMode, setDarkMode]           = useState(true);
  const [policies, setPolicies]           = useState([]);
  const [targets, setTargets]             = useState({});
  const [incStreams, setIncStreams]        = useState([]);
  const [aiResults, setAiResults]         = useState({});
  const [tab, setTab]                     = useState("coverage");
  const [showApiModal, setShowApiModal]   = useState(false);
  const [showAddEdit, setShowAddEdit]     = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [showSetPin, setShowSetPin]       = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [showRemovePin, setShowRemovePin] = useState(false);
  const [showRecovery, setShowRecovery]   = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const pinLock = usePinLock("ins");
  const t  = useTheme(darkMode);
  const bp = useBreakpoint();
  const incomeMonthly = calcMonthlyIncome(incStreams);

  useEffect(() => {
    async function init() {
      const profs = await storeGet("cc_profiles", true) || [];
      const actId = await storeGet("cc_active_profile", true);
      const key   = await storeGet("cc_apikey", true);
      setProfiles(profs);
      if (key) { setApiKey(key); probeApiKey(key).then(setApiKeyStatus); }
      const id = actId || profs[0]?.id || null;
      setActiveProfileId(id);
      if (!id) { setLoading(false); return; }

      const [pols, tgts, streams, storedPin, aiRes, dm] = await Promise.all([
        storeGet(`ins_policies_${id}`, true),
        storeGet(`ins_targets_${id}`, true),
        storeGet(`inc_streams_${id}`, true),
        storeGet(`ins_pin_${id}`, true),
        storeGet(`ins_ai_results_${id}`, true),
        storeGet(`ins_dark_${id}`, true),
      ]);

      setPolicies(pols    || []);
      setTargets(tgts     || {});
      setIncStreams(streams|| []);
      setAiResults(aiRes  || {});
      if (dm !== null && dm !== undefined) setDarkMode(dm);

      pinLock.init(storedPin, id);

      // Store legacy health on load
      const mo = calcMonthlyIncome(streams || []);
      const lh = calcLegacyHealth(pols || [], tgts || {}, mo);
      await storeSet(`ins_legacy_health_${id}`, lh, true);

      setLoading(false);
    }
    init();
  }, []);

  async function persistPolicies(next) {
    setPolicies(next);
    if (!activeProfileId) return;
    await storeSet(`ins_policies_${activeProfileId}`, next, true);
    const lh = calcLegacyHealth(next, targets, incomeMonthly);
    await storeSet(`ins_legacy_health_${activeProfileId}`, lh, true);
  }

  async function handleSavePolicy(p) {
    const existing = policies.find(x=>x.id===p.id);
    const next = existing ? policies.map(x=>x.id===p.id?p:x) : [...policies, p];
    await persistPolicies(next);
    setShowAddEdit(null);
  }

  async function handleDeletePolicy() {
    if (!pendingDeleteId) return;
    const next = policies.filter(p=>p.id!==pendingDeleteId);
    await persistPolicies(next);
    setPendingDeleteId(null);
  }

  async function handleAiResult(key, text) {
    const next = {...aiResults, [key]:text, [`${key}Ts`]:Date.now()};
    setAiResults(next);
    if (activeProfileId) await storeSet(`ins_ai_results_${activeProfileId}`, next, true);
  }

  async function handleSetPin(pin) {
    await pinLock.setPin(pin, activeProfileId);
    setShowSetPin(false);
  }
  async function handleChangePin(pin) {
    await pinLock.setPin(pin, activeProfileId);
    setShowChangePin(false);
  }
  async function handleRemovePin() {
    await pinLock.clearPin(activeProfileId);
    setShowRemovePin(false);
  }
  async function handleRecovered() {
    await pinLock.clearPin(activeProfileId);
    setShowRecovery(false);
  }

  function toggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    if (activeProfileId) storeSet(`ins_dark_${activeProfileId}`, next, true);
  }

  function handleExport() {
    downloadFile(
      JSON.stringify({policies, targets, aiResults, exportedAt: new Date().toISOString()}, null, 2),
      `insurance-backup-${Date.now()}.json`,
      "application/json"
    );
  }

  function saveApiKey(k) {
    const trimmed = k.trim();
    setApiKey(trimmed);
    setApiKeyStatus(trimmed.startsWith("sk-ant-")?"valid":trimmed?"invalid":"unknown");
    storeSet("cc_apikey", trimmed, true);
    setShowApiModal(false);
    if (trimmed) probeApiKey(trimmed).then(setApiKeyStatus);
  }

  const activeProfile = profiles.find(p=>p.id===activeProfileId);
  const avatarColor   = AVATAR_COLORS[profiles.indexOf(activeProfile)%AVATAR_COLORS.length]||COLOR.primary;
  const syncColor     = hasCloud()?COLOR.success:COLOR.warning;
  const syncLabel     = hasCloud()?"☁ Cloud Sync":"💾 Local Only";
  const apiDot        = {valid:COLOR.success,invalid:COLOR.danger,unknown:COLOR.warning}[apiKeyStatus];

  const TABS = [
    {key:"coverage",      label:"Coverage"},
    {key:"beneficiaries", label:"Beneficiaries"},
    {key:"emergency",     label:"Emergency Info"},
    {key:"analysis",      label:"Analysis"},
    {key:"settings",      label:"Settings"},
  ];

  if (loading) {
    return (
      <div style={{minHeight:"100vh",background:t.bg,display:"flex",alignItems:"center",
        justifyContent:"center",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
        <div style={{color:t.tx2,fontSize:15}}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif",color:t.tx1}}>
      {/* PIN overlay */}
      {pinLock.locked && pinLock.hasPin && (
        <PinOverlay
          onUnlock={pin => pinLock.unlock(pin, activeProfileId)}
          onForgot={() => setShowRecovery(true)}
          t={t}/>
      )}

      {/* PIN setup banner */}
      {!pinLock.hasPin && !bannerDismissed && !pinLock.locked && (
        <div style={{background:COLOR.purple+"18",borderBottom:`1px solid ${COLOR.purple}33`,
          padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",
          flexWrap:"wrap",gap:8}}>
          <span style={{fontSize:13,color:COLOR.purple,fontWeight:600}}>
            🔐 Protect your insurance data with a PIN lock
          </span>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowSetPin(true)}
              style={btnPrimary({padding:"5px 14px",fontSize:12,background:COLOR.purple})}>
              Set PIN
            </button>
            <button onClick={()=>setBannerDismissed(true)}
              style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:12}}>
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* Nav bar */}
      <div style={{background:t.deepBg,borderBottom:`1px solid ${t.border}`,padding:"11px 20px",
        display:"flex",justifyContent:"space-between",alignItems:"center",
        position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>🛡️</span>
          <span style={{fontSize:17,fontWeight:800,color:t.tx1}}>Insurance</span>
          <span style={{...pillSt(syncColor),fontSize:10,padding:"2px 7px"}}>{syncLabel}</span>
          <span
            title={pinLock.hasPin?"PIN active — click to manage":"No PIN set — click to set"}
            onClick={()=>setTab("settings")}
            style={{width:8,height:8,borderRadius:"50%",flexShrink:0,cursor:"pointer",
              background:pinLock.hasPin?COLOR.success:COLOR.warning,display:"inline-block"}}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={toggleDark} title="Toggle dark mode"
            style={{background:"none",border:"none",cursor:"pointer",fontSize:18}}>
            {darkMode?"☀️":"🌙"}
          </button>
          <button onClick={handleExport} title="Export JSON backup"
            style={{background:"none",border:"none",cursor:"pointer",fontSize:18}}>💾</button>
          <button onClick={()=>setShowApiModal(true)} title="API Key"
            style={{background:"none",border:"none",cursor:"pointer",fontSize:18,
              display:"inline-flex",alignItems:"center",gap:3}}>
            🔑<span style={{width:7,height:7,borderRadius:"50%",background:apiDot,display:"inline-block"}}/>
          </button>
          {activeProfile && (
            <div style={{width:32,height:32,borderRadius:"50%",background:avatarColor,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:13,fontWeight:800,color:"#fff",cursor:"default"}}>
              {getInitials(activeProfile.name)}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:t.panelBg,borderBottom:`1px solid ${t.border}`,
        padding:"10px 20px 0",display:"flex",gap:6,overflowX:"auto"}}>
        {TABS.map(tb => (
          <button key={tb.key} onClick={()=>setTab(tb.key)} style={tabBtnSt(tab===tb.key,t)}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{maxWidth:900,margin:"0 auto",padding:"20px 16px"}}>
        {tab==="coverage" && (
          <CoverageTab
            policies={policies} targets={targets} incomeMonthly={incomeMonthly}
            onAdd={()=>setShowAddEdit({})}
            onEdit={p=>setShowAddEdit(p)}
            onDelete={id=>setPendingDeleteId(id)}
            t={t}/>
        )}
        {tab==="beneficiaries" && <BeneficiariesTab policies={policies} t={t}/>}
        {tab==="emergency"     && <EmergencyTab policies={policies} t={t}/>}
        {tab==="analysis"      && (
          <AnalysisTab
            policies={policies} targets={targets} incomeMonthly={incomeMonthly}
            incStreams={incStreams} apiKey={apiKey} aiResults={aiResults}
            onAiResult={handleAiResult} t={t}/>
        )}
        {tab==="settings" && (
          <SettingsTab
            hasPin={pinLock.hasPin}
            onSetPin={()=>setShowSetPin(true)}
            onChangePin={()=>setShowChangePin(true)}
            onRemovePin={()=>setShowRemovePin(true)}
            t={t}/>
        )}
      </div>

      {/* Modals */}
      {showApiModal && (
        <ApiKeyModal apiKey={apiKey} onSave={saveApiKey} onClose={()=>setShowApiModal(false)} t={t}/>
      )}
      {showAddEdit !== null && (
        <AddEditPolicyModal
          policy={showAddEdit}
          incomeMonthly={incomeMonthly}
          onSave={handleSavePolicy}
          onClose={()=>setShowAddEdit(null)}
          t={t}/>
      )}
      {pendingDeleteId && (
        <DeleteConfirmModal
          onConfirm={handleDeletePolicy}
          onClose={()=>setPendingDeleteId(null)}
          t={t}/>
      )}
      {showSetPin && (
        <SetPinModal onSet={handleSetPin} onClose={()=>setShowSetPin(false)} t={t}/>
      )}
      {showChangePin && (
        <ChangePinModal
          pinHash={pinLock.pinHash}
          profileId={activeProfileId}
          onChanged={handleChangePin}
          onClose={()=>setShowChangePin(false)}
          t={t}/>
      )}
      {showRemovePin && (
        <RemovePinModal
          pinHash={pinLock.pinHash}
          profileId={activeProfileId}
          onRemoved={handleRemovePin}
          onClose={()=>setShowRemovePin(false)}
          t={t}/>
      )}
      {showRecovery && (
        <RecoveryModal
          profiles={profiles}
          activeProfileId={activeProfileId}
          onRecovered={handleRecovered}
          onClose={()=>setShowRecovery(false)}
          t={t}/>
      )}
    </div>
  );
}
