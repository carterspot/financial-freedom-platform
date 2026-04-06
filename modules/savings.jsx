// SavingsModule v1.0
import { useState, useEffect, useRef } from "react";

// --- Constants ----------------------------------------------------------------
const AVATAR_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];
const COLOR = {
  primary:"#6366f1", success:"#10b981", warning:"#f59e0b", danger:"#ef4444",
  pink:"#ec4899",    blue:"#3b82f6",    orange:"#f97316",  purple:"#8b5cf6", teal:"#06b6d4",
};
const FUND_COLORS = ["#6366f1","#10b981","#f59e0b","#3b82f6","#ec4899","#8b5cf6","#f97316","#06b6d4"];

// --- Helpers ------------------------------------------------------------------
const generateId  = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const fmt$        = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);
const toNum       = (s) => parseFloat(s)||0;
const getInitials = (n) => !n ? "?" : n.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const due = new Date(dateStr);
  const now = new Date();
  return Math.round((due - now) / (1000 * 60 * 60 * 24));
}

function fmtMonthYear(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month:"short", year:"numeric" });
}

// --- Monthly contribution formula ---------------------------------------------
function calcRequiredMonthly(goal) {
  if (goal.monthlyContrib !== null && goal.monthlyContrib !== "" && goal.monthlyContrib !== undefined) {
    return toNum(goal.monthlyContrib);
  }
  const remaining = Math.max(0, toNum(goal.targetAmount) - toNum(goal.currentAmount));
  if (!goal.dueDate) return 0;
  const now = new Date();
  const due = new Date(goal.dueDate);
  const months = Math.max(1,
    (due.getFullYear() - now.getFullYear()) * 12 + (due.getMonth() - now.getMonth()));
  return remaining / months;
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
  return { isMobile: w < 640, isTablet: w < 960, isDesktop: w >= 960 };
}

// --- Storage ------------------------------------------------------------------
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
  const [name, setName]               = useState("");
  const [pin, setPin]                 = useState("");
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
      : { id:pin.trim() ? "pin_"+pin.trim().toLowerCase().replace(/\s+/g,"_") : generateId(),
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
            ×
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
  const [val, setVal]   = useState(apiKey||"");
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
            ×
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
            {show?"🙈":"👁"}
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
          background:"linear-gradient(135deg,#10b981,#6366f1)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
          💰
        </div>
        {!bp.isMobile && (
          <span style={{fontWeight:800,fontSize:18,color:t.tx1}}>Savings</span>
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
                    ✏ Edit Profile
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

// --- AlertBanner --------------------------------------------------------------
function AlertBanner({ goals, t }) {
  const alerts = [];
  goals.forEach(g=>{
    if (!g.dueDate) return;
    const days = daysUntil(g.dueDate);
    if (days === null || days > 30) return;
    const current = toNum(g.currentAmount);
    const target  = toNum(g.targetAmount);
    if (current >= target) {
      alerts.push({ id:g.id, type:"ready", name:g.name, days });
    } else {
      alerts.push({ id:g.id, type:"underfunded", name:g.name, days,
        short:Math.max(0,target-current) });
    }
  });
  if (alerts.length === 0) return null;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
      {alerts.map(a=>(
        <div key={a.id} style={{
          background:a.type==="ready"?COLOR.success+"18":COLOR.warning+"18",
          border:`1px solid ${a.type==="ready"?COLOR.success+"44":COLOR.warning+"44"}`,
          borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:600,
          color:a.type==="ready"?COLOR.success:COLOR.warning}}>
          {a.type==="ready"
            ? `✓ ${a.name} is fully funded and due in ${a.days} day${a.days===1?"":"s"}`
            : `${a.name} due in ${a.days} day${a.days===1?"":"s"} — ${fmt$(a.short)} short`}
        </div>
      ))}
    </div>
  );
}

// --- SuggestionBanner ---------------------------------------------------------
function SuggestionBanner({ suggestions, onAddGoal, t }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div style={{...panelSt(t,{marginBottom:16,
      background:COLOR.primary+"0a",border:`1px solid ${COLOR.primary}33`})}}>
      <div style={{fontWeight:700,fontSize:13,color:COLOR.primary,marginBottom:10}}>
        💡 Suggested Sinking Funds
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {suggestions.map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",
            justifyContent:"space-between",background:t.surf,
            borderRadius:8,padding:"8px 12px",gap:8,flexWrap:"wrap"}}>
            <div style={{fontSize:13,color:t.tx1}}>
              We noticed recurring{" "}
              <strong>{s.recurrencePattern||s.categoryId}</strong>
              {s.estimatedAmount ? ` — ~${fmt$(s.estimatedAmount)}` : ""}
            </div>
            <button onClick={()=>onAddGoal(s)}
              style={{...btnPrimary({padding:"6px 14px",fontSize:12})}}>
              + Add Sinking Goal
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- GoalRow ------------------------------------------------------------------
function GoalRow({ goal, onEdit, onDelete, onContrib, t }) {
  const current  = toNum(goal.currentAmount);
  const target   = toNum(goal.targetAmount);
  const pct      = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const monthly  = calcRequiredMonthly(goal);
  const days     = daysUntil(goal.dueDate);
  const isComplete = current >= target;

  let dueDateColor = t.tx3;
  if (days !== null && days <= 30)  dueDateColor = COLOR.danger;
  else if (days !== null && days <= 90) dueDateColor = COLOR.warning;

  const hasOverride = goal.monthlyContrib !== null &&
                      goal.monthlyContrib !== "" &&
                      goal.monthlyContrib !== undefined;

  return (
    <div style={{padding:"12px 0",borderTop:`1px solid ${t.border}`}}>
      <div style={{display:"flex",alignItems:"flex-start",
        justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",
            gap:6,flexWrap:"wrap",marginBottom:6}}>
            <span style={{fontWeight:700,fontSize:13,color:t.tx1}}>{goal.name}</span>
            <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,
              background:goal.goalType==="sinking_fund"?COLOR.teal+"22":COLOR.purple+"22",
              color:goal.goalType==="sinking_fund"?COLOR.teal:COLOR.purple}}>
              {goal.goalType==="sinking_fund"?"Sinking Fund":"Accumulation"}
            </span>
          </div>
          <div style={{height:6,background:t.surf,borderRadius:3,
            overflow:"hidden",marginBottom:6}}>
            <div style={{height:"100%",width:`${pct}%`,borderRadius:3,
              background:isComplete?COLOR.success:COLOR.primary,
              transition:"width .3s"}} />
          </div>
          <div style={{display:"flex",alignItems:"center",
            gap:12,flexWrap:"wrap",fontSize:12}}>
            <span style={{fontFamily:"monospace",fontWeight:700,
              color:isComplete?COLOR.success:t.tx1}}>
              {fmt$(current)} / {fmt$(target)}
            </span>
            {goal.dueDate && (
              <span style={{color:dueDateColor,fontWeight:600}}>
                Due {fmtMonthYear(goal.dueDate)}
              </span>
            )}
            {monthly > 0 && (
              <span style={{color:t.tx2}}>
                ~{fmt$(monthly)}/mo
                {hasOverride && (
                  <span style={{color:t.tx3,marginLeft:4}}>(custom)</span>
                )}
                <InfoTooltip
                  text="Required monthly contribution to reach this goal by its due date."
                  t={t} />
              </span>
            )}
          </div>
          {goal.goalType==="sinking_fund" && goal.lastPaidDate && (
            <div style={{fontSize:11,color:t.tx3,marginTop:4}}>
              Last paid: {goal.lastPaidDate}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
          <button onClick={()=>onContrib(goal)}
            style={{...btnPrimary({padding:"5px 12px",fontSize:12,
              background:COLOR.success})}}>
            + Contrib
          </button>
          <button onClick={()=>onEdit(goal)}
            style={{background:"none",border:`1px solid ${t.border}`,
              borderRadius:7,padding:"5px 9px",color:t.tx2,
              cursor:"pointer",fontSize:12}}>
            Edit
          </button>
          <button onClick={()=>onDelete(goal)}
            style={{background:"none",border:`1px solid ${COLOR.danger}33`,
              borderRadius:7,padding:"5px 9px",color:COLOR.danger,
              cursor:"pointer",fontSize:12}}>
            Del
          </button>
        </div>
      </div>
    </div>
  );
}

// --- FundCard -----------------------------------------------------------------
function FundCard({ fund, goals, onDeposit, onEditFund, onDeleteFund,
  onAddGoal, onEditGoal, onDeleteGoal, onContrib, t }) {
  const fundGoals      = goals.filter(g=>g.fundId===fund.id);
  const balance        = toNum(fund.balance);
  const totalAllocated = fundGoals.reduce((s,g)=>s+toNum(g.currentAmount),0);
  const allocPct       = balance > 0 ? Math.min(100,(totalAllocated/balance)*100) : 0;
  const overAllocated  = totalAllocated > balance && balance > 0;

  return (
    <div style={{...panelSt(t,{marginBottom:16})}}>
      <div style={{display:"flex",alignItems:"center",
        justifyContent:"space-between",marginBottom:12,gap:8,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:14,height:14,borderRadius:"50%",
            background:fund.color||COLOR.primary,flexShrink:0}} />
          <div>
            <div style={{fontWeight:800,fontSize:15,color:t.tx1}}>{fund.name}</div>
            {fund.accountNickname && (
              <div style={{fontSize:11,color:t.tx3}}>{fund.accountNickname}</div>
            )}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontFamily:"monospace",fontWeight:800,fontSize:20,color:t.tx1}}>
            {fmt$(balance)}
          </span>
          <button onClick={()=>onDeposit(fund)}
            style={{...btnPrimary({padding:"6px 14px",fontSize:12,
              background:COLOR.success})}}>
            + Log Deposit
          </button>
          <button onClick={()=>onEditFund(fund)}
            style={{background:"none",border:`1px solid ${t.border}`,
              borderRadius:7,padding:"6px 10px",color:t.tx2,cursor:"pointer",fontSize:12}}>
            Edit
          </button>
          <button onClick={()=>onDeleteFund(fund)}
            style={{background:"none",border:`1px solid ${COLOR.danger}33`,
              borderRadius:7,padding:"6px 10px",color:COLOR.danger,
              cursor:"pointer",fontSize:12}}>
            Del
          </button>
        </div>
      </div>

      {fundGoals.length > 0 && (
        <div style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",
            fontSize:11,color:t.tx3,marginBottom:4}}>
            <span>
              Goal contributions: {fmt$(totalAllocated)} of {fmt$(balance)}
            </span>
            {overAllocated && (
              <span style={{color:COLOR.danger,fontWeight:700}}>
                Over-allocated!
              </span>
            )}
          </div>
          <div style={{height:5,background:t.surf,borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${allocPct}%`,borderRadius:3,
              background:overAllocated?COLOR.danger:COLOR.success,
              transition:"width .3s"}} />
          </div>
        </div>
      )}

      {fundGoals.map(g=>(
        <GoalRow key={g.id} goal={g} t={t}
          onEdit={onEditGoal}
          onDelete={onDeleteGoal}
          onContrib={onContrib} />
      ))}

      <button onClick={()=>onAddGoal(fund.id)}
        style={{...btnGhost(t,{width:"100%",marginTop:fundGoals.length?12:4,
          fontSize:12,padding:"7px"})}}>
        + Add Goal
      </button>
    </div>
  );
}

// --- AddFundModal -------------------------------------------------------------
function AddFundModal({ open, onClose, editFund, onSave, t }) {
  const [name,     setName]     = useState("");
  const [nickname, setNickname] = useState("");
  const [color,    setColor]    = useState(FUND_COLORS[0]);
  const [balance,  setBalance]  = useState("");

  useEffect(()=>{
    if (open) {
      setName(editFund?.name||"");
      setNickname(editFund?.accountNickname||"");
      setColor(editFund?.color||FUND_COLORS[0]);
      setBalance(editFund?.balance?.toString()||"");
    }
  },[open,editFund]);

  if (!open) return null;
  const s = overlayContainer(t, 440);

  function handleSave() {
    if (!name.trim()) return;
    const fund = editFund
      ? { ...editFund, name:name.trim(), accountNickname:nickname.trim(),
          color, balance:toNum(balance) }
      : { id:"sav_fund_"+generateId(), name:name.trim(),
          accountNickname:nickname.trim(), color,
          balance:toNum(balance), deposits:[] };
    onSave(fund);
    onClose();
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",
          alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>
            {editFund?"Edit Fund":"+ Add Fund"}
          </span>
          <button onClick={onClose}
            style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>
            ×
          </button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={labelSt(t)}>Fund Name *</label>
            <input value={name} onChange={e=>setName(e.target.value)}
              placeholder="Emergency Fund" style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>
              Account Nickname{" "}
              <span style={{color:t.tx3,fontWeight:400}}>(optional)</span>
            </label>
            <input value={nickname} onChange={e=>setNickname(e.target.value)}
              placeholder="Ally Savings" style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>
              Starting Balance ($)
              {editFund && (
                <span style={{color:t.tx3,fontWeight:400}}> — use Log Deposit to add funds</span>
              )}
            </label>
            <input type="number" value={balance} onChange={e=>setBalance(e.target.value)}
              placeholder="0.00" min="0" step="0.01" style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>Color</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {FUND_COLORS.map(c=>(
                <div key={c} onClick={()=>setColor(c)}
                  style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",
                    border:color===c?"3px solid #fff":"2px solid transparent",
                    boxShadow:color===c?`0 0 0 2px ${c}`:"none"}} />
              ))}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()}
            style={{...btnPrimary({flex:1,
              background:name.trim()?COLOR.success:t.surf,
              color:name.trim()?"#fff":t.tx3,
              cursor:name.trim()?"pointer":"default"})}}>
            {editFund?"Save Changes":"Add Fund"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- AddGoalModal -------------------------------------------------------------
function AddGoalModal({ open, onClose, editGoal, funds, categories,
  prefill, defaultFundId, onSave, t }) {
  const [name,              setName]              = useState("");
  const [goalType,          setGoalType]          = useState("accumulation");
  const [fundId,            setFundId]            = useState("");
  const [target,            setTarget]            = useState("");
  const [dueDate,           setDueDate]           = useState("");
  const [monthlyOverride,   setMonthlyOverride]   = useState("");
  const [categoryId,        setCategoryId]        = useState("");
  const [recurrencePattern, setRecurrencePattern] = useState("");

  useEffect(()=>{
    if (!open) return;
    if (editGoal) {
      setName(editGoal.name||"");
      setGoalType(editGoal.goalType||"accumulation");
      setFundId(editGoal.fundId||funds[0]?.id||"");
      setTarget(editGoal.targetAmount?.toString()||"");
      setDueDate(editGoal.dueDate||"");
      setMonthlyOverride(editGoal.monthlyContrib?.toString()||"");
      setCategoryId(editGoal.categoryId||"");
      setRecurrencePattern(editGoal.recurrencePattern||"");
    } else {
      setName(prefill?.name||"");
      setGoalType(prefill?.goalType||"accumulation");
      setFundId(defaultFundId||prefill?.fundId||funds[0]?.id||"");
      setTarget(prefill?.estimatedAmount?.toString()||"");
      setDueDate("");
      setMonthlyOverride("");
      setCategoryId(prefill?.categoryId||"");
      setRecurrencePattern(prefill?.recurrencePattern||"");
    }
  },[open,editGoal,prefill,defaultFundId,funds]);

  if (!open) return null;
  const s = overlayContainer(t, 480);

  const calcMonthlyPreview = (() => {
    const remaining = Math.max(0, toNum(target) - toNum(editGoal?.currentAmount||"0"));
    if (!dueDate) return 0;
    const now  = new Date();
    const due  = new Date(dueDate);
    const mos  = Math.max(1,
      (due.getFullYear()-now.getFullYear())*12+(due.getMonth()-now.getMonth()));
    return remaining / mos;
  })();

  function handleSave() {
    if (!name.trim() || !target || !fundId) return;
    if (goalType==="sinking_fund" && !dueDate) return;
    const goal = editGoal
      ? { ...editGoal, name:name.trim(), goalType, fundId, targetAmount:target,
          dueDate, monthlyContrib:monthlyOverride||null,
          categoryId, recurrencePattern }
      : { id:"sav_goal_"+generateId(), name:name.trim(), goalType, fundId,
          targetAmount:target, currentAmount:"0", dueDate,
          monthlyContrib:monthlyOverride||null, categoryId,
          recurrencePattern, linkedTransactionId:"", lastPaidDate:"" };
    onSave(goal);
    onClose();
  }

  const expenseCats = (categories||[]).filter(c=>c.type==="expense"||!c.type);
  const canSave = name.trim() && target && fundId &&
    (goalType!=="sinking_fund" || dueDate);

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",
          alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>
            {editGoal?"Edit Goal":"+ Add Goal"}
          </span>
          <button onClick={onClose}
            style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>
            ×
          </button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={labelSt(t)}>Goal Name *</label>
            <input value={name} onChange={e=>setName(e.target.value)}
              placeholder="Car Registration" style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>Goal Type</label>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setGoalType("accumulation")}
                style={tabBtn(goalType==="accumulation",t)}>
                Accumulation
              </button>
              <button onClick={()=>setGoalType("sinking_fund")}
                style={tabBtn(goalType==="sinking_fund",t)}>
                Sinking Fund
              </button>
            </div>
          </div>
          <div>
            <label style={labelSt(t)}>Fund *</label>
            <select value={fundId} onChange={e=>setFundId(e.target.value)}
              style={inputStyle(t)}>
              <option value="">Select fund…</option>
              {funds.map(f=>(
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelSt(t)}>Target Amount ($) *</label>
            <input type="number" value={target} onChange={e=>setTarget(e.target.value)}
              placeholder="1000" min="0" step="0.01" style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>
              Due Date {goalType==="sinking_fund"?"*":"(optional)"}
            </label>
            <input type="date" value={dueDate}
              onChange={e=>setDueDate(e.target.value)} style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>
              Monthly Contribution Override
              <InfoTooltip
                text={calcMonthlyPreview>0
                  ? `Calculated: ${fmt$(calcMonthlyPreview)}/mo — override to set a custom amount.`
                  : "Set a custom monthly contribution amount."}
                t={t} />
            </label>
            <input type="number" value={monthlyOverride}
              onChange={e=>setMonthlyOverride(e.target.value)}
              placeholder={calcMonthlyPreview>0
                ? `${calcMonthlyPreview.toFixed(2)} (calculated)`
                : "Optional"}
              min="0" step="0.01" style={inputStyle(t)} />
          </div>
          {goalType==="sinking_fund" && (
            <>
              <div>
                <label style={labelSt(t)}>Category (optional)</label>
                <select value={categoryId} onChange={e=>setCategoryId(e.target.value)}
                  style={inputStyle(t)}>
                  <option value="">None</option>
                  {expenseCats.map(c=>(
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelSt(t)}>Recurrence Pattern (optional)</label>
                <input value={recurrencePattern}
                  onChange={e=>setRecurrencePattern(e.target.value)}
                  placeholder="DMV REGISTRATION" style={inputStyle(t)} />
              </div>
            </>
          )}
        </div>
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
          <button onClick={handleSave} disabled={!canSave}
            style={{...btnPrimary({flex:1,
              background:canSave?COLOR.primary:t.surf,
              color:canSave?"#fff":t.tx3,
              cursor:canSave?"pointer":"default"})}}>
            {editGoal?"Save Changes":"Add Goal"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- DepositModal -------------------------------------------------------------
function DepositModal({ open, onClose, fund, onSave, t }) {
  const [amount, setAmount] = useState("");
  const [date,   setDate]   = useState("");
  const [note,   setNote]   = useState("");

  useEffect(()=>{
    if (open) {
      setAmount("");
      setDate(new Date().toISOString().slice(0,10));
      setNote("");
    }
  },[open]);

  if (!open || !fund) return null;
  const s = overlayContainer(t, 400);

  function handleSave() {
    const amt = toNum(amount);
    if (!amt) return;
    const deposit    = { id:"dep_"+generateId(), amount:amt, date, note:note.trim() };
    const newBalance = toNum(fund.balance) + amt;
    onSave(fund.id, deposit, newBalance);
    onClose();
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",
          alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>
            Log Deposit — {fund.name}
          </span>
          <button onClick={onClose}
            style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>
            ×
          </button>
        </div>
        <div style={{fontSize:12,color:t.tx2,marginBottom:16}}>
          Current balance:{" "}
          <span style={{fontFamily:"monospace",color:COLOR.success,fontWeight:700}}>
            {fmt$(fund.balance)}
          </span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={labelSt(t)}>Amount ($) *</label>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value)}
              placeholder="500" min="0" step="0.01" style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>Date</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
              style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>Note (optional)</label>
            <input value={note} onChange={e=>setNote(e.target.value)}
              placeholder="April deposit" style={inputStyle(t)} />
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
          <button onClick={handleSave} disabled={!amount}
            style={{...btnPrimary({flex:1,background:COLOR.success})}}>
            + Log Deposit
          </button>
        </div>
      </div>
    </div>
  );
}

// --- ContribModal -------------------------------------------------------------
function ContribModal({ open, onClose, goal, onSave, t }) {
  const [amount, setAmount] = useState("");
  const [date,   setDate]   = useState("");

  useEffect(()=>{
    if (open && goal) {
      setAmount("");
      setDate(new Date().toISOString().slice(0,10));
    }
  },[open,goal]);

  if (!open || !goal) return null;
  const s = overlayContainer(t, 400);

  const current   = toNum(goal.currentAmount);
  const target    = toNum(goal.targetAmount);
  const remaining = Math.max(0, target - current);
  const suggested = calcRequiredMonthly(goal);

  function handleSave() {
    const amt = toNum(amount);
    if (!amt) return;
    const newAmount = (current + amt).toString();
    onSave(goal.id, newAmount);
    onClose();
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",
          alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>
            Log Contribution — {goal.name}
          </span>
          <button onClick={onClose}
            style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>
            ×
          </button>
        </div>
        <div style={{fontSize:12,color:t.tx2,marginBottom:16}}>
          Progress:{" "}
          <span style={{fontFamily:"monospace",color:COLOR.primary,fontWeight:700}}>
            {fmt$(current)}
          </span>
          {" / "}
          <span style={{fontFamily:"monospace",fontWeight:700}}>{fmt$(target)}</span>
          {remaining > 0 && (
            <span style={{marginLeft:8}}>({fmt$(remaining)} remaining)</span>
          )}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={labelSt(t)}>Contribution Amount ($) *</label>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value)}
              placeholder={suggested>0?suggested.toFixed(2):"100"}
              min="0" step="0.01" style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>Date</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
              style={inputStyle(t)} />
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Cancel</button>
          <button onClick={handleSave} disabled={!amount}
            style={{...btnPrimary({flex:1,background:COLOR.success})}}>
            + Log Contribution
          </button>
        </div>
      </div>
    </div>
  );
}

// --- MarkPaidModal ------------------------------------------------------------
function MarkPaidModal({ open, onClose, goal, transactionDate, onConfirm, t }) {
  if (!open || !goal) return null;
  const s = overlayContainer(t, 400);
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:800,fontSize:17,color:t.tx1,marginBottom:12}}>
          Mark as Paid?
        </div>
        <div style={{fontSize:14,color:t.tx2,marginBottom:24,lineHeight:1.6}}>
          It looks like{" "}
          <strong style={{color:t.tx1}}>{goal.name}</strong> was paid
          {transactionDate ? ` on ${transactionDate}` : ""}. Confirm to reset
          progress to $0 and record the payment date.
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{...btnGhost(t,{flex:1})}}>Skip</button>
          <button onClick={()=>{ onConfirm(goal.id, transactionDate); onClose(); }}
            style={{flex:1,background:COLOR.success,border:"none",borderRadius:10,
              padding:"9px 20px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>
            Confirm Paid
          </button>
        </div>
      </div>
    </div>
  );
}

// --- BackupRestorePanel -------------------------------------------------------
function BackupRestorePanel({ open, onClose, funds, goals, profileId, onImport, t }) {
  const [tab,        setTab]        = useState("export");
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState("replace");
  const [importError,setImportError]= useState("");
  const [csvStatus,  setCsvStatus]  = useState("");
  const fileRef    = useRef(null);
  const fundCsvRef = useRef(null);
  const goalCsvRef = useRef(null);

  if (!open) return null;
  const s = overlayContainer(t, 540);

  function exportJSON() {
    const data = { version:"sav_1.0", exportedAt:new Date().toISOString(),
      profileId, funds, goals };
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `savings-${profileId}-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function exportFundsCSV() {
    const headers = ["id","name","accountNickname","color","balance"];
    const rows = funds.map(f=>[f.id,f.name,f.accountNickname||"",f.color,f.balance]);
    const csv  = [headers,...rows].map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `savings-funds-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function exportGoalsCSV() {
    const headers = ["id","fundId","name","goalType","targetAmount","currentAmount",
      "dueDate","monthlyContrib","categoryId","recurrencePattern","lastPaidDate"];
    const rows = goals.map(g=>[g.id,g.fundId,g.name,g.goalType,
      g.targetAmount,g.currentAmount,g.dueDate||"",g.monthlyContrib||"",
      g.categoryId||"",g.recurrencePattern||"",g.lastPaidDate||""]);
    const csv  = [headers,...rows].map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `savings-goals-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function parseCSVRows(text) {
    const lines   = text.trim().split(/\r?\n/);
    const headers = lines[0].split(",").map(h=>h.replace(/^"|"$/g,"").trim());
    return lines.slice(1).filter(l=>l.trim()).map(line=>{
      const vals=[];let cur="",inQ=false;
      for (let i=0;i<line.length;i++) {
        const ch=line[i];
        if (ch==='"'){inQ=!inQ;}
        else if (ch===","&&!inQ){vals.push(cur);cur="";}
        else{cur+=ch;}
      }
      vals.push(cur);
      const obj={};
      headers.forEach((h,i)=>{obj[h]=(vals[i]||"").trim();});
      return obj;
    });
  }

  function handleFundsCSV(e) {
    const file=e.target.files?.[0]; if (!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try {
        const rows=parseCSVRows(ev.target.result);
        const imported=rows.map(r=>({
          id:r.id||"sav_fund_"+generateId(),
          name:r.name||"",
          accountNickname:r.accountNickname||"",
          color:r.color||COLOR.primary,
          balance:toNum(r.balance),
          deposits:[],
        }));
        onImport({funds:imported},importMode);
        setCsvStatus(`${imported.length} funds imported (${importMode})`);
        onClose();
      } catch(err){setCsvStatus("Funds CSV error: "+err.message);}
    };
    reader.readAsText(file);
    e.target.value="";
  }

  function handleGoalsCSV(e) {
    const file=e.target.files?.[0]; if (!file) return;
    const COLS=["id","fundId","name","goalType","targetAmount","currentAmount",
      "dueDate","monthlyContrib","categoryId","recurrencePattern","lastPaidDate"];
    const reader=new FileReader();
    reader.onload=ev=>{
      try {
        const rows=parseCSVRows(ev.target.result);
        const imported=rows.map(r=>{
          const g={};
          COLS.forEach(k=>{g[k]=r[k]!==undefined?r[k]:"";});
          if (!g.id) g.id="sav_goal_"+generateId();
          g.monthlyContrib=g.monthlyContrib||null;
          g.linkedTransactionId=g.linkedTransactionId||"";
          return g;
        });
        onImport({goals:imported},importMode);
        setCsvStatus(`${imported.length} goals imported (${importMode})`);
        onClose();
      } catch(err){setCsvStatus("Goals CSV error: "+err.message);}
    };
    reader.readAsText(file);
    e.target.value="";
  }

  function handleImportJSON() {
    setImportError("");
    try {
      const data=JSON.parse(importText);
      if (!data.version?.startsWith("sav_")) throw new Error("Not a SavingsModule backup.");
      onImport(data,importMode);
      onClose();
    } catch(e){setImportError(e.message||"Invalid JSON");}
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",
          alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:17,color:t.tx1}}>📦 Backup & Restore</span>
          <button onClick={onClose}
            style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:20}}>
            ×
          </button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          {["export","import"].map(tb=>(
            <button key={tb} onClick={()=>setTab(tb)} style={tabBtn(tab===tb,t)}>
              {tb==="export"?"📤 Export":"📥 Import"}
            </button>
          ))}
        </div>

        {tab==="export" && (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button onClick={exportJSON} style={btnPrimary({width:"100%"})}>
              Save Backup (JSON)
            </button>
            <button onClick={exportFundsCSV} style={btnGhost(t,{width:"100%"})}>
              Export Funds CSV
            </button>
            <button onClick={exportGoalsCSV} style={btnGhost(t,{width:"100%"})}>
              Export Goals CSV
            </button>
            <div style={{fontSize:11,color:t.tx3,marginTop:4}}>
              JSON backup includes all data including deposit history.
            </div>
          </div>
        )}

        {tab==="import" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div>
              <label style={labelSt(t)}>Import Mode</label>
              <div style={{display:"flex",gap:8}}>
                {["replace","merge"].map(m=>(
                  <button key={m} onClick={()=>setImportMode(m)}
                    style={tabBtn(importMode===m,t)}>
                    {m==="replace"?"Replace All":"Merge"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <input ref={fileRef} type="file" accept=".json"
                onChange={e=>{
                  const file=e.target.files?.[0]; if(!file) return;
                  const reader=new FileReader();
                  reader.onload=ev=>setImportText(ev.target.result);
                  reader.readAsText(file);
                }}
                style={{display:"none"}} />
              <button onClick={()=>fileRef.current?.click()}
                style={{width:"100%",background:t.surf,border:`2px dashed ${t.border}`,
                  borderRadius:10,padding:"10px",color:t.tx2,
                  cursor:"pointer",fontSize:13,fontWeight:600,marginBottom:8}}>
                📂 Restore Backup
              </button>
              <label style={labelSt(t)}>Paste JSON Backup</label>
              <textarea value={importText} onChange={e=>setImportText(e.target.value)}
                rows={5} placeholder='{"version":"sav_1.0",...}'
                style={{...inputStyle(t),resize:"vertical",fontFamily:"monospace",fontSize:11}} />
            </div>
            {importError && (
              <div style={{fontSize:12,color:COLOR.danger}}>{importError}</div>
            )}
            <button onClick={handleImportJSON} disabled={!importText.trim()}
              style={btnPrimary({width:"100%"})}>
              Import JSON
            </button>
            <div style={{borderTop:`1px solid ${t.border}`,paddingTop:12}}>
              <div style={{fontSize:12,color:t.tx2,fontWeight:600,marginBottom:8}}>
                Import CSV
              </div>
              <input ref={fundCsvRef} type="file" accept=".csv"
                onChange={handleFundsCSV} style={{display:"none"}} />
              <input ref={goalCsvRef} type="file" accept=".csv"
                onChange={handleGoalsCSV} style={{display:"none"}} />
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>fundCsvRef.current?.click()}
                  style={btnGhost(t,{flex:1,fontSize:12})}>
                  Import Funds CSV
                </button>
                <button onClick={()=>goalCsvRef.current?.click()}
                  style={btnGhost(t,{flex:1,fontSize:12})}>
                  Import Goals CSV
                </button>
              </div>
            </div>
            {csvStatus && (
              <div style={{fontSize:11,color:COLOR.success}}>{csvStatus}</div>
            )}
          </div>
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
    if (!name.trim() || saving) return;
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
          <div style={{fontSize:52,marginBottom:12}}>💰</div>
          <div style={{fontWeight:800,fontSize:26,color:t.tx1,marginBottom:8}}>
            Welcome to Savings
          </div>
          <div style={{fontSize:14,color:t.tx2,lineHeight:1.6,
            maxWidth:340,margin:"0 auto"}}>
            Track your savings funds and goals — emergency funds,
            sinking funds, vacation savings, and more.
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
                Recovery PIN{" "}
                <span style={{color:t.tx3,fontWeight:400}}>(optional)</span>
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

// --- App (SavingsModule) ------------------------------------------------------
export default function App() {
  const [loading,         setLoading]         = useState(true);
  const [darkMode,        setDarkMode]        = useState(
    ()=>localStorage.getItem("sav_dark")!=="false"
  );
  const [profiles,        setProfiles]        = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [funds,           setFunds]           = useState([]);
  const [goals,           setGoals]           = useState([]);
  const [categories,      setCategories]      = useState([]);
  const [apiKey,          setApiKey]          = useState("");
  const [suggestions,     setSuggestions]     = useState([]);
  const [markPaidQueue,   setMarkPaidQueue]   = useState([]);

  // Modal state
  const [showApiKey,       setShowApiKey]       = useState(false);
  const [showBackup,       setShowBackup]       = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile,   setEditingProfile]   = useState(null);
  const [showAddFund,      setShowAddFund]      = useState(false);
  const [editFund,         setEditFund]         = useState(null);
  const [showAddGoal,      setShowAddGoal]      = useState(false);
  const [editGoal,         setEditGoal]         = useState(null);
  const [goalPrefill,      setGoalPrefill]      = useState(null);
  const [goalDefaultFundId,setGoalDefaultFundId]= useState(null);
  const [depositFund,      setDepositFund]      = useState(null);
  const [contribGoal,      setContribGoal]      = useState(null);
  const [confirmTarget,    setConfirmTarget]    = useState(null);

  const t  = useTheme(darkMode);
  const bp = useBreakpoint();
  const activeProfile = profiles.find(p=>p.id===activeProfileId)||null;

  useEffect(()=>{ localStorage.setItem("sav_dark",darkMode); },[darkMode]);

  // Initial load
  useEffect(()=>{
    async function init() {
      const profs = await storeGet("cc_profiles",true)||[];
      const actId = await storeGet("cc_active_profile",true);
      const key   = await storeGet("cc_apikey",true);
      if (key) setApiKey(key);
      setProfiles(profs);
      const id = actId||(profs[0]?.id)||null;
      setActiveProfileId(id);
      if (id) {
        const [f,g,cats] = await Promise.all([
          storeGet(`sav_funds_${id}`,true),
          storeGet(`sav_goals_${id}`,true),
          storeGet(`ffp_categories_${id}`,true),
        ]);
        setFunds(f||[]);
        setGoals(g||[]);
        setCategories(cats||[]);
      }
      setLoading(false);
    }
    init();
  },[]);

  // Spending handoff: suggestions + mark-paid detection
  useEffect(()=>{
    if (!activeProfileId) return;
    async function checkSpending() {
      const txns = await storeGet(`sp_transactions_${activeProfileId}`,true)||[];

      // Goal suggestions
      const candidates = txns.filter(tx=>tx.isSinkingFundCandidate && tx.recurrencePattern);
      const grouped = {};
      candidates.forEach(tx=>{
        const key = tx.recurrencePattern;
        if (!grouped[key]) {
          grouped[key]={
            recurrencePattern:key,categoryId:tx.categoryId,
            estimatedAmount:tx.amount,frequency:tx.frequency,
          };
        }
      });
      const newSuggestions = Object.values(grouped).filter(s=>{
        return !goals.some(g=>
          g.goalType==="sinking_fund" &&
          (g.recurrencePattern===s.recurrencePattern ||
           (s.categoryId && g.categoryId===s.categoryId))
        );
      });
      setSuggestions(newSuggestions);

      // Mark-paid detection
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate()-45);
      const cutoffStr = cutoff.toISOString().slice(0,10);
      const queue = [];
      goals.forEach(g=>{
        if (g.goalType!=="sinking_fund") return;
        const match = txns.find(tx=>{
          const txDate = tx.date||"";
          if (txDate < cutoffStr) return false;
          if (g.lastPaidDate && txDate <= g.lastPaidDate) return false;
          const descMatch = g.recurrencePattern &&
            (tx.description||"").toUpperCase().includes(g.recurrencePattern.toUpperCase());
          const catMatch  = g.categoryId && tx.categoryId===g.categoryId;
          return descMatch || catMatch;
        });
        if (match) queue.push({ goal:g, transactionDate:match.date });
      });
      if (queue.length > 0) setMarkPaidQueue(queue);
    }
    checkSpending();
  },[activeProfileId,goals]);

  async function switchProfile(id) {
    setActiveProfileId(id);
    await storeSet("cc_active_profile",id,true);
    setFunds([]); setGoals([]);
    const [f,g,cats] = await Promise.all([
      storeGet(`sav_funds_${id}`,true),
      storeGet(`sav_goals_${id}`,true),
      storeGet(`ffp_categories_${id}`,true),
    ]);
    setFunds(f||[]); setGoals(g||[]); setCategories(cats||[]);
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

  async function saveFunds(next) {
    setFunds(next);
    await storeSet(`sav_funds_${activeProfileId}`,next,true);
  }
  async function saveGoals(next) {
    setGoals(next);
    await storeSet(`sav_goals_${activeProfileId}`,next,true);
  }

  async function saveApiKey(key) {
    setApiKey(key); setShowApiKey(false);
    await storeSet("cc_apikey",key,true);
  }

  function handleSaveFund(fund) {
    const exists = funds.some(f=>f.id===fund.id);
    const next   = exists ? funds.map(f=>f.id===fund.id?fund:f) : [...funds,fund];
    saveFunds(next);
    setEditFund(null); setShowAddFund(false);
  }

  function handleDeleteFund(fund) {
    setConfirmTarget({
      type:"fund",id:fund.id,name:fund.name,
      message:`Delete fund "${fund.name}" and all its goals? This cannot be undone.`,
    });
  }

  async function handleConfirmDelete() {
    if (!confirmTarget) return;
    if (confirmTarget.type==="fund") {
      await saveFunds(funds.filter(f=>f.id!==confirmTarget.id));
      await saveGoals(goals.filter(g=>g.fundId!==confirmTarget.id));
    } else {
      await saveGoals(goals.filter(g=>g.id!==confirmTarget.id));
    }
    setConfirmTarget(null);
  }

  function handleSaveGoal(goal) {
    const exists = goals.some(g=>g.id===goal.id);
    const next   = exists ? goals.map(g=>g.id===goal.id?goal:g) : [...goals,goal];
    saveGoals(next);
    setEditGoal(null); setShowAddGoal(false); setGoalPrefill(null);
  }

  function handleSaveDeposit(fundId, deposit, newBalance) {
    const next = funds.map(f=>{
      if (f.id!==fundId) return f;
      return { ...f, balance:newBalance, deposits:[...(f.deposits||[]),deposit] };
    });
    saveFunds(next);
  }

  function handleSaveContrib(goalId, newAmount) {
    const next = goals.map(g=>
      g.id===goalId ? { ...g, currentAmount:newAmount } : g
    );
    saveGoals(next);
  }

  function handleMarkPaid(goalId, transactionDate) {
    const paidDate = transactionDate||new Date().toISOString().slice(0,10);
    const next = goals.map(g=>
      g.id===goalId ? { ...g, currentAmount:"0", lastPaidDate:paidDate } : g
    );
    saveGoals(next);
    setMarkPaidQueue(q=>q.slice(1));
  }

  function handleAddGoalFromFund(fundId) {
    setEditGoal(null); setGoalPrefill(null);
    setGoalDefaultFundId(fundId); setShowAddGoal(true);
  }

  function handleAddGoalFromSuggestion(suggestion) {
    setEditGoal(null);
    setGoalPrefill({
      goalType:"sinking_fund",
      categoryId:suggestion.categoryId,
      recurrencePattern:suggestion.recurrencePattern,
      estimatedAmount:suggestion.estimatedAmount,
    });
    setGoalDefaultFundId(null); setShowAddGoal(true);
  }

  async function handleBackupImport(data, mode) {
    if (mode==="replace") {
      if (data.funds) await saveFunds(data.funds);
      if (data.goals) await saveGoals(data.goals);
    } else {
      if (data.funds) {
        const existing = new Set(funds.map(f=>f.id));
        await saveFunds([...funds,...data.funds.filter(f=>!existing.has(f.id))]);
      }
      if (data.goals) {
        const existing = new Set(goals.map(g=>g.id));
        await saveGoals([...goals,...data.goals.filter(g=>!existing.has(g.id))]);
      }
    }
  }

  // Stats
  const totalSaved       = funds.reduce((s,f)=>s+toNum(f.balance),0);
  const totalTargeted    = goals.reduce((s,g)=>s+toNum(g.targetAmount),0);
  const monthlyCommit    = goals.reduce((s,g)=>s+calcRequiredMonthly(g),0);
  const coveragePct      = totalTargeted > 0
    ? Math.min(100,(totalSaved/totalTargeted)*100) : 0;

  const currentMarkPaid = markPaidQueue[0]||null;

  if (loading) return (
    <div style={{minHeight:"100vh",background:t.bg,display:"flex",
      alignItems:"center",justifyContent:"center",
      flexDirection:"column",gap:16,padding:20}}>
      <div style={{width:40,height:40,border:"3px solid #10b981",
        borderTopColor:"transparent",borderRadius:"50%",
        animation:"spin .8s linear infinite"}} />
      <div style={{fontSize:14,color:t.tx2}}>Loading Savings…</div>
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
        <AlertBanner goals={goals} t={t} />
        <SuggestionBanner suggestions={suggestions}
          onAddGoal={handleAddGoalFromSuggestion} t={t} />

        {/* Stats Row */}
        <div style={{display:"grid",
          gridTemplateColumns:bp.isMobile?"1fr 1fr":"repeat(4,1fr)",
          gap:12,marginBottom:24}}>
          {[
            { label:"Total Saved",        value:fmt$(totalSaved),         color:COLOR.success },
            { label:"Total Targeted",     value:fmt$(totalTargeted),      color:COLOR.primary },
            { label:"Monthly Commitment", value:fmt$(monthlyCommit)+"/mo",color:COLOR.warning },
            { label:"Coverage",           value:`${coveragePct.toFixed(0)}%`, color:COLOR.teal },
          ].map(stat=>(
            <div key={stat.label}
              style={{...panelSt(t,{textAlign:"center",padding:"14px 12px"})}}>
              <div style={{fontSize:11,color:t.tx3,fontWeight:600,marginBottom:4}}>
                {stat.label}
              </div>
              <div style={{fontFamily:"monospace",fontWeight:800,
                fontSize:18,color:stat.color}}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Fund Cards or Empty State */}
        {funds.length===0 ? (
          <div style={{...panelSt(t,{textAlign:"center",padding:"60px 20px"})}}>
            <div style={{fontSize:48,marginBottom:16}}>🏦</div>
            <div style={{fontWeight:700,fontSize:18,color:t.tx1,marginBottom:8}}>
              No savings funds yet
            </div>
            <div style={{fontSize:14,color:t.tx2,marginBottom:24}}>
              Add a fund to start tracking your savings goals
            </div>
            <button onClick={()=>{setEditFund(null);setShowAddFund(true);}}
              style={btnPrimary({padding:"12px 32px",fontSize:15,
                background:COLOR.success})}>
              + Add Your First Fund
            </button>
          </div>
        ) : (
          <>
            {funds.map(fund=>(
              <FundCard key={fund.id} fund={fund} goals={goals} t={t}
                onDeposit={(f)=>setDepositFund(f)}
                onEditFund={(f)=>{setEditFund(f);setShowAddFund(true);}}
                onDeleteFund={handleDeleteFund}
                onAddGoal={handleAddGoalFromFund}
                onEditGoal={(g)=>{
                  setEditGoal(g);setGoalPrefill(null);
                  setGoalDefaultFundId(null);setShowAddGoal(true);
                }}
                onDeleteGoal={(g)=>setConfirmTarget({
                  type:"goal",id:g.id,name:g.name,
                  message:`Delete goal "${g.name}"? This cannot be undone.`,
                })}
                onContrib={(g)=>setContribGoal(g)} />
            ))}
            <button onClick={()=>{setEditFund(null);setShowAddFund(true);}}
              style={{...btnPrimary({width:"100%",marginBottom:32,
                background:COLOR.success})}}>
              + Add Fund
            </button>
          </>
        )}
      </div>

      {/* Modals */}
      <AddFundModal open={showAddFund}
        onClose={()=>{setShowAddFund(false);setEditFund(null);}}
        editFund={editFund} onSave={handleSaveFund} t={t} />

      <AddGoalModal open={showAddGoal}
        onClose={()=>{setShowAddGoal(false);setEditGoal(null);
          setGoalPrefill(null);setGoalDefaultFundId(null);}}
        editGoal={editGoal} funds={funds} categories={categories}
        prefill={goalPrefill} defaultFundId={goalDefaultFundId}
        onSave={handleSaveGoal} t={t} />

      <DepositModal open={!!depositFund}
        onClose={()=>setDepositFund(null)}
        fund={depositFund} onSave={handleSaveDeposit} t={t} />

      <ContribModal open={!!contribGoal}
        onClose={()=>setContribGoal(null)}
        goal={contribGoal} onSave={handleSaveContrib} t={t} />

      <MarkPaidModal open={!!currentMarkPaid}
        onClose={()=>setMarkPaidQueue(q=>q.slice(1))}
        goal={currentMarkPaid?.goal}
        transactionDate={currentMarkPaid?.transactionDate}
        onConfirm={handleMarkPaid} t={t} />

      <ConfirmModal open={!!confirmTarget}
        onClose={()=>setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
        title={confirmTarget?.type==="fund"?"Delete Fund":"Delete Goal"}
        message={confirmTarget?.message}
        confirmLabel="Delete" danger t={t} />

      <BackupRestorePanel open={showBackup}
        onClose={()=>setShowBackup(false)}
        funds={funds} goals={goals} profileId={activeProfileId}
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
