import { useState, useEffect, useRef } from "react";

// ─── Constants ─────────────────────────────────────────────────────────────────
const LOAN_TYPES=[
  {id:"auto",     icon:"🚗",label:"Auto Loan",    defaultColor:"#3b82f6"},
  {id:"mortgage", icon:"🏠",label:"Mortgage",      defaultColor:"#10b981"},
  {id:"student",  icon:"🎓",label:"Student Loan",  defaultColor:"#8b5cf6"},
  {id:"personal", icon:"💼",label:"Personal Loan", defaultColor:"#f97316"},
  {id:"other",    icon:"🏦",label:"Other",         defaultColor:"#6366f1"},
];
const PRESET_COLORS=["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#f59e0b","#8b5cf6","#ef4444","#14b8a6","#84cc16","#06b6d4","#f43f5e"];
const AVATAR_COLORS=["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];
const DEFAULT_LOAN={id:null,name:"",lender:"",type:"auto",color:"#3b82f6",originalBalance:"",currentBalance:"",interestRate:"",monthlyPayment:"",termMonths:"",remainingMonths:"",nextPaymentDay:"",notes:""};
const API_URL="https://api.anthropic.com/v1/messages";
const MODEL="claude-sonnet-4-20250514";

// ─── Pure Helpers ──────────────────────────────────────────────────────────────
const generateId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2);
const fmt$=n=>(!isFinite(n)||isNaN(n))?"$—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
const fmtMo=d=>d.toLocaleDateString("en-US",{month:"short",year:"numeric"});
const fmtDate=d=>d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const addMo=(d,n)=>{const x=new Date(d);x.setMonth(x.getMonth()+n);return x;};
const getInitials=n=>!n?"?":n.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
const getLoanType=id=>LOAN_TYPES.find(t=>t.id===id)||LOAN_TYPES[4];

function calcMonthlyPayment(balance,annualRate,months){
  if(!balance||!months) return 0;
  const r=annualRate/100/12;
  if(r===0) return balance/months;
  return balance*r/(1-Math.pow(1+r,-months));
}
function calcRemainingMonths(balance,annualRate,payment){
  if(!balance||!payment) return 0;
  const r=annualRate/100/12;
  if(r===0) return Math.ceil(balance/payment);
  if(payment<=balance*r) return 999;
  return Math.ceil(-Math.log(1-(balance*r)/payment)/Math.log(1+r));
}
function amortizeLoan(loan,extraMonthly=0,lumpSums=[]){
  const balance=parseFloat(loan.currentBalance)||0;
  const rate=parseFloat(loan.interestRate)||0;
  const payment=parseFloat(loan.monthlyPayment)||0;
  if(!balance||!payment) return {months:[],totalInterest:0,totalPaid:0,totalMonths:0};
  const r=rate/100/12;
  const budget=payment+extraMonthly;
  let bal=balance;
  const rows=[];
  let totalInterest=0;
  let month=0;
  while(bal>0.005&&month<600){
    month++;
    const lump=(lumpSums||[]).filter(ls=>ls.month===month).reduce((s,ls)=>s+ls.amount,0);
    if(lump>0){bal=Math.max(0,bal-lump);}
    if(bal<=0.005){rows.push({month,interest:0,principal:0,payment:0,balance:0,lump});break;}
    const interest=bal*r;
    const available=Math.max(budget,interest+0.01);
    const actual=Math.min(available,bal+interest);
    const principal=actual-interest;
    bal=Math.max(0,bal-principal);
    totalInterest+=interest;
    rows.push({month,interest,principal,payment:actual,balance:bal,lump});
  }
  return {months:rows,totalInterest,totalPaid:balance+totalInterest,totalMonths:month};
}
function computeMultiSchedule(loans,method,opts={}){
  const {extraBudget=0,lumpSums=[],lumpMode="priority",dynamicMins=false}=opts;
  const active=loans.map(l=>({
    id:l.id,name:l.name,color:l.color,type:l.type,
    balance:parseFloat(l.currentBalance)||0,
    rate:parseFloat(l.interestRate)||0,
    payment:parseFloat(l.monthlyPayment)||0,
  })).filter(l=>l.balance>0&&l.payment>0);
  if(!active.length) return {months:[],loanPayoffs:[],totalInterest:0,totalPaid:0,totalMonths:0,loans:active,totalBudget:0};
  const base=active.reduce((s,l)=>s+l.payment,0)+extraBudget;
  const sorted=method==="avalanche"?[...active].sort((a,b)=>b.rate-a.rate):[...active].sort((a,b)=>a.balance-b.balance);
  const balances={},paidOff={},intTotals={};
  active.forEach(l=>{balances[l.id]=l.balance;paidOff[l.id]=false;intTotals[l.id]=0;});
  const payoffs=[],rows=[];
  let month=0;
  while(month<600){
    const stillActive=sorted.filter(l=>balances[l.id]>0.005);
    if(!stillActive.length) break;
    month++;
    let monthLump=0;
    const rLumpPmts={};
    lumpSums.filter(ls=>ls.month===month).forEach(ls=>{
      monthLump+=ls.amount;
      if(lumpMode==="split"){
        const activeCds=sorted.filter(l=>balances[l.id]>0);
        const total=activeCds.reduce((s,l)=>s+balances[l.id],0);
        if(total>0) activeCds.forEach(l=>{ const share=ls.amount*(balances[l.id]/total); balances[l.id]=Math.max(0,balances[l.id]-share); rLumpPmts[l.id]=(rLumpPmts[l.id]||0)+share; });
      } else {
        let rem=ls.amount;
        for(const l of sorted){if(balances[l.id]<=0) continue;const a=Math.min(rem,balances[l.id]);balances[l.id]-=a;rLumpPmts[l.id]=(rLumpPmts[l.id]||0)+a;rem-=a;if(rem<=0) break;}
      }
    });
    let rem=base;
    const rPmts={},rInt={},rBal={};
    stillActive.forEach(l=>{
      const int=balances[l.id]*(l.rate/100/12);
      const dynMin=dynamicMins?Math.max(int+balances[l.id]*0.01,l.payment*0.1):l.payment;
      const minPmt=Math.min(dynMin,balances[l.id]+int);
      balances[l.id]=Math.max(0,balances[l.id]+int-minPmt);
      rInt[l.id]=int;rPmts[l.id]=minPmt;intTotals[l.id]+=int;rem-=minPmt;
    });
    for(const l of stillActive){
      if(balances[l.id]<=0.005||rem<=0){if(rem<=0) break;continue;}
      const ex=Math.min(rem,balances[l.id]);
      rPmts[l.id]=(rPmts[l.id]||0)+ex;balances[l.id]=Math.max(0,balances[l.id]-ex);rem-=ex;
    }
    stillActive.forEach(l=>{
      rBal[l.id]=Math.max(0,balances[l.id]);
      if(balances[l.id]<0.005&&!paidOff[l.id]){
        balances[l.id]=0;paidOff[l.id]=true;
        payoffs.push({id:l.id,name:l.name,color:l.color,type:l.type,month,date:addMo(new Date(),month)});
      }
    });
    rows.push({month,payments:{...rPmts},interest:{...rInt},balances:{...rBal},lumpAmount:monthLump,lumpPayments:{...rLumpPmts}});
  }
  const totalInterest=Object.values(intTotals).reduce((s,v)=>s+v,0);
  return {months:rows,loanPayoffs:payoffs,totalInterest,totalPaid:active.reduce((s,l)=>s+l.balance,0)+totalInterest,totalMonths:month,loans:active,totalBudget:base};
}

// ─── Storage ───────────────────────────────────────────────────────────────────
let _cloudAvailable=null;
async function probeCloudStorage(){
  if(_cloudAvailable!==null) return _cloudAvailable;
  if(!window?.storage?.get){_cloudAvailable=false;return false;}
  try{
    await Promise.race([window.storage.get("__probe__",false),new Promise((_,r)=>setTimeout(()=>r(new Error("timeout")),2500))]);
    _cloudAvailable=true;
  }catch{_cloudAvailable=false;}
  return _cloudAvailable;
}
async function storeGet(key,shared=false){
  if(await probeCloudStorage()){
    try{const r=await window.storage.get(key,shared);return r?JSON.parse(r.value):null;}
    catch{_cloudAvailable=false;}
  }
  try{const v=localStorage.getItem(key);return v?JSON.parse(v):null;}catch{return null;}
}
async function storeSet(key,value,shared=false){
  if(await probeCloudStorage()){
    try{await window.storage.set(key,JSON.stringify(value),shared);return;}
    catch{_cloudAvailable=false;}
  }
  try{localStorage.setItem(key,JSON.stringify(value));}catch{}
}
const hasCloudStorage=()=>_cloudAvailable===true;
async function callClaude(apiKey,body){
  const headers={"Content-Type":"application/json"};
  if(apiKey&&apiKey.trim()) headers["x-api-key"]=apiKey.trim();
  const res=await fetch(API_URL,{method:"POST",headers,body:JSON.stringify(body)});
  if(!res.ok) throw new Error(`API ${res.status}`);
  return res;
}

// ─── Theme + Responsive ────────────────────────────────────────────────────────
function useTheme(dm){
  return{
    bg:dm?"#020617":"#f1f5f9",panelBg:dm?"#0f172a":"#ffffff",
    surf:dm?"#1e293b":"#f1f5f9",deepBg:dm?"#0a0f1e":"#ffffff",
    border:dm?"#1e293b":"#e2e8f0",border2:dm?"#334155":"#cbd5e1",
    tx1:dm?"#f1f5f9":"#0f172a",tx2:dm?"#94a3b8":"#64748b",tx3:dm?"#475569":"#94a3b8",
  };
}
function useBreakpoint(){
  const [w,setW]=useState(()=>typeof window!=="undefined"?window.innerWidth:1200);
  useEffect(()=>{
    const h=()=>setW(window.innerWidth);
    window.addEventListener("resize",h);
    return()=>window.removeEventListener("resize",h);
  },[]);
  return{isMobile:w<640,isTablet:w<1024,width:w};
}

// ─── Markdown ──────────────────────────────────────────────────────────────────
function Markdown({text,tx1,tx2}){
  if(!text) return null;
  return(
    <div>
      {text.split("\n").map((line,i)=>{
        if(line.startsWith("## ")||line.startsWith("### "))
          return <div key={i} style={{fontWeight:800,fontSize:14,color:tx1,margin:"14px 0 4px"}}>{line.replace(/^#+\s/,"")}</div>;
        if(line.startsWith("- ")||line.startsWith("• ")){
          const parts=line.replace(/^[-•]\s/,"").split(/(\*\*[^*]+\*\*)/g);
          return <div key={i} style={{display:"flex",gap:8,margin:"3px 0",fontSize:12,color:tx2,lineHeight:1.6}}><span style={{color:"#6366f1",flexShrink:0}}>•</span><span>{parts.map((p,j)=>p.startsWith("**")&&p.endsWith("**")?<strong key={j} style={{color:tx1}}>{p.slice(2,-2)}</strong>:p)}</span></div>;
        }
        if(!line.trim()) return <div key={i} style={{height:6}}/>;
        const parts=line.split(/(\*\*[^*]+\*\*)/g);
        return <div key={i} style={{fontSize:12,color:tx2,lineHeight:1.7,margin:"2px 0"}}>{parts.map((p,j)=>p.startsWith("**")&&p.endsWith("**")?<strong key={j} style={{color:tx1,fontWeight:700}}>{p.slice(2,-2)}</strong>:p)}</div>;
      })}
    </div>
  );
}

// ─── Delete Confirm ────────────────────────────────────────────────────────────
function DeleteConfirm({loanName,onConfirm,onCancel,darkMode}){
  const t=useTheme(darkMode);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:t.panelBg,borderRadius:16,padding:24,maxWidth:340,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
        <div style={{fontSize:36,textAlign:"center",marginBottom:12}}>🗑️</div>
        <div style={{fontWeight:800,fontSize:16,color:t.tx1,textAlign:"center",marginBottom:6}}>Delete Loan?</div>
        <div style={{fontSize:13,color:t.tx2,textAlign:"center",marginBottom:20}}>This will permanently remove <strong style={{color:t.tx1}}>{loanName}</strong>.</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onCancel} style={{flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13}}>Cancel</button>
          <button onClick={onConfirm} style={{flex:1,background:"#ef4444",border:"none",borderRadius:10,padding:"10px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13}}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Modal ─────────────────────────────────────────────────────────────
function ProfileModal({profile,onSave,onClose,onSwitch,allProfiles,darkMode}){
  const t=useTheme(darkMode);
  const isNew=!profile||!profile.id;
  const [name,setName]=useState(profile?.name||"");
  const [pin,setPin]=useState(profile?.pin||"");
  const [avatarColor,setAvatarColor]=useState(profile?.avatarColor||"#6366f1");
  const [pinError,setPinError]=useState("");
  const [recovering,setRecovering]=useState(false);
  const [recoverPin,setRecoverPin]=useState("");
  const [recoverError,setRecoverError]=useState("");
  const iS={width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 12px",color:t.tx1,fontSize:13,boxSizing:"border-box"};

  async function handleSave(){
    if(!name.trim()) return;
    if(isNew&&!pin.trim()){setPinError("Set a Recovery PIN to protect your data.");return;}
    const cleanPin=pin.trim().toLowerCase().replace(/\s+/g,"_");
    const stableId=cleanPin?"pin_"+cleanPin:generateId();
    const p={...profile,id:profile?.id||stableId,name:name.trim(),pin:pin.trim().toLowerCase(),avatarColor,createdAt:profile?.createdAt||new Date().toISOString()};
    await storeSet(`lt_profile_${p.id}`,p,true);
    onSave(p);
  }
  async function handleRecover(){
    if(!recoverPin.trim()){setRecoverError("Enter your Recovery PIN.");return;}
    const allProfs=await storeGet("cc_profiles",true)||[];
    const found=allProfs.find(p=>p.pin&&p.pin.toLowerCase()===recoverPin.trim().toLowerCase());
    if(found){onSwitch(found.id);}else{setRecoverError("No profile found with that PIN.");}
  }

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:t.panelBg,borderRadius:20,width:"100%",maxWidth:440,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:17,color:t.tx1}}>👤 {isNew?"Create Profile":"Edit Profile"}</div>
          {!isNew&&<button onClick={onClose} style={{background:t.surf,border:"none",borderRadius:8,padding:"5px 11px",color:t.tx1,cursor:"pointer"}}>✕</button>}
        </div>
        {recovering?(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:13,color:t.tx2}}>Enter the Recovery PIN you set when creating your profile.</div>
            <input value={recoverPin} onChange={e=>setRecoverPin(e.target.value)} placeholder="Recovery PIN" style={iS}/>
            {recoverError&&<div style={{fontSize:12,color:"#ef4444"}}>{recoverError}</div>}
            <button onClick={handleRecover} style={{background:"#6366f1",border:"none",borderRadius:10,padding:"10px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>Recover Profile</button>
            <button onClick={()=>setRecovering(false)} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx2,cursor:"pointer",fontWeight:600,fontSize:13}}>← Back</button>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div><label style={{fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600}}>Your Name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Alex Smith" style={iS}/></div>
            <div>
              <label style={{fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600}}>Recovery PIN</label>
              <input value={pin} onChange={e=>{setPin(e.target.value);setPinError("");}} placeholder="A word you'll remember" style={{...iS,borderColor:pinError?"#ef4444":t.border}}/>
              {pinError&&<div style={{fontSize:11,color:"#ef4444",marginTop:3}}>{pinError}</div>}
              <div style={{fontSize:11,color:t.tx3,marginTop:4}}>Same PIN as CardTracker — one profile for all modules.</div>
            </div>
            <div>
              <label style={{fontSize:11,color:t.tx2,display:"block",marginBottom:6,fontWeight:600}}>Avatar Color</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {AVATAR_COLORS.map(c=><button key={c} onClick={()=>setAvatarColor(c)} style={{width:28,height:28,borderRadius:"50%",background:c,border:avatarColor===c?"3px solid #fff":"3px solid transparent",cursor:"pointer",outline:avatarColor===c?"2px solid "+c:"none",outlineOffset:2}}/>)}
              </div>
            </div>
            {allProfiles&&allProfiles.length>1&&(
              <div style={{background:t.surf,borderRadius:10,padding:"10px 14px"}}>
                <div style={{fontSize:11,color:t.tx2,marginBottom:6,fontWeight:600}}>Switch Profile</div>
                {allProfiles.filter(p=>p.id!==profile?.id).map(p=>(
                  <button key={p.id} onClick={()=>onSwitch(p.id)} style={{width:"100%",background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 12px",color:t.tx1,cursor:"pointer",textAlign:"left",fontSize:12,display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:p.avatarColor||"#6366f1",flexShrink:0}}/>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <button onClick={handleSave} disabled={!name.trim()} style={{background:name.trim()?"#6366f1":t.surf,border:"none",borderRadius:10,padding:"11px 0",color:name.trim()?"#fff":t.tx3,cursor:name.trim()?"pointer":"default",fontWeight:700,fontSize:14}}>
              {isNew?"Create Profile →":"Save Changes"}
            </button>
            {isNew&&<button onClick={()=>setRecovering(true)} style={{background:"none",border:"none",color:"#6366f1",cursor:"pointer",fontSize:12,fontWeight:600,textAlign:"center",padding:"4px 0"}}>Recover existing profile with PIN →</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── API Key Modal ─────────────────────────────────────────────────────────────
function ApiKeyModal({currentKey,onSave,onClose,darkMode}){
  const [key,setKey]=useState(currentKey||"");
  const [show,setShow]=useState(false);
  const t=useTheme(darkMode);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:t.panelBg,borderRadius:20,width:"100%",maxWidth:480,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div>
            <div style={{fontWeight:800,fontSize:16,color:t.tx1}}>🔑 Anthropic API Key</div>
            <div style={{fontSize:12,color:t.tx2,marginTop:3}}>Shared across all Financial Freedom Platform modules</div>
          </div>
          <button onClick={onClose} style={{background:t.surf,border:"none",borderRadius:8,padding:"5px 11px",color:t.tx1,cursor:"pointer"}}>✕</button>
        </div>
        {currentKey&&<div style={{background:"#10b98118",border:"1px solid #10b98133",borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:12,color:"#10b981"}}>✓ API key active — AI features enabled</div>}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:t.tx2,marginBottom:5,fontWeight:600}}>API Key</div>
          <div style={{display:"flex",gap:6}}>
            <input type={show?"text":"password"} value={key} onChange={e=>setKey(e.target.value)} placeholder="sk-ant-..." style={{flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 12px",color:t.tx1,fontSize:13}}/>
            <button onClick={()=>setShow(s=>!s)} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 12px",color:t.tx2,cursor:"pointer",fontSize:12}}>{show?"🙈":"👁"}</button>
          </div>
        </div>
        <div style={{background:"#6366f110",border:"1px solid #6366f120",borderRadius:8,padding:"8px 12px",fontSize:11,color:t.tx2,marginBottom:16,lineHeight:1.6}}>
          💡 Get your key at <strong style={{color:"#6366f1"}}>console.anthropic.com</strong>. One key for CardTracker, LoanTracker, and all future modules.
        </div>
        <div style={{display:"flex",gap:8}}>
          {currentKey&&<button onClick={()=>onSave("")} style={{flex:1,background:"#ef444418",border:"1px solid #ef444433",borderRadius:10,padding:"9px 0",color:"#ef4444",cursor:"pointer",fontWeight:600,fontSize:13}}>Remove</button>}
          <button onClick={onClose} style={{flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600}}>Cancel</button>
          <button onClick={()=>{onSave(key.trim());onClose();}} style={{flex:2,background:"#6366f1",border:"none",borderRadius:10,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>Save Key</button>
        </div>
      </div>
    </div>
  );
}

// ─── Loan Form Modal ───────────────────────────────────────────────────────────
function LoanFormModal({initial,onSave,onClose,darkMode}){
  const t=useTheme(darkMode);
  const isEdit=!!(initial&&initial.id);
  const typeDefault=LOAN_TYPES.find(lt=>lt.id===(initial?.type||"auto"))||LOAN_TYPES[0];
  const [form,setForm]=useState({...DEFAULT_LOAN,...initial,color:initial?.color||typeDefault.defaultColor});
  const [errors,setErrors]=useState({});

  function autoCalc(field,val){
    const f={...form,[field]:val};
    const bal=parseFloat(f.currentBalance)||0;
    const rate=parseFloat(f.interestRate)||0;
    const pmt=parseFloat(f.monthlyPayment)||0;
    const term=parseInt(f.termMonths)||0;
    if((field==="termMonths"||field==="currentBalance"||field==="interestRate")&&bal>0&&rate>0){
      const months=field==="termMonths"?parseInt(val):term;
      if(months>0&&!pmt) f.monthlyPayment=calcMonthlyPayment(bal,rate,months).toFixed(2);
    }
    if((field==="monthlyPayment"||field==="currentBalance"||field==="interestRate")&&bal>0&&rate>0){
      const p=field==="monthlyPayment"?parseFloat(val):pmt;
      if(p>0){const r=calcRemainingMonths(bal,rate,p);if(r>0&&r<990) f.remainingMonths=r.toString();}
    }
    return f;
  }
  function handleChange(field,val){setForm(autoCalc(field,val));if(errors[field]) setErrors(e=>({...e,[field]:""}))}
  function handleTypeChange(type){const lt=LOAN_TYPES.find(t=>t.id===type)||LOAN_TYPES[0];setForm(f=>({...f,type,color:lt.defaultColor}));}
  function validate(){
    const e={};
    if(!form.name.trim()) e.name="Required";
    if(!form.currentBalance||parseFloat(form.currentBalance)<=0) e.currentBalance="Required";
    if(form.interestRate===""||parseFloat(form.interestRate)<0) e.interestRate="Required";
    if(!form.monthlyPayment||parseFloat(form.monthlyPayment)<=0) e.monthlyPayment="Required";
    setErrors(e);return Object.keys(e).length===0;
  }
  function save(){
    if(!validate()) return;
    const loan={...form,id:form.id||generateId(),originalBalance:form.originalBalance||form.currentBalance,
      currentBalance:parseFloat(form.currentBalance).toFixed(2),interestRate:parseFloat(form.interestRate).toFixed(3),
      monthlyPayment:parseFloat(form.monthlyPayment).toFixed(2),termMonths:parseInt(form.termMonths)||0,
      remainingMonths:(parseInt(form.remainingMonths)||calcRemainingMonths(parseFloat(form.currentBalance),parseFloat(form.interestRate),parseFloat(form.monthlyPayment))).toString(),
    };
    onSave(loan);
  }
  const iS=(err)=>({width:"100%",background:t.surf,border:`1px solid ${err?"#ef4444":t.border}`,borderRadius:8,padding:"9px 12px",color:t.tx1,fontSize:13,boxSizing:"border-box"});
  const lS={fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      <div style={{background:t.panelBg,borderRadius:20,width:"100%",maxWidth:520,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{margin:0,color:t.tx1,fontSize:17,fontWeight:800}}>{isEdit?"✏️ Edit Loan":"➕ Add Loan"}</h2>
          <button onClick={onClose} style={{background:t.surf,border:"none",borderRadius:8,padding:"5px 11px",color:t.tx1,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{marginBottom:16}}>
          <label style={lS}>Loan Type</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {LOAN_TYPES.map(lt=>(
              <button key={lt.id} onClick={()=>handleTypeChange(lt.id)} style={{display:"flex",alignItems:"center",gap:5,background:form.type===lt.id?lt.defaultColor+"22":t.surf,border:`2px solid ${form.type===lt.id?lt.defaultColor:t.border}`,borderRadius:9,padding:"7px 12px",color:form.type===lt.id?lt.defaultColor:t.tx2,cursor:"pointer",fontSize:12,fontWeight:form.type===lt.id?700:500}}>
                {lt.icon} {lt.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <label style={lS}>Color</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {PRESET_COLORS.map(c=><button key={c} onClick={()=>setForm(f=>({...f,color:c}))} style={{width:26,height:26,borderRadius:"50%",background:c,border:form.color===c?"3px solid #fff":"3px solid transparent",cursor:"pointer",outline:form.color===c?"2px solid "+c:"none",outlineOffset:2}}/>)}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div style={{gridColumn:"1/-1"}}>
            <label style={lS}>Loan Name *</label>
            <input value={form.name} onChange={e=>handleChange("name",e.target.value)} placeholder="e.g. Toyota Camry" style={{...iS(errors.name)}}/>
            {errors.name&&<div style={{fontSize:10,color:"#ef4444",marginTop:2}}>{errors.name}</div>}
          </div>
          <div>
            <label style={lS}>Lender</label>
            <input value={form.lender} onChange={e=>setForm(f=>({...f,lender:e.target.value}))} placeholder="e.g. Chase Bank" style={iS()}/>
          </div>
          <div>
            <label style={lS}>Interest Rate (APR %)</label>
            <input type="number" value={form.interestRate} onChange={e=>handleChange("interestRate",e.target.value)} placeholder="e.g. 6.5" style={{...iS(errors.interestRate)}} min="0" step="0.01"/>
            {errors.interestRate&&<div style={{fontSize:10,color:"#ef4444",marginTop:2}}>{errors.interestRate}</div>}
          </div>
          <div>
            <label style={lS}>Original Balance ($)</label>
            <input type="number" value={form.originalBalance} onChange={e=>setForm(f=>({...f,originalBalance:e.target.value}))} placeholder="e.g. 25000" style={iS()} min="0"/>
          </div>
          <div>
            <label style={lS}>Current Balance ($) *</label>
            <input type="number" value={form.currentBalance} onChange={e=>handleChange("currentBalance",e.target.value)} placeholder="e.g. 18500" style={{...iS(errors.currentBalance)}} min="0"/>
            {errors.currentBalance&&<div style={{fontSize:10,color:"#ef4444",marginTop:2}}>{errors.currentBalance}</div>}
          </div>
          <div>
            <label style={lS}>Monthly Payment ($) *</label>
            <input type="number" value={form.monthlyPayment} onChange={e=>handleChange("monthlyPayment",e.target.value)} placeholder="e.g. 450" style={{...iS(errors.monthlyPayment)}} min="0"/>
            {errors.monthlyPayment&&<div style={{fontSize:10,color:"#ef4444",marginTop:2}}>{errors.monthlyPayment}</div>}
          </div>
          <div>
            <label style={lS}>Original Term (months)</label>
            <input type="number" value={form.termMonths} onChange={e=>handleChange("termMonths",e.target.value)} placeholder="e.g. 60" style={iS()} min="1"/>
          </div>
          <div>
            <label style={lS}>Remaining Months</label>
            <input type="number" value={form.remainingMonths} onChange={e=>handleChange("remainingMonths",e.target.value)} placeholder="Auto-calculated" style={iS()} min="1"/>
          </div>
          <div>
            <label style={lS}>Payment Due Day</label>
            <input type="number" value={form.nextPaymentDay} onChange={e=>setForm(f=>({...f,nextPaymentDay:e.target.value}))} placeholder="e.g. 15" style={iS()} min="1" max="31"/>
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <label style={lS}>Notes</label>
          <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any notes..." rows={2} style={{...iS(),resize:"vertical",fontFamily:"inherit"}}/>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13}}>Cancel</button>
          <button onClick={save} style={{flex:2,background:"#6366f1",border:"none",borderRadius:10,padding:"10px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>{isEdit?"Save Changes":"Add Loan"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Pay Modal ───────────────────────────────────────────────────────────
function QuickPayModal({loan,onConfirm,onClose,darkMode}){
  const t=useTheme(darkMode);
  const bal=parseFloat(loan.currentBalance)||0;
  const rate=parseFloat(loan.interestRate)||0;
  const expected=parseFloat(loan.monthlyPayment)||0;
  const monthlyInterest=bal*(rate/100/12);
  const [amount,setAmount]=useState(expected.toFixed(2));
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const paid=parseFloat(amount)||0;
  const principal=Math.max(0,paid-monthlyInterest);
  const newBal=Math.max(0,bal-principal);
  const diff=paid-expected;
  const lt=getLoanType(loan.type);
  const iS={width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 12px",color:t.tx1,fontSize:14,boxSizing:"border-box",fontFamily:"monospace"};
  function confirm(){if(!paid||paid<=0) return;onConfirm({loanId:loan.id,expected,actual:paid,principal,interest:monthlyInterest,newBalance:newBal,date,loanName:loan.name});}
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:5000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:t.panelBg,borderRadius:20,width:"100%",maxWidth:400,boxShadow:"0 24px 80px rgba(0,0,0,.6)"}}>
        <div style={{background:loan.color,borderRadius:"20px 20px 0 0",padding:"16px 20px"}}>
          <div style={{fontWeight:800,fontSize:16,color:"#fff"}}>{lt.icon} {loan.name}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.7)",fontFamily:"monospace",marginTop:2}}>{loan.lender||"—"} · Balance: {fmt$(bal)}</div>
        </div>
        <div style={{padding:20,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:11,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8}}>✓ Log Payment</div>
          <div style={{background:t.surf,borderRadius:12,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:9,color:t.tx3,textTransform:"uppercase"}}>Expected This Month</div><div style={{fontSize:18,fontWeight:800,color:t.tx1,fontFamily:"monospace"}}>{fmt$(expected)}</div></div>
            {diff!==0&&paid>0&&<div style={{textAlign:"right"}}><div style={{fontSize:9,color:t.tx3,textTransform:"uppercase"}}>{diff>0?"Over":"Under"}</div><div style={{fontSize:14,fontWeight:700,color:diff>0?"#10b981":"#f59e0b",fontFamily:"monospace"}}>{diff>0?"+":""}{fmt$(diff)}</div></div>}
          </div>
          <div><div style={{fontSize:11,color:t.tx2,marginBottom:5,fontWeight:600}}>Actual Amount Paid</div><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} style={iS} min="0" step="0.01" autoFocus/></div>
          <div><div style={{fontSize:11,color:t.tx2,marginBottom:5,fontWeight:600}}>Payment Date</div><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={iS}/></div>
          {paid>0&&(
            <div style={{background:"#10b98110",border:"1px solid #10b98133",borderRadius:10,padding:"10px 14px"}}>
              <div style={{fontSize:11,color:t.tx2,marginBottom:6}}>After this payment</div>
              <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
                <div><span style={{fontSize:9,color:t.tx3}}>Interest: </span><span style={{fontSize:12,fontFamily:"monospace",color:"#f97316"}}>{fmt$(monthlyInterest)}</span></div>
                <div><span style={{fontSize:9,color:t.tx3}}>Principal: </span><span style={{fontSize:12,fontFamily:"monospace",color:"#10b981"}}>{fmt$(principal)}</span></div>
                <div><span style={{fontSize:9,color:t.tx3}}>New balance: </span><span style={{fontSize:14,fontWeight:800,fontFamily:"monospace",color:t.tx1}}>{fmt$(newBal)}</span></div>
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose} style={{flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13}}>Cancel</button>
            <button onClick={confirm} disabled={!paid||paid<=0} style={{flex:2,background:paid>0?"#10b981":t.surf,border:"none",borderRadius:10,padding:"10px 0",color:paid>0?"#fff":t.tx3,cursor:paid>0?"pointer":"default",fontWeight:700,fontSize:14}}>✓ Confirm Payment</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Loan Panel ────────────────────────────────────────────────────────────────
function LoanPanel({loan,onEdit,onDelete,onQuickPay,onOpenPlanner,darkMode,globalExpanded}){
  const t=useTheme(darkMode);
  const {isMobile}=useBreakpoint();
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>setExpanded(globalExpanded),[globalExpanded]);
  const bal=parseFloat(loan.currentBalance)||0;
  const orig=parseFloat(loan.originalBalance)||bal;
  const rate=parseFloat(loan.interestRate)||0;
  const pmt=parseFloat(loan.monthlyPayment)||0;
  const rem=parseInt(loan.remainingMonths)||calcRemainingMonths(bal,rate,pmt);
  const paidPct=orig>0?Math.min(100,((orig-bal)/orig)*100):0;
  const lt=getLoanType(loan.type);
  const payoffDate=rem>0&&rem<990?fmtMo(addMo(new Date(),rem)):"—";
  const monthlyInterest=bal*(rate/100/12);
  const principalPct=pmt>0?Math.min(100,(Math.max(0,pmt-monthlyInterest)/pmt)*100):0;
  return(
    <div style={{borderRadius:16,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,.15)"}}>
      <div style={{background:`linear-gradient(135deg,${loan.color},${loan.color}cc)`,padding:"14px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
              <span style={{fontSize:16}}>{lt.icon}</span>
              <div style={{fontWeight:800,fontSize:15,color:"#fff"}}>{loan.name}</div>
              <span style={{fontSize:9,background:"rgba(255,255,255,.2)",color:"rgba(255,255,255,.9)",borderRadius:5,padding:"2px 7px",fontWeight:700,textTransform:"uppercase"}}>{lt.label}</span>
            </div>
            {loan.lender&&<div style={{fontSize:11,color:"rgba(255,255,255,.65)",marginBottom:4}}>{loan.lender}</div>}
            <div style={{fontSize:22,fontWeight:900,color:"#fff",fontFamily:"monospace"}}>{fmt$(bal)}</div>
          </div>
          <div style={{display:"flex",gap:5,flexShrink:0,marginLeft:8}}>
            <button onClick={()=>onQuickPay&&onQuickPay(loan)} style={{background:"rgba(16,185,129,.25)",border:"1px solid rgba(16,185,129,.4)",borderRadius:7,padding:"4px 9px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>✓ Pay</button>
            <button onClick={()=>setExpanded(e=>!e)} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:7,padding:"4px 9px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>{expanded?"▲":"▼"}</button>
            <button onClick={()=>onEdit(loan)} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:7,padding:"4px 9px",color:"#fff",cursor:"pointer",fontSize:11}}>✎</button>
            <button onClick={()=>onDelete(loan)} style={{background:"rgba(0,0,0,.2)",border:"none",borderRadius:7,padding:"4px 9px",color:"#fff",cursor:"pointer",fontSize:11}}>✕</button>
          </div>
        </div>
        <div style={{marginTop:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:10,color:"rgba(255,255,255,.65)"}}>Paid off</span>
            <span style={{fontSize:11,fontWeight:700,color:"#fff"}}>{paidPct.toFixed(1)}%</span>
          </div>
          <div style={{height:6,background:"rgba(255,255,255,.2)",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${paidPct}%`,background:"rgba(255,255,255,.85)",borderRadius:3,transition:"width .5s"}}/>
          </div>
        </div>
      </div>
      <div style={{background:t.panelBg,display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",borderBottom:`1px solid ${t.border}`}}>
        {[{l:"Monthly",v:fmt$(pmt),c:"#6366f1"},{l:"Rate",v:`${rate}% APR`,c:"#f97316"},{l:"Remaining",v:rem>=990?"Long term":`${rem} mos`,c:t.tx1},{l:"Payoff",v:payoffDate,c:"#10b981"}].map((s,i)=>(
          <div key={s.l} style={{padding:"10px 14px",textAlign:"center",borderRight:i<3?`1px solid ${t.border}`:"none"}}>
            <div style={{fontSize:9,color:t.tx3,textTransform:"uppercase",letterSpacing:.6,marginBottom:3}}>{s.l}</div>
            <div style={{fontSize:13,fontWeight:700,color:s.c,fontFamily:"monospace",whiteSpace:"nowrap"}}>{s.v}</div>
          </div>
        ))}
      </div>
      {expanded&&(
        <div style={{background:t.panelBg,padding:"14px 16px",display:"flex",flexDirection:"column",gap:12,borderTop:`1px solid ${t.border}`}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:t.tx3,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Monthly Payment Breakdown</div>
            <div style={{height:8,background:t.surf,borderRadius:4,overflow:"hidden",display:"flex"}}>
              <div style={{width:`${principalPct}%`,background:"#10b981"}}/>
              <div style={{flex:1,background:"#f97316"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
              <span style={{fontSize:10,color:"#10b981"}}>Principal {fmt$(Math.max(0,pmt-monthlyInterest))}</span>
              <span style={{fontSize:10,color:"#f97316"}}>Interest {fmt$(monthlyInterest)}</span>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{l:"Original Balance",v:fmt$(orig)},{l:"Amount Paid",v:fmt$(orig-bal)},{l:"Remaining Balance",v:fmt$(bal)},{l:"Interest Rate",v:`${rate}% APR`}].map(s=>(
              <div key={s.l} style={{background:t.surf,borderRadius:8,padding:"8px 10px"}}>
                <div style={{fontSize:9,color:t.tx3,textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>{s.l}</div>
                <div style={{fontSize:12,fontWeight:700,color:t.tx1,fontFamily:"monospace"}}>{s.v}</div>
              </div>
            ))}
          </div>
          {loan.notes&&<div style={{background:t.surf,borderRadius:8,padding:"8px 10px",fontSize:12,color:t.tx2}}>📝 {loan.notes}</div>}
          <button onClick={()=>onOpenPlanner&&onOpenPlanner(loan)} style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",border:"none",borderRadius:10,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13}}>
            📊 Open Payoff Planner →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Summary Bar ───────────────────────────────────────────────────────────────
function SummaryBar({loans,darkMode}){
  const t=useTheme(darkMode);
  const {isMobile}=useBreakpoint();
  const totalBal=loans.reduce((s,l)=>s+(parseFloat(l.currentBalance)||0),0);
  const totalOrig=loans.reduce((s,l)=>s+(parseFloat(l.originalBalance)||parseFloat(l.currentBalance)||0),0);
  const totalPmt=loans.reduce((s,l)=>s+(parseFloat(l.monthlyPayment)||0),0);
  const totalPaid=totalOrig-totalBal;
  const paidPct=totalOrig>0?(totalPaid/totalOrig)*100:0;
  return(
    <div style={{background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:16,padding:"16px 20px",marginBottom:16}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:paidPct>0?14:0}}>
        {[{l:"Total Debt",v:fmt$(totalBal),c:"#ef4444"},{l:"Monthly Payments",v:fmt$(totalPmt),c:"#6366f1"},{l:"Total Paid Down",v:fmt$(totalPaid),c:"#10b981"},{l:"Overall Progress",v:`${paidPct.toFixed(1)}%`,c:"#f59e0b"}].map(s=>(
          <div key={s.l} style={{textAlign:"center"}}>
            <div style={{fontSize:9,color:t.tx3,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{s.l}</div>
            <div style={{fontSize:isMobile?16:20,fontWeight:800,color:s.c,fontFamily:"monospace"}}>{s.v}</div>
          </div>
        ))}
      </div>
      {paidPct>0&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:10,color:t.tx3}}>Debt eliminated</span>
            <span style={{fontSize:10,color:"#10b981",fontWeight:700}}>{paidPct.toFixed(1)}% paid down</span>
          </div>
          <div style={{height:8,background:t.surf,borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${paidPct}%`,background:"linear-gradient(90deg,#6366f1,#10b981)",borderRadius:4,transition:"width .6s"}}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Charts ────────────────────────────────────────────────────────────────────
function BalanceChart({schedule,loan,darkMode,title}){
  const t=useTheme(darkMode);
  const W=600,H=240,PL=64,PR=16,PT=20,PB=48,cW=W-PL-PR,cH=H-PT-PB;
  if(!schedule?.months?.length) return null;
  const startBal=parseFloat(loan.currentBalance)||0;
  const step=Math.max(1,Math.floor(schedule.months.length/60));
  const sampled=[{month:0,balance:startBal},...schedule.months.filter((_,i)=>i%step===0||i===schedule.months.length-1).map(r=>({month:r.month,balance:r.balance}))];
  const maxBal=Math.max(startBal,1),maxMo=schedule.totalMonths||1;
  const xS=m=>(m/maxMo)*cW,yS=b=>cH-(b/maxBal)*cH;
  const pts=sampled.map(r=>`${PL+xS(r.month)},${PT+yS(r.balance)}`).join(" ");
  const yTicks=[0,.25,.5,.75,1].map(f=>({val:maxBal*f,y:yS(maxBal*f)}));
  const xTicks=[];for(let m=0;m<=maxMo;m+=Math.max(12,Math.floor(maxMo/6))) xTicks.push({m,x:xS(m)});
  return(
    <div style={{background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,padding:"16px 20px"}}>
      {title&&<div style={{fontSize:11,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>{title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}>
        {yTicks.map((tk,i)=><g key={i}><line x1={PL} y1={PT+tk.y} x2={PL+cW} y2={PT+tk.y} stroke={t.border} strokeWidth=".5" strokeDasharray="4,4"/><text x={PL-6} y={PT+tk.y+4} textAnchor="end" fontSize={9} fill={t.tx3}>{fmt$(tk.val).replace(".00","")}</text></g>)}
        {xTicks.map((tk,i)=><g key={i}><line x1={PL+tk.x} y1={PT+cH} x2={PL+tk.x} y2={PT+cH+4} stroke={t.tx3} strokeWidth="1"/><text x={PL+tk.x} y={PT+cH+16} textAnchor="middle" fontSize={9} fill={t.tx3}>{tk.m===0?"Now":`Mo ${tk.m}`}</text></g>)}
        <line x1={PL} y1={PT} x2={PL} y2={PT+cH} stroke={t.border2} strokeWidth="1"/>
        <line x1={PL} y1={PT+cH} x2={PL+cW} y2={PT+cH} stroke={t.border2} strokeWidth="1"/>
        <polygon points={`${PL},${PT+cH} ${pts} ${PL+xS(schedule.totalMonths)},${PT+cH}`} fill={loan.color} fillOpacity=".15"/>
        <polyline points={pts} fill="none" stroke={loan.color} strokeWidth="2.5" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}
function ComparisonChart({avalanche,snowball,darkMode}){
  const t=useTheme(darkMode);
  const W=600,H=220,PL=64,PR=16,PT=20,PB=48,cW=W-PL-PR,cH=H-PT-PB;
  if(!avalanche?.months?.length) return null;
  const maxBal=Math.max(...(avalanche.loans||[]).map(l=>l.balance),1);
  const maxMo=Math.max(avalanche.totalMonths,snowball.totalMonths,1);
  const xS=m=>(m/maxMo)*cW,yS=b=>cH-(b/maxBal)*cH;
  function totals(s){return [{m:0,b:s.loans?.reduce((a,l)=>a+l.balance,0)||0},...s.months.map(r=>({m:r.month,b:Object.values(r.balances).reduce((a,v)=>a+v,0)}))];}
  const av=totals(avalanche),sn=totals(snowball);
  const yTicks=[0,.25,.5,.75,1].map(f=>({val:maxBal*f,y:yS(maxBal*f)}));
  const xTicks=[];for(let m=0;m<=maxMo;m+=Math.max(6,Math.floor(maxMo/8))) xTicks.push({m,x:xS(m)});
  const line=pts=>pts.map(p=>`${PL+xS(p.m)},${PT+yS(p.b)}`).join(" ");
  return(
    <div style={{background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,padding:"16px 20px"}}>
      <div style={{fontSize:11,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>📊 Avalanche vs Snowball — Total Balance Over Time</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}>
        {yTicks.map((tk,i)=><g key={i}><line x1={PL} y1={PT+tk.y} x2={PL+cW} y2={PT+tk.y} stroke={t.border} strokeWidth=".5" strokeDasharray="4,4"/><text x={PL-6} y={PT+tk.y+4} textAnchor="end" fontSize={9} fill={t.tx3}>{fmt$(tk.val).replace(".00","")}</text></g>)}
        {xTicks.map((tk,i)=><g key={i}><line x1={PL+tk.x} y1={PT+cH} x2={PL+tk.x} y2={PT+cH+4} stroke={t.tx3} strokeWidth="1"/><text x={PL+tk.x} y={PT+cH+16} textAnchor="middle" fontSize={9} fill={t.tx3}>{tk.m===0?"Now":`Mo ${tk.m}`}</text></g>)}
        <line x1={PL} y1={PT} x2={PL} y2={PT+cH} stroke={t.border2} strokeWidth="1"/>
        <line x1={PL} y1={PT+cH} x2={PL+cW} y2={PT+cH} stroke={t.border2} strokeWidth="1"/>
        <polygon points={`${PL+xS(av[0].m)},${PT+cH} ${line(av)} ${PL+xS(av[av.length-1].m)},${PT+cH}`} fill="#f97316" fillOpacity=".12"/>
        <polygon points={`${PL+xS(sn[0].m)},${PT+cH} ${line(sn)} ${PL+xS(sn[sn.length-1].m)},${PT+cH}`} fill="#3b82f6" fillOpacity=".12"/>
        <polyline points={line(av)} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinejoin="round"/>
        <polyline points={line(sn)} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="6,3"/>
        <g transform={`translate(${PL+10},${PT+10})`}><line x1={0} y1={5} x2={20} y2={5} stroke="#f97316" strokeWidth="2.5"/><text x={24} y={9} fontSize={9} fill={t.tx2}>🔥 Avalanche ({avalanche.totalMonths} mo)</text></g>
        <g transform={`translate(${PL+10},${PT+24})`}><line x1={0} y1={5} x2={20} y2={5} stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="6,3"/><text x={24} y={9} fontSize={9} fill={t.tx2}>❄️ Snowball ({snowball.totalMonths} mo)</text></g>
      </svg>
    </div>
  );
}

// ─── Single Loan Dual-Line Chart ──────────────────────────────────────────────
function SingleLoanDualChart({baseSchedule,accelSchedule,loan,darkMode}){
  const t=useTheme(darkMode);
  const W=600,H=260,PL=64,PR=120,PT=24,PB=48,cW=W-PL-PR,cH=H-PT-PB;
  if(!baseSchedule?.months?.length) return null;
  const startBal=parseFloat(loan.currentBalance)||0;
  const maxMo=Math.max(baseSchedule.totalMonths,accelSchedule?.totalMonths||0,1);
  const maxBal=Math.max(startBal,1);
  const xS=m=>(m/maxMo)*cW;
  const yS=b=>cH-(Math.min(b,maxBal)/maxBal)*cH;
  function sample(sch){
    const step=Math.max(1,Math.floor(sch.months.length/80));
    return [{month:0,balance:startBal},...sch.months.filter((_,i)=>i%step===0||i===sch.months.length-1).map(r=>({month:r.month,balance:r.balance}))];
  }
  const basePts=sample(baseSchedule).map(r=>`${PL+xS(r.month)},${PT+yS(r.balance)}`).join(" ");
  const accelPts=accelSchedule?sample(accelSchedule).map(r=>`${PL+xS(r.month)},${PT+yS(r.balance)}`).join(" "):null;
  const yTicks=[0,.25,.5,.75,1].map(f=>({val:maxBal*f,y:yS(maxBal*f)}));
  const xTicks=[];for(let m=0;m<=maxMo;m+=Math.max(12,Math.floor(maxMo/6))) xTicks.push({m,x:xS(m)});
  const hasAccel=accelSchedule&&accelSchedule.totalMonths<baseSchedule.totalMonths;
  return(
    <div style={{background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,padding:"16px 20px"}}>
      <div style={{fontSize:11,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>📉 Balance Over Time</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}>
        {yTicks.map((tk,i)=>(
          <g key={i}>
            <line x1={PL} y1={PT+tk.y} x2={PL+cW} y2={PT+tk.y} stroke={t.border} strokeWidth=".5" strokeDasharray="4,4"/>
            <text x={PL-6} y={PT+tk.y+4} textAnchor="end" fontSize={9} fill={t.tx3}>{fmt$(tk.val).replace(".00","")}</text>
          </g>
        ))}
        {xTicks.map((tk,i)=>(
          <g key={i}>
            <line x1={PL+tk.x} y1={PT+cH} x2={PL+tk.x} y2={PT+cH+4} stroke={t.tx3} strokeWidth="1"/>
            <text x={PL+tk.x} y={PT+cH+16} textAnchor="middle" fontSize={9} fill={t.tx3}>{tk.m===0?"Now":`Mo ${tk.m}`}</text>
          </g>
        ))}
        <line x1={PL} y1={PT} x2={PL} y2={PT+cH} stroke={t.border2} strokeWidth="1"/>
        <line x1={PL} y1={PT+cH} x2={PL+cW} y2={PT+cH} stroke={t.border2} strokeWidth="1"/>
        {/* Base fill + line */}
        <polygon points={`${PL},${PT+cH} ${basePts} ${PL+xS(baseSchedule.totalMonths)},${PT+cH}`} fill={loan.color} fillOpacity=".1"/>
        <polyline points={basePts} fill="none" stroke={loan.color} strokeWidth="2" strokeLinejoin="round" strokeDasharray="6,3" opacity=".7"/>
        {/* Accel fill + line */}
        {accelPts&&(
          <>
            <polygon points={`${PL},${PT+cH} ${accelPts} ${PL+xS(accelSchedule.totalMonths)},${PT+cH}`} fill="#10b981" fillOpacity=".15"/>
            <polyline points={accelPts} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round"/>
          </>
        )}
        {/* Payoff markers */}
        <line x1={PL+xS(baseSchedule.totalMonths)} y1={PT} x2={PL+xS(baseSchedule.totalMonths)} y2={PT+cH} stroke={loan.color} strokeWidth="1" strokeDasharray="3,3" opacity=".5"/>
        {accelSchedule&&accelSchedule.totalMonths<baseSchedule.totalMonths&&(
          <line x1={PL+xS(accelSchedule.totalMonths)} y1={PT} x2={PL+xS(accelSchedule.totalMonths)} y2={PT+cH} stroke="#10b981" strokeWidth="1" strokeDasharray="3,3" opacity=".7"/>
        )}
        {/* Legend */}
        <g transform={`translate(${PL+cW+10},${PT+10})`}>
          <line x1={0} y1={5} x2={18} y2={5} stroke={loan.color} strokeWidth="2" strokeDasharray="6,3" opacity=".7"/>
          <text x={22} y={9} fontSize={9} fill={t.tx2}>Standard</text>
          <text x={22} y={20} fontSize={9} fill={t.tx3}>{baseSchedule.totalMonths} mo</text>
          {hasAccel&&(
            <>
              <line x1={0} y1={34} x2={18} y2={34} stroke="#10b981" strokeWidth="2.5"/>
              <text x={22} y={38} fontSize={9} fill="#10b981">Accelerated</text>
              <text x={22} y={49} fontSize={9} fill={t.tx3}>{accelSchedule.totalMonths} mo</text>
            </>
          )}
        </g>
      </svg>
    </div>
  );
}

// ─── Interest Bar Chart ────────────────────────────────────────────────────────
function StackedBar({x,barW,cH,PT,prinVal,intVal,maxVal,color,intColor,label,isAccel,baseInt,tx2,tx3}){
  const totalVal=prinVal+intVal;
  const totalH=Math.max(0,(totalVal/maxVal)*cH);
  const intH=Math.max(0,(intVal/maxVal)*cH);
  const prinH=totalH-intH;
  const barTop=PT+cH-totalH;
  return(
    <g>
      <rect x={x-barW/2} y={barTop+prinH} width={barW} height={Math.max(0,intH)} fill={intColor} rx="0"/>
      <rect x={x-barW/2} y={barTop} width={barW} height={Math.max(0,prinH)} fill={color} rx="4"/>
      <rect x={x-barW/2} y={barTop} width={barW} height={4} fill={color} rx="2"/>
      {isAccel&&intVal<baseInt&&(
        <text x={x} y={barTop-6} textAnchor="middle" fontSize={9} fill="#10b981" fontWeight="700">
          {`-${fmt$(baseInt-intVal).replace(".00","")}`}
        </text>
      )}
      <text x={x} y={PT+cH+14} textAnchor="middle" fontSize={10} fill={isAccel?"#10b981":tx2} fontWeight={isAccel?"700":"500"}>{label}</text>
      <text x={x} y={PT+cH+26} textAnchor="middle" fontSize={9} fill={tx3}>{fmt$(totalVal).replace(".00","")}</text>
    </g>
  );
}
function InterestBarChart({baseSchedule,accelSchedule,loan,darkMode}){
  const t=useTheme(darkMode);
  const W=600,H=220,PL=64,PR=24,PT=24,PB=56,cW=W-PL-PR,cH=H-PT-PB;
  if(!baseSchedule?.months?.length) return null;
  const hasAccel=accelSchedule&&accelSchedule.totalInterest<baseSchedule.totalInterest;
  const baseInt=baseSchedule.totalInterest;
  const accelInt=accelSchedule?accelSchedule.totalInterest:baseInt;
  const basePrin=baseSchedule.totalPaid-baseInt;
  const accelPrin=accelSchedule?accelSchedule.totalPaid-accelInt:basePrin;
  const maxVal=Math.max(baseSchedule.totalPaid,accelSchedule?.totalPaid||0,1);
  const barW=hasAccel?cW/2-20:cW*0.4;
  const gap=hasAccel?40:0;
  const x0=PL+(hasAccel?barW/2:cW/2-barW/2);
  const x1=hasAccel?PL+barW+gap+barW/2:0;
  const yS=v=>cH-(v/maxVal)*cH;
  const yTicks=[0,.25,.5,.75,1].map(f=>({val:maxVal*f,y:yS(maxVal*f)}));
  const barProps={barW,cH,PT,maxVal,baseInt,tx2:t.tx2,tx3:t.tx3};
  return(
    <div style={{background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,padding:"16px 20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8}}>💰 Interest Cost Comparison</div>
        {hasAccel&&(
          <div style={{background:"#10b98118",border:"1px solid #10b98133",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,color:"#10b981"}}>
            Save {fmt$(baseInt-accelInt)} in interest
          </div>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}>
        {yTicks.map((tk,i)=>(
          <g key={i}>
            <line x1={PL} y1={PT+tk.y} x2={PL+cW} y2={PT+tk.y} stroke={t.border} strokeWidth=".5" strokeDasharray="4,4"/>
            <text x={PL-6} y={PT+tk.y+4} textAnchor="end" fontSize={9} fill={t.tx3}>{fmt$(tk.val).replace(".00","")}</text>
          </g>
        ))}
        <line x1={PL} y1={PT} x2={PL} y2={PT+cH} stroke={t.border2} strokeWidth="1"/>
        <line x1={PL} y1={PT+cH} x2={PL+cW} y2={PT+cH} stroke={t.border2} strokeWidth="1"/>
        <StackedBar {...barProps} x={x0} prinVal={basePrin} intVal={baseInt} color={loan.color} intColor="#f97316" label="Standard" isAccel={false}/>
        {hasAccel&&<StackedBar {...barProps} x={x1} prinVal={accelPrin} intVal={accelInt} color="#10b981" intColor="#059669" label="Accelerated" isAccel={true}/>}
        <g transform={`translate(${PL+cW-100},${PT+8})`}>
          <rect x={0} y={0} width={10} height={10} fill={loan.color} rx="2"/>
          <text x={14} y={9} fontSize={9} fill={t.tx2}>Principal</text>
          <rect x={0} y={16} width={10} height={10} fill="#f97316" rx="2"/>
          <text x={14} y={25} fontSize={9} fill={t.tx2}>Interest</text>
        </g>
      </svg>
    </div>
  );
}

// ─── What-If Tab ───────────────────────────────────────────────────────────────
function WhatIfTab({loans,avalanche,snowball,darkMode,apiKey}){
  const t=useTheme(darkMode);
  const [messages,setMessages]=useState([{role:"assistant",content:"Hi! I'm your loan advisor. Ask me anything:\n\n• \"What if I paid $200 extra/month on my auto loan?\"\n• \"What if I refinanced my student loan to 4%?\"\n• \"Which loan should I pay off first?\"\n• \"How much would a $5,000 lump sum save me?\""}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const scrollRef=useRef(null);
  useEffect(()=>{if(scrollRef.current) scrollRef.current.scrollTop=scrollRef.current.scrollHeight;},[messages]);
  const loanSummary=loans.map(l=>{
    const rem=parseInt(l.remainingMonths)||calcRemainingMonths(parseFloat(l.currentBalance)||0,parseFloat(l.interestRate)||0,parseFloat(l.monthlyPayment)||0);
    return `${getLoanType(l.type).icon} ${l.name}: ${fmt$(parseFloat(l.currentBalance)||0)} @ ${l.interestRate}% APR, ${fmt$(parseFloat(l.monthlyPayment)||0)}/mo, ~${rem} months left`;
  }).join("\n");
  async function send(){
    if(!input.trim()||loading) return;
    const userMsg={role:"user",content:input.trim()};
    setMessages(m=>[...m,userMsg]);setInput("");setLoading(true);
    const sys=`Expert loan advisor. User's loans:\n${loanSummary}\nAvalanche: ${avalanche.totalMonths}mo, ${fmt$(avalanche.totalInterest)} interest. Snowball: ${snowball.totalMonths}mo, ${fmt$(snowball.totalInterest)} interest. Be concise, specific with numbers, actionable. Under 200 words.`;
    try{
      const history=messages.filter((_,i)=>i>0).map(m=>({role:m.role,content:m.content}));
      const res=await callClaude(apiKey,{model:MODEL,max_tokens:600,system:sys,messages:[...history,{role:"user",content:input.trim()}]});
      const data=await res.json();
      setMessages(m=>[...m,{role:"assistant",content:data.content?.[0]?.text||"Sorry, couldn't generate a response."}]);
    }catch(e){setMessages(m=>[...m,{role:"assistant",content:`Sorry, couldn't connect. ${!apiKey?"(No API key — tap 🔑 in the top bar.)":""}`}]);}
    finally{setLoading(false);}
  }
  return(
    <div style={{display:"flex",flexDirection:"column",height:500}}>
      {!apiKey&&<div style={{background:"#f59e0b18",border:"1px solid #f59e0b33",borderRadius:10,padding:"8px 14px",marginBottom:10,fontSize:12,color:"#f59e0b"}}>⚠ No API key — tap 🔑 in the top bar to enable AI.</div>}
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:12,padding:"4px 0 12px"}}>
        {messages.map((msg,i)=>(
          <div key={i} style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"82%",padding:"10px 14px",borderRadius:msg.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",background:msg.role==="user"?"#6366f1":t.surf,color:msg.role==="user"?"#fff":t.tx1,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{msg.content}</div>
          </div>
        ))}
        {loading&&<div style={{display:"flex",justifyContent:"flex-start"}}><div style={{padding:"10px 14px",borderRadius:"14px 14px 14px 4px",background:t.surf,display:"flex",alignItems:"center",gap:8}}><div style={{width:14,height:14,border:"2px solid #6366f1",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite"}}/><span style={{fontSize:12,color:t.tx2}}>Thinking…</span></div></div>}
      </div>
      <div style={{display:"flex",gap:8,paddingTop:12,borderTop:`1px solid ${t.border}`}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),send())} placeholder='e.g. "What if I paid $300 extra on my auto loan?"' style={{flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 14px",color:t.tx1,fontSize:13}}/>
        <button onClick={send} disabled={loading||!input.trim()} style={{background:loading?"#475569":"#6366f1",border:"none",borderRadius:10,padding:"9px 18px",color:"#fff",cursor:loading?"default":"pointer",fontWeight:700,fontSize:13}}>{loading?"…":"Send"}</button>
      </div>
    </div>
  );
}

// ─── Refinance Tab ─────────────────────────────────────────────────────────────
function RefinanceTab({loans,darkMode,apiKey}){
  const t=useTheme(darkMode);
  const [selectedId,setSelectedId]=useState(loans[0]?.id||"");
  const [newRate,setNewRate]=useState("");
  const [newTerm,setNewTerm]=useState("");
  const [closingCosts,setClosingCosts]=useState("");
  const [analysis,setAnalysis]=useState("");
  const [loading,setLoading]=useState(false);
  const [done,setDone]=useState(false);
  const [copied,setCopied]=useState(false);
  const loan=loans.find(l=>l.id===selectedId)||loans[0];
  const iS={background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 12px",color:t.tx1,fontSize:13,width:"100%",boxSizing:"border-box"};

  async function analyze(){
    if(!loan||!newRate) return;
    setLoading(true);setAnalysis("");setDone(false);
    const bal=parseFloat(loan.currentBalance)||0,oldRate=parseFloat(loan.interestRate)||0,oldPmt=parseFloat(loan.monthlyPayment)||0;
    const oldRem=parseInt(loan.remainingMonths)||calcRemainingMonths(bal,oldRate,oldPmt);
    const nr=parseFloat(newRate)||0,nt=parseInt(newTerm)||oldRem,cc=parseFloat(closingCosts)||0;
    const newPmt=calcMonthlyPayment(bal,nr,nt);
    const monthlySavings=oldPmt-newPmt;
    const breakEven=monthlySavings>0?Math.ceil(cc/monthlySavings):999;
    const oldTotalInt=oldPmt*oldRem-bal,newTotalInt=newPmt*nt-bal;
    const prompt=`Loan refinancing advisor. Scenario:\nCurrent: ${loan.name} (${getLoanType(loan.type).label}), ${fmt$(bal)} balance, ${oldRate}% APR, ${fmt$(oldPmt)}/mo, ${oldRem} months left, ~${fmt$(oldTotalInt)} remaining interest\nProposed: ${nr}% APR, ${nt} months, ${fmt$(newPmt)}/mo, ${fmt$(cc)} closing costs, ${fmt$(monthlySavings)}/mo savings, break-even: ${breakEven<900?breakEven+" months":"never"}, new total interest: ~${fmt$(newTotalInt)}\nProvide: 1) Clear recommendation, 2) Break-even analysis, 3) Total interest impact, 4) When NOT to refinance, 5) Action steps if yes. **Bold** key numbers. ~300 words.`;
    try{
      const res=await callClaude(apiKey,{model:MODEL,max_tokens:800,messages:[{role:"user",content:prompt}]});
      const data=await res.json();
      setAnalysis(data.content?.[0]?.text||"Could not generate analysis.");setDone(true);
    }catch(e){setAnalysis(`Could not connect. ${!apiKey?"(No API key — tap 🔑)":""}`);setDone(true);}
    finally{setLoading(false);}
  }

  const loan2=loan;
  const previewPmt=loan2&&newRate?calcMonthlyPayment(parseFloat(loan2.currentBalance)||0,parseFloat(newRate)||0,parseInt(newTerm)||(parseInt(loan2.remainingMonths)||60)):0;
  const previewSavings=loan2?((parseFloat(loan2.monthlyPayment)||0)-previewPmt):0;
  const previewBE=previewSavings>0&&closingCosts?Math.ceil(parseFloat(closingCosts)/previewSavings):0;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {!apiKey&&<div style={{background:"#f59e0b18",border:"1px solid #f59e0b33",borderRadius:10,padding:"8px 14px",fontSize:12,color:"#f59e0b"}}>⚠ No API key — tap 🔑 in the top bar.</div>}
      <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",borderRadius:14,padding:"14px 18px"}}>
        <div style={{fontWeight:800,fontSize:14,color:"#fff"}}>🔄 Refinance Analyzer</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:3}}>Get an AI-powered recommendation on whether to refinance</div>
      </div>
      <div>
        <label style={{fontSize:11,color:t.tx2,display:"block",marginBottom:5,fontWeight:600}}>Loan to Refinance</label>
        <select value={selectedId} onChange={e=>setSelectedId(e.target.value)} style={iS}>
          {loans.map(l=><option key={l.id} value={l.id}>{getLoanType(l.type).icon} {l.name} — {fmt$(parseFloat(l.currentBalance)||0)} @ {l.interestRate}%</option>)}
        </select>
      </div>
      {loan&&<div style={{background:t.surf,borderRadius:10,padding:"10px 14px",fontSize:12,color:t.tx2}}><strong style={{color:t.tx1}}>Current:</strong> {fmt$(parseFloat(loan.currentBalance)||0)} @ {loan.interestRate}% → {fmt$(parseFloat(loan.monthlyPayment)||0)}/mo for ~{parseInt(loan.remainingMonths)||"?"} months</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
        {[{l:"New Rate (%) *",k:"rate",v:newRate,s:setNewRate,p:"e.g. 4.5"},{l:"New Term (mo)",k:"term",v:newTerm,s:setNewTerm,p:"Same"},{l:"Closing Costs ($)",k:"cc",v:closingCosts,s:setClosingCosts,p:"0"}].map(f=>(
          <div key={f.k}>
            <label style={{fontSize:11,color:t.tx2,display:"block",marginBottom:5,fontWeight:600}}>{f.l}</label>
            <input type="number" value={f.v} onChange={e=>f.s(e.target.value)} placeholder={f.p} style={iS} min="0" step="0.01"/>
          </div>
        ))}
      </div>
      {newRate&&loan&&(
        <div style={{background:t.surf,borderRadius:12,padding:"12px 14px"}}>
          <div style={{fontSize:11,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.6,marginBottom:8}}>Quick Preview</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[
              {l:"New Payment",v:fmt$(previewPmt),c:"#6366f1"},
              {l:"Monthly Change",v:`${previewSavings>=0?"+":""}${fmt$(previewSavings)} ${previewSavings>=0?"saved":"more"}`,c:previewSavings>=0?"#10b981":"#ef4444"},
              {l:"Break-even",v:previewBE?`${previewBE} mo`:(closingCosts?"Never":"Immediate"),c:"#f59e0b"},
            ].map(s=>(
              <div key={s.l} style={{textAlign:"center"}}>
                <div style={{fontSize:9,color:t.tx3,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{s.l}</div>
                <div style={{fontSize:13,fontWeight:700,color:s.c,fontFamily:"monospace"}}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <button onClick={analyze} disabled={!newRate||loading||!loan} style={{background:newRate&&loan?"linear-gradient(135deg,#6366f1,#8b5cf6)":t.surf,border:"none",borderRadius:12,padding:"12px 0",color:newRate&&loan?"#fff":t.tx3,cursor:newRate&&loan?"pointer":"default",fontWeight:700,fontSize:14}}>
        {loading?"🔄 Analyzing…":"✨ Get AI Refinance Recommendation"}
      </button>
      {loading&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"12px",background:t.surf,borderRadius:10,color:t.tx2}}><div style={{width:14,height:14,border:"2px solid #6366f1",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite",flexShrink:0}}/><span style={{fontSize:12}}>Analyzing your refinancing scenario…</span></div>}
      {done&&analysis&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{background:t.surf,borderRadius:14,padding:"16px 18px",maxHeight:380,overflowY:"auto"}}><Markdown text={analysis} tx1={t.tx1} tx2={t.tx2}/></div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={async()=>{try{await navigator.clipboard.writeText(analysis);setCopied(true);setTimeout(()=>setCopied(false),2500);}catch(e){}}} style={{flex:1,background:copied?"#10b981":t.surf,border:`1px solid ${copied?"#10b981":t.border}`,borderRadius:10,padding:"9px 0",color:copied?"#fff":t.tx2,cursor:"pointer",fontWeight:600,fontSize:12}}>{copied?"✓ Copied":"📋 Copy"}</button>
            <button onClick={()=>{setDone(false);setAnalysis("");}} style={{flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx2,cursor:"pointer",fontWeight:600,fontSize:12}}>↺ Redo</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Progress Tab ──────────────────────────────────────────────────────────────
function ProgressTab({loans,logsKey,darkMode}){
  const t=useTheme(darkMode);
  const [logs,setLogs]=useState([]);
  const [logForm,setLogForm]=useState({loanId:"",amount:"",date:new Date().toISOString().slice(0,10)});
  useEffect(()=>{storeGet(logsKey,true).then(v=>{if(v) setLogs(v);});},[logsKey]);
  useEffect(()=>{storeSet(logsKey,logs,true);},[logs,logsKey]);
  const milestones=[];
  loans.forEach(l=>{
    const bal=parseFloat(l.currentBalance)||0,orig=parseFloat(l.originalBalance)||bal;
    const pct=orig>0?((orig-bal)/orig)*100:0;
    const lt=getLoanType(l.type);
    if(pct>=75&&pct<100) milestones.push({msg:`${lt.icon} ${l.name} is 75%+ paid off! 🎉`,color:"#10b981"});
    else if(pct>=50&&pct<75) milestones.push({msg:`${lt.icon} ${l.name} is over halfway! 💪`,color:"#6366f1"});
    else if(pct>=25&&pct<50) milestones.push({msg:`${lt.icon} ${l.name} is 25%+ paid off!`,color:"#f59e0b"});
  });
  function addLog(){
    if(!logForm.loanId||!logForm.amount) return;
    const loan=loans.find(l=>l.id===logForm.loanId);
    setLogs(ls=>[...ls,{id:generateId(),loanId:logForm.loanId,loanName:loan?.name||"",loanColor:loan?.color||"#6366f1",loanType:loan?.type||"other",amount:parseFloat(logForm.amount)||0,planned:parseFloat(loan?.monthlyPayment)||0,date:logForm.date}]);
    setLogForm(f=>({...f,amount:""}));
  }
  const grouped={};
  logs.forEach(l=>{if(!grouped[l.loanId]) grouped[l.loanId]=[];grouped[l.loanId].push(l);});
  const iS={background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 10px",color:t.tx1,fontSize:12,boxSizing:"border-box"};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {milestones.length>0&&(
        <div>
          <div style={{fontSize:10,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>🏆 Milestones</div>
          {milestones.map((m,i)=><div key={i} style={{background:m.color+"18",border:`1px solid ${m.color}33`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,marginBottom:6}}><div style={{width:10,height:10,borderRadius:"50%",background:m.color,flexShrink:0}}/><span style={{fontSize:13,fontWeight:600,color:m.color}}>{m.msg}</span></div>)}
        </div>
      )}
      <div style={{background:t.surf,borderRadius:14,padding:"14px 16px"}}>
        <div style={{fontSize:11,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>📝 Log Actual Payment</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:8,alignItems:"end"}}>
          <div>
            <div style={{fontSize:10,color:t.tx2,marginBottom:3}}>Loan</div>
            <select value={logForm.loanId} onChange={e=>setLogForm(f=>({...f,loanId:e.target.value}))} style={{...iS,width:"100%"}}>
              <option value="">Select…</option>
              {loans.filter(l=>parseFloat(l.currentBalance)>0).map(l=><option key={l.id} value={l.id}>{getLoanType(l.type).icon} {l.name}</option>)}
            </select>
          </div>
          <div><div style={{fontSize:10,color:t.tx2,marginBottom:3}}>Amount Paid</div><input type="number" value={logForm.amount} onChange={e=>setLogForm(f=>({...f,amount:e.target.value}))} style={iS} placeholder="$0.00"/></div>
          <div><div style={{fontSize:10,color:t.tx2,marginBottom:3}}>Date</div><input type="date" value={logForm.date} onChange={e=>setLogForm(f=>({...f,date:e.target.value}))} style={iS}/></div>
          <button onClick={addLog} style={{background:"#10b981",border:"none",borderRadius:8,padding:"7px 14px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>+ Log</button>
        </div>
      </div>
      {Object.keys(grouped).length>0?Object.entries(grouped).map(([loanId,loanLogs])=>{
        const loan=loans.find(l=>l.id===loanId);
        const lt=getLoanType(loan?.type||"other");
        const totalA=loanLogs.reduce((s,l)=>s+l.amount,0),totalP=loanLogs.reduce((s,l)=>s+l.planned,0),diff=totalA-totalP;
        return(
          <div key={loanId} style={{border:`1px solid ${t.border}`,borderRadius:14,overflow:"hidden"}}>
            <div style={{background:loan?.color||"#6366f1",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
              <span style={{fontWeight:800,fontSize:13,color:"#fff"}}>{lt.icon} {loan?.name||"Unknown"}</span>
              <div style={{display:"flex",gap:14}}>
                {[{l:"ACTUAL",v:fmt$(totalA),c:"#fff"},{l:"PLANNED",v:fmt$(totalP),c:"rgba(255,255,255,.8)"},{l:"DIFF",v:(diff>=0?"+":"")+fmt$(diff),c:diff>=0?"#a7f3d0":"#fca5a5"}].map(x=>(
                  <div key={x.l} style={{textAlign:"right"}}><div style={{fontSize:9,color:"rgba(255,255,255,.6)"}}>{x.l}</div><div style={{fontSize:13,fontWeight:700,color:x.c}}>{x.v}</div></div>
                ))}
              </div>
            </div>
            <div style={{padding:"8px 14px"}}>
              {[...loanLogs].sort((a,b)=>new Date(a.date)-new Date(b.date)).map(log=>{
                const v=log.amount-log.planned;
                return(
                  <div key={log.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 8px",background:t.surf,borderRadius:8,marginBottom:4}}>
                    <div style={{fontSize:11,color:t.tx3,minWidth:80}}>{log.date}</div>
                    <div style={{fontSize:12,fontWeight:700,color:t.tx1,fontFamily:"monospace",flex:1}}>{fmt$(log.amount)}</div>
                    <div style={{fontSize:11,color:t.tx3}}>vs {fmt$(log.planned)}</div>
                    <div style={{fontSize:11,fontWeight:700,color:v>=0?"#10b981":"#ef4444",minWidth:60,textAlign:"right"}}>{v>=0?"+":""}{fmt$(v)}</div>
                    <button onClick={()=>setLogs(l=>l.filter(x=>x.id!==log.id))} style={{background:"none",border:"none",color:t.tx3,cursor:"pointer",fontSize:14,padding:"0 4px"}}>×</button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }):(
        <div style={{textAlign:"center",padding:"32px",color:t.tx3}}><div style={{fontSize:32,marginBottom:8}}>📋</div><div style={{fontSize:13}}>No payments logged yet.</div></div>
      )}
    </div>
  );
}

// ─── Payoff Planner Modal ──────────────────────────────────────────────────────
// ─── Info Modal ───────────────────────────────────────────────────────────────
function InfoModal({title,body,onClose,darkMode}){
  const t=useTheme(darkMode);
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:t.panelBg,border:"1px solid #6366f155",borderRadius:16,maxWidth:480,width:"100%",boxShadow:"0 16px 60px rgba(0,0,0,.5)",overflow:"hidden"}}>
        <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontWeight:800,fontSize:14,color:"#fff"}}>{title}</div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:8,padding:"5px 11px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>✕</button>
        </div>
        <div style={{padding:"18px 20px",fontSize:13,color:t.tx1,lineHeight:1.65,whiteSpace:"pre-wrap"}}>{body}</div>
      </div>
    </div>
  );
}

function PayoffPlannerModal({loans,logsKey,darkMode,apiKey,profileId,focusLoan,onClose}){
  const t=useTheme(darkMode);
  const {isMobile}=useBreakpoint();
  const [method,setMethod]=useState("avalanche");
  const [activeTab,setActiveTab]=useState("schedule");
  const [showFull,setShowFull]=useState(false);
  const [extraBudget,setExtraBudget]=useState(0);
  const [lumpSums,setLumpSums]=useState([]);
  const [lumpForm,setLumpForm]=useState({month:"",amount:""});
  const [aiText,setAiText]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [aiGenerated,setAiGenerated]=useState(false);
  const [aiSavedAt,setAiSavedAt]=useState(null);
  const [aiCopied,setAiCopied]=useState(false);
  const [singleLoan,setSingleLoan]=useState(focusLoan||null);
  const [singleExtra,setSingleExtra]=useState(0);
  const [singleLumps,setSingleLumps]=useState([]);
  const [singleLumpForm,setSingleLumpForm]=useState({month:"",amount:""});
  const [dynamicMins,setDynamicMins]=useState(false);
  const [lumpMode,setLumpMode]=useState("priority");
  const [extraSaved,setExtraSaved]=useState(false);
  const [singleLumpMode,setSingleLumpMode]=useState("priority");
  const [singleExtraSaved,setSingleExtraSaved]=useState(false);
  const [showRecalcInfo,setShowRecalcInfo]=useState(false);
  const aiRef=useRef(null);
  const resultKey=`lt_ai_results_${profileId}`;
  const plannerExtraKey=`lt_planner_extra_${profileId}`;
  const plannerLumpsKey=`lt_planner_lumps_${profileId}`;
  const plannerLumpModeKey=`lt_planner_lump_mode_${profileId}`;
  const plannerRecalcKey=`lt_planner_recalc_${profileId}`;
  const singleExtraKey=`lt_single_extra_${profileId}`;
  const singleLumpsKey=`lt_single_lumps_${profileId}`;
  const singleLumpModeKey=`lt_single_lump_mode_${profileId}`;

  useEffect(()=>{
    storeGet(resultKey,true).then(saved=>{
      if(saved?.analysis){setAiText(saved.analysis);setAiSavedAt(saved.savedAt);setAiGenerated(true);}
      if(focusLoan){setSingleLoan(focusLoan);setActiveTab("single");}
    });
    storeGet(plannerExtraKey,true).then(v=>{ if(v!=null) setExtraBudget(parseFloat(v)||0); });
    storeGet(plannerLumpsKey,true).then(v=>{ if(Array.isArray(v)) setLumpSums(v); });
    storeGet(plannerLumpModeKey,true).then(v=>{ if(v) setLumpMode(v); });
    storeGet(plannerRecalcKey,true).then(v=>{ if(v!=null) setDynamicMins(!!v); });
    storeGet(singleExtraKey,true).then(v=>{ if(v!=null) setSingleExtra(parseFloat(v)||0); });
    storeGet(singleLumpsKey,true).then(v=>{ if(Array.isArray(v)) setSingleLumps(v); });
    storeGet(singleLumpModeKey,true).then(v=>{ if(v) setSingleLumpMode(v); });
  },[profileId]);

  const validLoans=loans.filter(l=>(parseFloat(l.currentBalance)||0)>0&&(parseFloat(l.monthlyPayment)||0)>0);
  const opts={extraBudget,lumpSums,lumpMode,dynamicMins};
  const avalanche=computeMultiSchedule(validLoans,"avalanche",opts);
  const snowball=computeMultiSchedule(validLoans,"snowball",opts);
  const schedule=method==="avalanche"?avalanche:snowball;
  const orderedLoans=schedule.loanPayoffs.map(p=>schedule.loans?.find(l=>l.id===p.id)).filter(Boolean);
  const tableRows=showFull?schedule.months:schedule.months.slice(0,12);
  const liveSingleLoan=singleLoan?validLoans.find(l=>l.id===singleLoan.id)||null:null;
  const singleSchedule=liveSingleLoan?amortizeLoan(liveSingleLoan,singleExtra,singleLumps):null;
  const singleBaseSchedule=liveSingleLoan?amortizeLoan(liveSingleLoan,0,[]):null;
  const singleHasAccel=(singleExtra>0||singleLumps.length>0)&&singleSchedule&&singleBaseSchedule;
  function addLump(){if(!lumpForm.month||!lumpForm.amount) return;const updated=[...lumpSums,{id:generateId(),month:parseInt(lumpForm.month),amount:parseFloat(lumpForm.amount)}];setLumpSums(updated);storeSet(plannerLumpsKey,updated,true);setLumpForm({month:"",amount:""});}
  function removeLump(id){const updated=lumpSums.filter(x=>x.id!==id);setLumpSums(updated);storeSet(plannerLumpsKey,updated,true);}
  function saveExtra(){storeSet(plannerExtraKey,extraBudget,true);setExtraSaved(true);setTimeout(()=>setExtraSaved(false),2000);}
  function changeLumpMode(mode){setLumpMode(mode);storeSet(plannerLumpModeKey,mode,true);}

  function addSingleLump(){if(!singleLumpForm.month||!singleLumpForm.amount) return;const updated=[...singleLumps,{id:generateId(),month:parseInt(singleLumpForm.month),amount:parseFloat(singleLumpForm.amount)}];setSingleLumps(updated);storeSet(singleLumpsKey,updated,true);setSingleLumpForm({month:"",amount:""});}
  function removeSingleLump(id){const updated=singleLumps.filter(x=>x.id!==id);setSingleLumps(updated);storeSet(singleLumpsKey,updated,true);}
  function saveSingleExtra(){storeSet(singleExtraKey,singleExtra,true);setSingleExtraSaved(true);setTimeout(()=>setSingleExtraSaved(false),2000);}
  function changeSingleLumpMode(mode){setSingleLumpMode(mode);storeSet(singleLumpModeKey,mode,true);}

  async function generateAI(){
    setAiLoading(true);setAiText("");setAiGenerated(true);
    const ls=validLoans.map(l=>{
      const rem=parseInt(l.remainingMonths)||calcRemainingMonths(parseFloat(l.currentBalance)||0,parseFloat(l.interestRate)||0,parseFloat(l.monthlyPayment)||0);
      return `• ${getLoanType(l.type).icon} ${l.name}${l.lender?" ("+l.lender+")" :""}: ${fmt$(parseFloat(l.currentBalance)||0)} @ ${l.interestRate}% APR, ${fmt$(parseFloat(l.monthlyPayment)||0)}/mo, ~${rem} months left`;
    }).join("\n");
    const prompt=`Personal finance advisor. User's loans:\n${ls}${extraBudget>0?`\nExtra budget: ${fmt$(extraBudget)}/mo`:""}\nAvalanche: ${avalanche.totalMonths} months, ${fmt$(avalanche.totalInterest)} interest\nSnowball: ${snowball.totalMonths} months, ${fmt$(snowball.totalInterest)} interest\nProvide: 1) Method recommendation with reasoning, 2) Payoff order analysis, 3) Highest-cost loan insight, 4) How extra payments would help, 5) 3 action steps for this month, 6) Motivational close with debt-free date. **Bold** key numbers. ~400 words.`;
    try{
      const res=await callClaude(apiKey,{model:MODEL,max_tokens:1000,messages:[{role:"user",content:prompt}]});
      const data=await res.json();
      const text=data.content?.[0]?.text||"Could not generate a response.";
      setAiText(text);
      const now=new Date().toISOString();setAiSavedAt(now);
      await storeSet(resultKey,{analysis:text,savedAt:now},true);
    }catch(e){setAiText(`Could not connect. ${!apiKey?"(No API key — tap 🔑)":""}`);}
    finally{setAiLoading(false);}
  }

  async function copyAI(){try{await navigator.clipboard.writeText(aiText);setAiCopied(true);setTimeout(()=>setAiCopied(false),2500);}catch(e){}}
  function downloadAI(){
    if(!aiText) return;
    const text=`LoanTracker AI Analysis\nGenerated: ${aiSavedAt?new Date(aiSavedAt).toLocaleString():"Today"}\n\n${validLoans.map(l=>`• ${getLoanType(l.type).label} — ${l.name}: ${fmt$(parseFloat(l.currentBalance)||0)} @ ${l.interestRate}%`).join("\n")}\n\n${aiText}`;
    const blob=new Blob([text],{type:"text/plain"});const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`loantracker-analysis-${new Date().toISOString().slice(0,10)}.txt`;a.style.display="none";
    document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),100);
  }

  const iSm={background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.25)",borderRadius:7,padding:"6px 10px",color:"#fff",fontSize:12};
  const TABS=[{id:"schedule",icon:"📅",label:"Schedule"},{id:"single",icon:"🔍",label:"Single Loan"},{id:"charts",icon:"📈",label:"Charts"},{id:"refinance",icon:"🔄",label:"Refinance AI"},{id:"whatif",icon:"💬",label:"What-If AI"},{id:"progress",icon:"📊",label:"Progress"}];

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:isMobile?8:16,overflowY:"auto"}}>
      <div style={{background:t.panelBg,borderRadius:20,width:"100%",maxWidth:960,boxShadow:"0 24px 80px rgba(0,0,0,.6)",marginBottom:20}}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81,#4c1d95)",padding:isMobile?"14px 16px":"20px 24px",borderRadius:"20px 20px 0 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
            <div>
              <div style={{fontSize:isMobile?16:20,fontWeight:900,color:"#fff"}}>📊 Loan Payoff Planner</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:2}}>{validLoans.length} active loan{validLoans.length!==1?"s":""} · AI-powered</div>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:10,padding:"7px 14px",color:"#fff",cursor:"pointer",fontWeight:700}}>✕</button>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {[{id:"avalanche",icon:"🔥",label:"Avalanche",sub:"Highest Rate First"},{id:"snowball",icon:"❄️",label:"Snowball",sub:"Lowest Balance First"}].map(m=>(
              <button key={m.id} onClick={()=>setMethod(m.id)} style={{flex:1,background:method===m.id?"rgba(255,255,255,.2)":"rgba(255,255,255,.06)",border:`2px solid ${method===m.id?"rgba(255,255,255,.5)":"rgba(255,255,255,.12)"}`,borderRadius:12,padding:isMobile?"8px 10px":"10px 16px",color:"#fff",cursor:"pointer",textAlign:"left"}}>
                <div style={{fontWeight:800,fontSize:isMobile?12:13}}>{m.icon} {m.label}</div>
                {!isMobile&&<div style={{fontSize:10,color:"rgba(255,255,255,.6)",marginTop:2}}>{m.sub}</div>}
              </button>
            ))}
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>Extra/mo:</span>
              <input type="number" value={extraBudget||""} onChange={e=>setExtraBudget(parseFloat(e.target.value)||0)} placeholder="$0" style={{...iSm,width:80}}/>
              <button onClick={saveExtra} style={{background:extraSaved?"#10b981":"rgba(255,255,255,.2)",border:"none",borderRadius:6,padding:"5px 10px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700,transition:"background .2s"}}>{extraSaved?"Saved ✓":"Apply"}</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>Lump sum at month:</span>
              <input type="number" value={lumpForm.month} onChange={e=>setLumpForm(f=>({...f,month:e.target.value}))} placeholder="Mo" style={{...iSm,width:50}}/>
              <input type="number" value={lumpForm.amount} onChange={e=>setLumpForm(f=>({...f,amount:e.target.value}))} placeholder="$" style={{...iSm,width:70}}/>
              <button onClick={addLump} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:6,padding:"5px 10px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>+ Add</button>
              {lumpSums.length>0&&<div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                {lumpSums.map(ls=><span key={ls.id} style={{background:"rgba(255,255,255,.15)",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#fff",display:"flex",alignItems:"center",gap:4}}>Mo{ls.month}: {fmt$(ls.amount)}<button onClick={()=>removeLump(ls.id)} style={{background:"none",border:"none",color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:12,padding:0}}>×</button></span>)}
                <div style={{display:"flex",gap:3,alignItems:"center",marginLeft:4}}>
                  <span style={{fontSize:10,color:"rgba(255,255,255,.6)"}}>Apply:</span>
                  {[{id:"priority",label:"Priority"},{id:"split",label:"Split"}].map(m=>(
                    <button key={m.id} onClick={()=>changeLumpMode(m.id)} style={{background:lumpMode===m.id?"rgba(99,102,241,.5)":"rgba(255,255,255,.1)",border:`1px solid ${lumpMode===m.id?"#6366f1":"rgba(255,255,255,.2)"}`,borderRadius:5,padding:"2px 7px",color:"#fff",cursor:"pointer",fontSize:10,fontWeight:lumpMode===m.id?700:400}}>{m.label}</button>
                  ))}
                </div>
              </div>}
            </div>
            <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
              <input type="checkbox" checked={dynamicMins} onChange={e=>{ const v=e.target.checked; setDynamicMins(v); storeSet(plannerRecalcKey,v,true); }} style={{accentColor:"#6366f1"}}/>
              <span style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>Recalculate minimums monthly</span>
              <button onClick={e=>{ e.preventDefault(); setShowRecalcInfo(true); }} style={{background:"none",border:"none",color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:13,padding:0,lineHeight:1,display:"flex",alignItems:"center"}} title="Learn more">ℹ️</button>
            </label>
          </div>
        </div>
        {/* Tabs */}
        <div style={{borderBottom:`1px solid ${t.border}`,padding:"0 16px",display:"flex",gap:2,overflowX:"auto"}}>
          {TABS.map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{background:"none",border:"none",borderBottom:`2px solid ${activeTab===tab.id?"#6366f1":"transparent"}`,padding:isMobile?"8px 10px":"10px 14px",color:activeTab===tab.id?"#6366f1":t.tx2,cursor:"pointer",fontWeight:activeTab===tab.id?700:500,fontSize:isMobile?11:12,display:"flex",alignItems:"center",gap:4,transition:"all .15s",marginBottom:-1,whiteSpace:"nowrap"}}>
              {tab.icon}{!isMobile&&" "+tab.label}
            </button>
          ))}
        </div>

        <div style={{padding:isMobile?14:24,display:"flex",flexDirection:"column",gap:20}}>
          {!validLoans.length&&<div style={{textAlign:"center",padding:"40px 20px",color:t.tx2}}><div style={{fontSize:36,marginBottom:10}}>🏦</div><div style={{fontWeight:700,color:t.tx1}}>No active loans</div><div style={{fontSize:13,color:t.tx2,marginTop:6}}>Add loans with a balance and payment amount to use the planner.</div></div>}
          {validLoans.length>0&&validLoans.length<loans.length&&(
            <div style={{background:"#f59e0b18",border:"1px solid #f59e0b33",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:16}}>⚠️</span>
              <div style={{fontSize:12,color:"#f59e0b"}}>
                <strong>{loans.length-validLoans.length} loan{loans.length-validLoans.length!==1?"s are":" is"} excluded</strong> from the planner — missing balance or payment amount. Edit {loans.length-validLoans.length===1?"it":"them"} to include {loans.length-validLoans.length===1?"it":"them"}.
              </div>
            </div>
          )}

          {/* Schedule Tab */}
          {validLoans.length>0&&activeTab==="schedule"&&(<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[{id:"avalanche",icon:"🔥",s:avalanche,ac:"#f97316"},{id:"snowball",icon:"❄️",s:snowball,ac:"#3b82f6"}].map(m=>{
                const isA=method===m.id;
                return(<div key={m.id} style={{background:isA?m.ac+"18":t.surf,border:`2px solid ${isA?m.ac:t.border}`,borderRadius:14,padding:"14px 16px"}}>
                  <div style={{fontWeight:800,fontSize:14,color:isA?m.ac:t.tx2,marginBottom:10}}>{m.icon} {m.id.charAt(0).toUpperCase()+m.id.slice(1)}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[{l:"Payoff Time",v:`${m.s.totalMonths} mo`,fs:18},{l:"Total Interest",v:fmt$(m.s.totalInterest),c:"#f97316",fs:14},{l:"Total Paid",v:fmt$(m.s.totalPaid),fs:13},{l:"Debt Free",v:fmtMo(addMo(new Date(),m.s.totalMonths)),c:"#10b981",fs:12}].map(s=>(
                      <div key={s.l}><div style={{fontSize:9,color:t.tx3,textTransform:"uppercase"}}>{s.l}</div><div style={{fontSize:s.fs,fontWeight:800,color:s.c||t.tx1,fontFamily:"monospace"}}>{s.v}</div></div>
                    ))}
                  </div>
                </div>);
              })}
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:10}}>
              {[{l:avalanche.totalInterest<=snowball.totalInterest?"Interest Saved (Avalanche)":"Interest Saved (Snowball)",v:fmt$(Math.abs(avalanche.totalInterest-snowball.totalInterest)),c:"#10b981"},{l:`${avalanche.totalMonths<=snowball.totalMonths?"🔥 Avalanche":"❄️ Snowball"} faster by`,v:`${Math.abs(avalanche.totalMonths-snowball.totalMonths)} months`,c:"#6366f1"},{l:"Monthly Budget",v:fmt$(schedule.totalBudget),c:t.tx2}].map(s=>(
                <div key={s.l} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:s.c,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{s.l}</div>
                  <div style={{fontSize:16,fontWeight:800,color:t.tx1,fontFamily:"monospace"}}>{s.v}</div>
                </div>
              ))}
            </div>
            {/* Payoff order */}
            <div>
              <div style={{fontSize:11,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>{method==="avalanche"?"🔥":"❄️"} Payoff Order</div>
              {schedule.loanPayoffs.map((po,i)=>{
                const loan=validLoans.find(l=>l.id===po.id);
                const lt=getLoanType(po.type);
                return(
                  <div key={po.id} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:po.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",flexShrink:0}}>{i+1}</div>
                    <div style={{width:3,height:36,borderRadius:2,background:po.color,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:13,color:t.tx1}}>{lt.icon} {po.name}</div><div style={{fontSize:11,color:t.tx2}}>{fmt$(parseFloat(loan?.currentBalance)||0)} · {parseFloat(loan?.interestRate)||0}% APR</div></div>
                    <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:13,fontWeight:700,color:"#10b981"}}>Month {po.month}</div><div style={{fontSize:11,color:t.tx3}}>{fmtDate(po.date)}</div></div>
                    <div style={{fontSize:20}}>✓</div>
                  </div>
                );
              })}
            </div>
            {/* Table */}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8}}>Month-by-Month Schedule</div>
                <button onClick={()=>setShowFull(f=>!f)} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:7,padding:"4px 10px",fontSize:10,color:t.tx2,cursor:"pointer",fontWeight:600}}>{showFull?`▲ Less`:`▼ All ${schedule.months.length} Months`}</button>
              </div>
              <div style={{overflowX:"auto",borderRadius:12,border:`1px solid ${t.border}`}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{background:t.surf}}>
                    <th style={{padding:"9px 11px",textAlign:"left",color:t.tx2,fontWeight:600,fontSize:9,textTransform:"uppercase",whiteSpace:"nowrap"}}>Month</th>
                    <th style={{padding:"9px 11px",textAlign:"left",color:t.tx2,fontWeight:600,fontSize:9,textTransform:"uppercase",whiteSpace:"nowrap"}}>Date</th>
                    {orderedLoans.map((l,i)=><th key={l.id} style={{padding:"9px 11px",textAlign:"right",whiteSpace:"nowrap"}}><div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end"}}><div style={{width:16,height:16,borderRadius:"50%",background:l.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,color:"#fff",flexShrink:0}}>{i+1}</div><span style={{color:t.tx2,fontWeight:600,fontSize:9,textTransform:"uppercase"}}>{l.name.slice(0,10)}</span></div></th>)}
                    <th style={{padding:"9px 11px",textAlign:"right",color:t.tx2,fontWeight:600,fontSize:9,textTransform:"uppercase"}}>Paid</th>
                    <th style={{padding:"9px 11px",textAlign:"right",color:t.tx2,fontWeight:600,fontSize:9,textTransform:"uppercase"}}>Interest</th>
                  </tr></thead>
                  <tbody>
                    {tableRows.map((row,idx)=>{
                      const payHere=schedule.loanPayoffs.filter(p=>p.month===row.month);
                      const isPay=payHere.length>0,hasLump=lumpSums.some(ls=>ls.month===row.month);
                      const tP=Object.values(row.payments).reduce((s,v)=>s+v,0),tI=Object.values(row.interest).reduce((s,v)=>s+v,0);
                      return(<tr key={row.month} style={{background:isPay?"#10b98110":hasLump?"#6366f108":idx%2===0?"transparent":t.surf+"66",borderBottom:`1px solid ${t.border}`}}>
                        <td style={{padding:"7px 11px",color:t.tx1,fontFamily:"monospace",fontWeight:isPay?700:400}}>{row.month}{isPay&&<span style={{marginLeft:5,fontSize:9,background:"#10b981",color:"#fff",borderRadius:4,padding:"1px 4px"}}>PAYOFF</span>}{hasLump&&<span style={{marginLeft:3,fontSize:9,background:"#6366f1",color:"#fff",borderRadius:4,padding:"1px 4px"}}>LUMP</span>}</td>
                        <td style={{padding:"7px 11px",color:t.tx3,whiteSpace:"nowrap"}}>{fmtMo(addMo(new Date(),row.month))}</td>
                        {orderedLoans.map(l=>{const pHere=payHere.find(p=>p.id===l.id);return(<td key={l.id} style={{padding:"7px 11px",textAlign:"right",fontFamily:"monospace",background:pHere?l.color+"22":"transparent"}}>{row.balances[l.id]!==undefined?<div><div style={{color:pHere?"#10b981":t.tx1,fontSize:10,fontWeight:pHere?700:400}}>{pHere?"✓ PAID":fmt$(row.balances[l.id])}</div><div style={{color:t.tx3,fontSize:9}}>pmt {fmt$((row.payments[l.id]||0)+(row.lumpPayments?.[l.id]||0))}</div></div>:<span style={{color:t.tx3}}>—</span>}</td>);})}
                        <td style={{padding:"7px 11px",textAlign:"right",fontFamily:"monospace",color:t.tx1,fontWeight:600}}>{fmt$(tP+(row.lumpAmount||0))}</td>
                        <td style={{padding:"7px 11px",textAlign:"right",fontFamily:"monospace",color:"#f97316"}}>{fmt$(tI)}</td>
                      </tr>);
                    })}
                    {!showFull&&schedule.months.length>12&&<tr style={{background:t.surf}}><td colSpan={99} style={{padding:"9px 11px",textAlign:"center",color:t.tx2,fontSize:11}}>+{schedule.months.length-12} more — <button onClick={()=>setShowFull(true)} style={{background:"none",border:"none",color:"#6366f1",cursor:"pointer",fontWeight:700,fontSize:11}}>Show all</button></td></tr>}
                  </tbody>
                  <tfoot><tr style={{background:t.surf,borderTop:`2px solid ${t.border}`}}>
                    <td colSpan={2} style={{padding:"9px 11px",fontWeight:800,color:t.tx1,fontSize:11}}>TOTALS</td>
                    {orderedLoans.map(l=><td key={l.id} style={{padding:"9px 11px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:t.tx1,fontSize:10}}>{fmt$(schedule.months.reduce((s,r)=>s+(r.payments[l.id]||0),0))}</td>)}
                    <td style={{padding:"9px 11px",textAlign:"right",fontFamily:"monospace",fontWeight:800,color:t.tx1}}>{fmt$(schedule.totalPaid)}</td>
                    <td style={{padding:"9px 11px",textAlign:"right",fontFamily:"monospace",fontWeight:800,color:"#f97316"}}>{fmt$(schedule.totalInterest)}</td>
                  </tr></tfoot>
                </table>
              </div>
            </div>
            {/* AI Panel */}
            <div style={{border:"1px solid #6366f133",borderRadius:16,overflow:"hidden"}}>
              <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",padding:"12px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div><div style={{fontWeight:800,fontSize:13,color:"#fff"}}>✨ AI Analysis</div><div style={{fontSize:10,color:"rgba(255,255,255,.55)",marginTop:1}}>{aiSavedAt?`Saved ${new Date(aiSavedAt).toLocaleDateString()}`:apiKey?"Powered by your API key":"Powered by Claude"}</div></div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {aiGenerated&&aiText&&(<><button onClick={copyAI} style={{background:aiCopied?"#10b981":"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",borderRadius:7,padding:"5px 10px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600}}>{aiCopied?"✓ Copied":"📋 Copy"}</button><button onClick={downloadAI} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",borderRadius:7,padding:"5px 10px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600}}>⬇ .txt</button></>)}
                  <button onClick={generateAI} disabled={aiLoading} style={{background:aiLoading?"rgba(255,255,255,.1)":"#6366f1",border:"none",borderRadius:8,padding:"7px 16px",color:"#fff",cursor:aiLoading?"default":"pointer",fontWeight:700,fontSize:12,opacity:aiLoading?.7:1}}>{aiLoading?"Analyzing…":aiGenerated?"↺ Regenerate":"Generate Analysis"}</button>
                </div>
              </div>
              <div ref={aiRef} style={{padding:"16px 20px",minHeight:aiGenerated?100:70,maxHeight:400,overflowY:"auto"}}>
                {!apiKey&&!aiGenerated&&<div style={{background:"#f59e0b18",border:"1px solid #f59e0b33",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#f59e0b"}}>⚠ No API key — tap 🔑 to enable AI.</div>}
                {!aiGenerated&&<div style={{textAlign:"center",padding:"16px 0",color:t.tx3}}><div style={{fontSize:24,marginBottom:6}}>🤖</div><div style={{fontSize:12}}>Click "Generate Analysis" for personalized AI recommendations</div></div>}
                {aiLoading&&!aiText&&<div style={{display:"flex",alignItems:"center",gap:8,color:t.tx2,padding:"12px 0"}}><div style={{width:14,height:14,border:"2px solid #6366f1",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite"}}/><span style={{fontSize:12}}>Analyzing your loans…</span></div>}
                {aiText&&<Markdown text={aiText} tx1={t.tx1} tx2={t.tx2}/>}
              </div>
            </div>
          </>)}

          {/* Single Loan Tab */}
          {validLoans.length>0&&activeTab==="single"&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* Loan selector */}
              <div>
                <label style={{fontSize:11,color:t.tx2,display:"block",marginBottom:6,fontWeight:600}}>Select Loan</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {validLoans.map(l=>(
                    <button key={l.id} onClick={()=>{setSingleLoan(l);setSingleExtra(0);setSingleLumps([]);setSingleLumpForm({month:"",amount:""});}} style={{display:"flex",alignItems:"center",gap:6,background:liveSingleLoan?.id===l.id?l.color+"22":t.surf,border:`2px solid ${liveSingleLoan?.id===l.id?l.color:t.border}`,borderRadius:10,padding:"8px 14px",color:liveSingleLoan?.id===l.id?l.color:t.tx1,cursor:"pointer",fontSize:12,fontWeight:liveSingleLoan?.id===l.id?700:500}}>
                      {getLoanType(l.type).icon} {l.name}
                    </button>
                  ))}
                </div>
              </div>

              {liveSingleLoan&&singleSchedule&&(
                <>
                  {/* Accelerator controls */}
                  <div style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:14,padding:"14px 16px"}}>
                    <div style={{fontSize:11,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>⚡ Payoff Accelerator</div>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end",marginBottom:singleLumps.length>0?12:0}}>
                      <div style={{flex:"1 1 140px",minWidth:120}}>
                        <div style={{fontSize:11,color:t.tx2,marginBottom:4,fontWeight:600}}>Extra / Month ($)</div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <input type="number" value={singleExtra||""} onChange={e=>setSingleExtra(parseFloat(e.target.value)||0)} placeholder="e.g. 200" min="0" style={{flex:1,background:t.panelBg,border:`1px solid ${singleExtra>0?"#6366f1":t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx1,fontSize:13,boxSizing:"border-box",fontFamily:"monospace"}}/>
                          <button onClick={saveSingleExtra} style={{background:singleExtraSaved?"#10b981":"#6366f1",border:"none",borderRadius:8,padding:"8px 12px",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,flexShrink:0,transition:"background .2s",whiteSpace:"nowrap"}}>{singleExtraSaved?"Saved ✓":"Apply"}</button>
                        </div>
                      </div>
                      <div style={{flex:"1 1 80px",minWidth:70}}>
                        <div style={{fontSize:11,color:t.tx2,marginBottom:4,fontWeight:600}}>Lump Sum Month</div>
                        <input type="number" value={singleLumpForm.month} onChange={e=>setSingleLumpForm(f=>({...f,month:e.target.value}))} placeholder="Mo #" min="1" style={{width:"100%",background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx1,fontSize:13,boxSizing:"border-box",fontFamily:"monospace"}}/>
                      </div>
                      <div style={{flex:"1 1 100px",minWidth:90}}>
                        <div style={{fontSize:11,color:t.tx2,marginBottom:4,fontWeight:600}}>Lump Sum Amount ($)</div>
                        <input type="number" value={singleLumpForm.amount} onChange={e=>setSingleLumpForm(f=>({...f,amount:e.target.value}))} placeholder="e.g. 5000" min="0" style={{width:"100%",background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx1,fontSize:13,boxSizing:"border-box",fontFamily:"monospace"}}/>
                      </div>
                      <button onClick={addSingleLump} disabled={!singleLumpForm.month||!singleLumpForm.amount} style={{background:singleLumpForm.month&&singleLumpForm.amount?"#6366f1":t.border,border:"none",borderRadius:8,padding:"8px 14px",color:"#fff",cursor:singleLumpForm.month&&singleLumpForm.amount?"pointer":"default",fontWeight:700,fontSize:12,flexShrink:0,whiteSpace:"nowrap"}}>+ Add</button>
                      {(singleExtra>0||singleLumps.length>0)&&<button onClick={()=>{setSingleExtra(0);setSingleLumps([]);}} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx3,cursor:"pointer",fontSize:12,flexShrink:0}}>✕ Clear</button>}
                    </div>
                    {singleLumps.length>0&&(
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",paddingTop:8,borderTop:`1px solid ${t.border}`,alignItems:"center"}}>
                        {singleLumps.map(ls=>(
                          <span key={ls.id} style={{background:"#6366f118",border:"1px solid #6366f133",borderRadius:6,padding:"3px 10px",fontSize:11,color:"#6366f1",display:"flex",alignItems:"center",gap:6,fontWeight:600}}>
                            Mo {ls.month}: {fmt$(ls.amount)}
                            <button onClick={()=>removeSingleLump(ls.id)} style={{background:"none",border:"none",color:"#6366f1",cursor:"pointer",fontSize:13,padding:0,lineHeight:1}}>×</button>
                          </span>
                        ))}
                        <div style={{display:"flex",gap:4,alignItems:"center",marginLeft:4}}>
                          <span style={{fontSize:11,color:t.tx3}}>Apply:</span>
                          {[{id:"priority",label:"Priority"},{id:"split",label:"Split"}].map(m=>(
                            <button key={m.id} onClick={()=>changeSingleLumpMode(m.id)} style={{background:singleLumpMode===m.id?"#6366f1":"transparent",border:`1px solid ${singleLumpMode===m.id?"#6366f1":t.border}`,borderRadius:6,padding:"3px 9px",color:singleLumpMode===m.id?"#fff":t.tx2,cursor:"pointer",fontSize:11,fontWeight:singleLumpMode===m.id?700:400}}>{m.label}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Comparison: base vs accelerated */}
                  {singleHasAccel?(
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      {[{label:"Standard",sch:singleBaseSchedule,ac:t.tx2,border:t.border},{label:"Accelerated",sch:singleSchedule,ac:"#10b981",border:"#10b98133"}].map(({label,sch,ac,border})=>(
                        <div key={label} style={{background:t.panelBg,border:`2px solid ${border}`,borderRadius:14,padding:"14px 16px"}}>
                          <div style={{fontSize:11,fontWeight:700,color:ac,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>{label}</div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                            {[{l:"Months",v:`${sch.totalMonths} mo`},{l:"Total Interest",v:fmt$(sch.totalInterest)},{l:"Total Paid",v:fmt$(sch.totalPaid)},{l:"Debt Free",v:fmtMo(addMo(new Date(),sch.totalMonths))}].map(s=>(
                              <div key={s.l}><div style={{fontSize:9,color:t.tx3,textTransform:"uppercase",marginBottom:2}}>{s.l}</div><div style={{fontSize:12,fontWeight:700,color:t.tx1,fontFamily:"monospace"}}>{s.v}</div></div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div style={{gridColumn:"1/-1",background:"#10b98110",border:"1px solid #10b98133",borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"space-around",flexWrap:"wrap",gap:8}}>
                        {[{l:"Months Saved",v:`${singleBaseSchedule.totalMonths-singleSchedule.totalMonths} mo`},{l:"Interest Saved",v:fmt$(singleBaseSchedule.totalInterest-singleSchedule.totalInterest)},{l:"Paid Off",v:fmtMo(addMo(new Date(),singleSchedule.totalMonths))}].map(s=>(
                          <div key={s.l} style={{textAlign:"center"}}><div style={{fontSize:9,color:"#10b981",textTransform:"uppercase",fontWeight:700,marginBottom:2}}>{s.l}</div><div style={{fontSize:16,fontWeight:800,color:"#10b981",fontFamily:"monospace"}}>{s.v}</div></div>
                        ))}
                      </div>
                    </div>
                  ):(
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                      {[{l:"Total Months",v:`${singleSchedule.totalMonths} mo`,c:"#6366f1"},{l:"Total Interest",v:fmt$(singleSchedule.totalInterest),c:"#f97316"},{l:"Debt Free",v:fmtMo(addMo(new Date(),singleSchedule.totalMonths)),c:"#10b981"}].map(s=>(
                        <div key={s.l} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
                          <div style={{fontSize:9,color:s.c,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{s.l}</div>
                          <div style={{fontSize:16,fontWeight:800,color:t.tx1,fontFamily:"monospace"}}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <SingleLoanDualChart baseSchedule={singleBaseSchedule} accelSchedule={singleHasAccel?singleSchedule:null} loan={liveSingleLoan} darkMode={darkMode}/>
                  <InterestBarChart baseSchedule={singleBaseSchedule} accelSchedule={singleHasAccel?singleSchedule:null} loan={liveSingleLoan} darkMode={darkMode}/>

                  {/* Amortization table */}
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{fontSize:11,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8}}>Amortization Schedule{singleHasAccel&&<span style={{marginLeft:6,fontSize:9,background:"#10b981",color:"#fff",borderRadius:4,padding:"2px 6px",fontWeight:700}}>ACCELERATED</span>}</div>
                      <button onClick={()=>{const blob=new Blob([["Month,Date,Payment,Principal,Interest,Balance,LumpSum",...singleSchedule.months.map(r=>`${r.month},${fmtDate(addMo(new Date(),r.month))},${r.payment.toFixed(2)},${r.principal.toFixed(2)},${r.interest.toFixed(2)},${r.balance.toFixed(2)},${(r.lump||0).toFixed(2)}`)].join("\n")],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`${liveSingleLoan.name}-amortization.csv`;a.style.display="none";document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),100);}} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:7,padding:"4px 10px",fontSize:10,color:t.tx2,cursor:"pointer",fontWeight:600}}>⬇ CSV</button>
                    </div>
                    <div style={{overflowX:"auto",borderRadius:12,border:`1px solid ${t.border}`,maxHeight:400,overflowY:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                        <thead style={{position:"sticky",top:0}}><tr style={{background:t.surf}}>
                          {["Mo","Date","Payment","Principal","Interest","Balance"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"right",color:t.tx2,fontWeight:600,fontSize:9,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {singleSchedule.months.map((row,idx)=>{
                            const hasLump=row.lump>0;
                            return(
                              <tr key={row.month} style={{background:hasLump?"#6366f108":idx%2===0?"transparent":t.surf+"66",borderBottom:`1px solid ${t.border}`}}>
                                <td style={{padding:"6px 10px",fontFamily:"monospace",color:t.tx1,textAlign:"right"}}>
                                  {row.month}
                                  {hasLump&&<span style={{marginLeft:4,fontSize:9,background:"#6366f1",color:"#fff",borderRadius:4,padding:"1px 4px",fontWeight:700}}>LUMP</span>}
                                </td>
                                <td style={{padding:"6px 10px",color:t.tx3,whiteSpace:"nowrap",textAlign:"right"}}>{fmtMo(addMo(new Date(),row.month))}</td>
                                <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",color:t.tx1,fontWeight:600}}>{fmt$(row.payment+(row.lump||0))}{hasLump&&<div style={{fontSize:9,color:"#6366f1",fontWeight:700}}>incl. {fmt$(row.lump)} lump</div>}</td>
                                <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",color:"#10b981"}}>{fmt$(row.principal)}</td>
                                <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",color:"#f97316"}}>{fmt$(row.interest)}</td>
                                <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",color:row.balance<1?"#10b981":t.tx1,fontWeight:row.balance<1?700:400}}>{row.balance<0.01?"✓ PAID":fmt$(row.balance)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot><tr style={{background:t.surf,borderTop:`2px solid ${t.border}`}}>
                          <td colSpan={2} style={{padding:"8px 10px",fontWeight:800,color:t.tx1,fontSize:11,textAlign:"right"}}>TOTALS</td>
                          <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontWeight:800,color:t.tx1}}>{fmt$(singleSchedule.totalPaid)}</td>
                          <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#10b981"}}>{fmt$(singleSchedule.totalPaid-singleSchedule.totalInterest)}</td>
                          <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#f97316"}}>{fmt$(singleSchedule.totalInterest)}</td>
                          <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",color:"#10b981",fontWeight:800}}>✓ PAID</td>
                        </tr></tfoot>
                      </table>
                    </div>
                  </div>
                </>
              )}
              {!liveSingleLoan&&<div style={{textAlign:"center",padding:"32px",color:t.tx3,fontSize:13}}>Select a loan above to see its amortization schedule</div>}
            </div>
          )}

          {validLoans.length>0&&activeTab==="charts"&&(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <ComparisonChart avalanche={avalanche} snowball={snowball} darkMode={darkMode}/>
              {validLoans.map(l=><BalanceChart key={l.id} schedule={amortizeLoan(l,extraBudget,[])} loan={l} darkMode={darkMode} title={`${getLoanType(l.type).icon} ${l.name} — Balance Over Time`}/>)}
            </div>
          )}
          {validLoans.length>0&&activeTab==="refinance"&&<RefinanceTab loans={validLoans} darkMode={darkMode} apiKey={apiKey}/>}
          {validLoans.length>0&&activeTab==="whatif"&&<WhatIfTab loans={validLoans} avalanche={avalanche} snowball={snowball} darkMode={darkMode} apiKey={apiKey}/>}
          {activeTab==="progress"&&<ProgressTab loans={loans} logsKey={logsKey} darkMode={darkMode}/>}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {showRecalcInfo&&<InfoModal darkMode={darkMode} onClose={()=>setShowRecalcInfo(false)} title="Recalculate Minimums Monthly" body={`As you pay down balances each month, your minimum payment technically gets smaller (minimum = interest + 1% of remaining balance).\n\n✅ Checked: The schedule recalculates a new, lower minimum each month as balances drop. More realistic, but your payoff takes longer because you're paying less over time.\n\n☐ Unchecked: Keeps your minimum payment fixed at the month 1 amount. You effectively pay a little extra each month as balances drop, paying off debt faster.\n\n💡 Most financial advisors recommend leaving this unchecked — keep paying the original amount even as minimums drop.`}/>}
    </div>
  );
}

// ─── Import/Export Modal ───────────────────────────────────────────────────────
function ImportExportModal({loans,profile,onImport,onClose,darkMode}){
  const t=useTheme(darkMode);
  const [tab,setTab]=useState("export");
  const [importText,setImportText]=useState("");
  const [importError,setImportError]=useState("");
  const [importPreview,setImportPreview]=useState(null);
  const [importSuccess,setImportSuccess]=useState(false);
  const fileRef=useRef(null);
  function exportJSON(){
    const data=JSON.stringify({version:"1.0",module:"loan-tracker",exportedAt:new Date().toISOString(),profile,loans},null,2);
    const blob=new Blob([data],{type:"application/json"});const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`loantracker-backup-${new Date().toISOString().slice(0,10)}.json`;a.style.display="none";
    document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),100);
  }
  function exportCSV(){
    const headers=["Name","Lender","Type","Current Balance","Original Balance","Interest Rate (%)","Monthly Payment","Term (months)","Remaining Months","Due Day","Notes","Color"];
    const rows=loans.map(l=>[
      l.name,l.lender||"",getLoanType(l.type).label,
      parseFloat(l.currentBalance)||0,parseFloat(l.originalBalance)||0,
      parseFloat(l.interestRate)||0,parseFloat(l.monthlyPayment)||0,
      parseInt(l.termMonths)||"",l.remainingMonths||"",
      l.nextPaymentDay||"",`"${(l.notes||"").replace(/"/g,'""')}"`,l.color
    ]);
    const csv=[headers.join(","),...rows.map(r=>r.join(","))].join("\n");
    const blob=new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`loantracker-export-${new Date().toISOString().slice(0,10)}.csv`;a.style.display="none";
    document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),100);
  }
  function parseCSV(text){
    const lines=text.trim().split("\n").filter(l=>l.trim());
    if(lines.length<2) throw new Error("File appears empty");
    // Parse a single CSV row respecting quoted fields
    function parseRow(line){
      const cols=[];let cur="",inQ=false;
      for(let i=0;i<line.length;i++){
        const ch=line[i];
        if(ch==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}
        else if(ch===","&&!inQ){cols.push(cur.trim());cur="";}
        else cur+=ch;
      }
      cols.push(cur.trim());
      return cols;
    }
    const headers=parseRow(lines[0]).map(h=>h.toLowerCase().replace(/[^a-z0-9]/g,""));
    // Map header names to loan schema fields
    const col=(names)=>{for(const n of names){const i=headers.findIndex(h=>h.includes(n));if(i>=0) return i;}return -1;};
    const iName=col(["name"]),iLender=col(["lender"]),iType=col(["type"]),
          iCurBal=col(["currentbalance","currbal","balance"]),iOrigBal=col(["originalbalance","origbal"]),
          iRate=col(["interestrate","rate","apr"]),iPmt=col(["monthlypayment","payment","monthly"]),
          iTerm=col(["termmonths","term"]),iRem=col(["remainingmonths","remaining"]),
          iDue=col(["dueday","due"]),iNotes=col(["notes"]),iColor=col(["color"]);
    if(iName<0||iCurBal<0) throw new Error("Missing required columns: Name, Current Balance");
    const typeMap={"auto loan":"auto","mortgage":"mortgage","student loan":"student","personal loan":"personal","other":"other"};
    const parsed=lines.slice(1).map(line=>{
      const c=parseRow(line);
      const rawType=(iType>=0?c[iType]:"").toLowerCase().trim();
      const loanType=typeMap[rawType]||LOAN_TYPES.find(lt=>lt.id===rawType)?.id||"other";
      const lt=LOAN_TYPES.find(t=>t.id===loanType)||LOAN_TYPES[4];
      const curBal=parseFloat(iCurBal>=0?c[iCurBal]:0)||0;
      const rate=parseFloat(iRate>=0?c[iRate]:0)||0;
      const pmt=parseFloat(iPmt>=0?c[iPmt]:0)||0;
      return{
        name:(iName>=0?c[iName]:"")||"Unnamed Loan",
        lender:iLender>=0?c[iLender]:"",
        type:loanType,
        color:iColor>=0&&c[iColor]?.startsWith("#")?c[iColor]:lt.defaultColor,
        currentBalance:curBal.toString(),
        originalBalance:(parseFloat(iOrigBal>=0?c[iOrigBal]:0)||curBal).toString(),
        interestRate:rate.toString(),
        monthlyPayment:pmt.toString(),
        termMonths:iTerm>=0?c[iTerm]:"",
        remainingMonths:iRem>=0?c[iRem]:"",
        nextPaymentDay:iDue>=0?c[iDue]:"",
        notes:iNotes>=0?c[iNotes]:"",
      };
    }).filter(l=>l.name&&(parseFloat(l.currentBalance)||0)>0);
    if(!parsed.length) throw new Error("No valid loans found in file");
    return parsed;
  }
  function parseImport(text,isCSV=false){
    setImportError("");setImportPreview(null);
    try{
      if(isCSV){
        const loans=parseCSV(text);
        setImportPreview({loans,exportedAt:null,fromCSV:true});
      }else{
        const data=JSON.parse(text);
        if(Array.isArray(data.loans)&&data.loans.length>0) setImportPreview({loans:data.loans,exportedAt:data.exportedAt});
        else throw new Error("No loans array found");
      }
    }catch(e){setImportError(`Could not parse: ${e.message}`);}
  }
  function handleFile(e){
    const file=e.target.files?.[0];if(!file) return;
    const isCSV=file.name.toLowerCase().endsWith(".csv");
    const r=new FileReader();
    r.onload=ev=>{setImportText(ev.target.result);parseImport(ev.target.result,isCSV);};
    r.readAsText(file);
    e.target.value="";
  }
  function confirmImport(mode){if(!importPreview) return;onImport(importPreview.loans,mode);setImportSuccess(true);setImportPreview(null);setImportText("");}
  const tS=(active)=>({background:active?"#6366f1":t.surf,color:active?"#fff":t.tx2,border:`1px solid ${active?"#6366f1":t.border}`,borderRadius:8,padding:"7px 20px",cursor:"pointer",fontWeight:600,fontSize:13});
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      <div style={{background:t.panelBg,borderRadius:20,width:"100%",maxWidth:520,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{margin:0,color:t.tx1,fontSize:17,fontWeight:800}}>📦 Backup & Restore</h2>
          <button onClick={onClose} style={{background:t.surf,border:"none",borderRadius:8,padding:"5px 11px",color:t.tx1,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          <button onClick={()=>setTab("export")} style={tS(tab==="export")}>⬇ Export</button>
          <button onClick={()=>{setTab("import");setImportSuccess(false);}} style={tS(tab==="import")}>⬆ Import</button>
        </div>
        {tab==="export"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 14px",fontSize:12,color:t.tx2}}>Exporting <strong style={{color:t.tx1}}>{loans.length} loan{loans.length!==1?"s":""}</strong> for <strong style={{color:t.tx1}}>{profile?.name||"your profile"}</strong>.</div>
            <div style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:12,padding:"16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontWeight:700,fontSize:14,color:t.tx1}}>📄 Full Backup (JSON)</div><div style={{fontSize:11,color:t.tx2,marginTop:3}}>Restores all loan details, settings, and colors.</div></div>
              <button onClick={exportJSON} disabled={!loans.length} style={{background:"#6366f1",border:"none",borderRadius:9,padding:"8px 16px",color:"#fff",cursor:loans.length?"pointer":"default",fontWeight:700,fontSize:12,opacity:loans.length?1:.4,marginLeft:12}}>Download</button>
            </div>
            <div style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:12,padding:"16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontWeight:700,fontSize:14,color:t.tx1}}>📊 Spreadsheet (CSV)</div><div style={{fontSize:11,color:t.tx2,marginTop:3}}>Opens in Excel or Google Sheets. Balance, rate, payment, and all fields.</div></div>
              <button onClick={exportCSV} disabled={!loans.length} style={{background:"#10b981",border:"none",borderRadius:9,padding:"8px 16px",color:"#fff",cursor:loans.length?"pointer":"default",fontWeight:700,fontSize:12,opacity:loans.length?1:.4,marginLeft:12}}>Download</button>
            </div>
          </div>
        )}
        {tab==="import"&&(
          importSuccess?(
            <div style={{textAlign:"center",padding:"30px 20px"}}>
              <div style={{fontSize:48,marginBottom:12}}>✅</div>
              <div style={{fontWeight:800,fontSize:16,color:t.tx1,marginBottom:6}}>Loans Imported!</div>
              <button onClick={onClose} style={{background:"#6366f1",border:"none",borderRadius:10,padding:"10px 28px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>Done</button>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <input ref={fileRef} type="file" accept=".json,.csv" onChange={handleFile} style={{display:"none"}}/>
              <button onClick={()=>fileRef.current?.click()} style={{width:"100%",background:t.surf,border:`2px dashed ${t.border}`,borderRadius:12,padding:"18px",color:t.tx2,cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                <span style={{fontSize:28}}>📂</span>
                <span>Click to choose a backup file</span>
                <span style={{fontSize:11,color:t.tx3}}>Supports .json (full backup) and .csv (spreadsheet)</span>
              </button>
              <textarea value={importText} onChange={e=>{setImportText(e.target.value);if(e.target.value.trim()) parseImport(e.target.value,false);else{setImportPreview(null);setImportError("");}}} placeholder="Or paste JSON backup here…" style={{width:"100%",height:100,background:t.surf,border:`1px solid ${importError?"#ef4444":t.border}`,borderRadius:10,padding:"10px 12px",color:t.tx1,fontSize:12,fontFamily:"monospace",resize:"vertical",boxSizing:"border-box"}}/>
              {importError&&<div style={{background:"#ef444418",border:"1px solid #ef444433",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#ef4444"}}>⚠ {importError}</div>}
              {importPreview&&(
                <div style={{background:t.surf,border:"1px solid #10b98144",borderRadius:12,padding:"14px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#10b981"}}>✓ {importPreview.loans.length} loan{importPreview.loans.length!==1?"s":""} found</div>
                    {importPreview.fromCSV&&<span style={{fontSize:10,background:"#10b98120",border:"1px solid #10b98133",borderRadius:5,padding:"2px 7px",color:"#10b981",fontWeight:700}}>CSV</span>}
                  </div>
                  {importPreview.loans.map((l,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,marginBottom:4}}>
                      <div style={{width:10,height:10,borderRadius:"50%",background:l.color||"#6366f1",flexShrink:0}}/>
                      <span style={{color:t.tx1,fontWeight:600}}>{getLoanType(l.type).icon} {l.name}</span>
                      <span style={{color:t.tx3}}>{fmt$(parseFloat(l.currentBalance)||0)}</span>
                    </div>
                  ))}
                  {importPreview.fromCSV&&<div style={{fontSize:11,color:t.tx3,marginTop:8,paddingTop:8,borderTop:`1px solid ${t.border}`}}>⚠ CSV import does not restore colors from other apps — default colors assigned. Edit any loan to customize.</div>}
                  <div style={{display:"flex",gap:8,marginTop:12}}>
                    <button onClick={()=>confirmImport("replace")} style={{flex:1,background:"#ef4444",border:"none",borderRadius:9,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:12}}>Replace All</button>
                    <button onClick={()=>confirmImport("merge")} style={{flex:1,background:"#6366f1",border:"none",borderRadius:9,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:12}}>Merge</button>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App(){
  const [loading,setLoading]=useState(true);
  const [profiles,setProfiles]=useState([]);
  const [activeProfileId,setActiveProfileId]=useState(null);
  const [loans,setLoans]=useState([]);
  const [apiKey,setApiKey]=useState("");
  const [showProfile,setShowProfile]=useState(false);
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [darkMode,setDarkMode]=useState(()=>localStorage.getItem("lt_dark")!=="false");
  useEffect(()=>{localStorage.setItem("lt_dark",darkMode);},[darkMode]);

  useEffect(()=>{
    async function init(){
      const [profs,aid,key]=await Promise.all([storeGet("cc_profiles",true),storeGet("cc_active_profile",true),storeGet("cc_apikey",true)]);
      if(profs) setProfiles(profs);
      if(aid) setActiveProfileId(aid);
      if(key) setApiKey(key);
      const lk=aid?`lt_loans_${aid}`:"lt_loans_default";
      const saved=await storeGet(lk,true);
      if(saved) setLoans(saved);
      setLoading(false);
      if(!profs||profs.length===0) setShowProfile(true);
    }
    init();
  },[]);

  useEffect(()=>{if(!loading) storeSet("cc_profiles",profiles,true);},[profiles,loading]);
  useEffect(()=>{
    if(!loading&&activeProfileId){
      storeSet("cc_active_profile",activeProfileId,true);
      const lk=`lt_loans_${activeProfileId}`;
      storeGet(lk,true).then(v=>{if(v) setLoans(v);else setLoans([]);});
    }
  },[activeProfileId]);
  useEffect(()=>{if(!loading){const lk=activeProfileId?`lt_loans_${activeProfileId}`:"lt_loans_default";storeSet(lk,loans,true);}},[loans,loading,activeProfileId]);
  useEffect(()=>{if(!loading) storeSet("cc_apikey",apiKey,true);},[apiKey,loading]);

  const activeProfile=profiles.find(p=>p.id===activeProfileId)||null;
  const logsKey=activeProfileId?`lt_logs_${activeProfileId}`:"lt_logs_default";

  const [showForm,setShowForm]=useState(false);
  const [editLoan,setEditLoan]=useState(null);
  const [showPlanner,setShowPlanner]=useState(false);
  const [focusLoan,setFocusLoan]=useState(null);
  const [allExpanded,setAllExpanded]=useState(false);
  const [showApiKey,setShowApiKey]=useState(false);
  const [showBackup,setShowBackup]=useState(false);
  const [quickPayLoan,setQuickPayLoan]=useState(null);

  function saveProfile(p){setProfiles(ps=>{const i=ps.findIndex(x=>x.id===p.id);if(i>=0){const n=[...ps];n[i]=p;return n;}return[...ps,p];});setActiveProfileId(p.id);setShowProfile(false);}
  function saveLoan(loan){setLoans(ls=>{const i=ls.findIndex(l=>l.id===loan.id);if(i>=0){const n=[...ls];n[i]=loan;return n;}return[...ls,loan];});setShowForm(false);setEditLoan(null);}
  function confirmDelete(loan){setDeleteTarget(loan);}
  function doDelete(){if(deleteTarget) setLoans(ls=>ls.filter(l=>l.id!==deleteTarget.id));setDeleteTarget(null);}
  function handleQuickPay(payment){
    setLoans(ls=>ls.map(l=>{
      if(l.id!==payment.loanId) return l;
      const newBal=Math.max(0,(parseFloat(l.currentBalance)||0)-payment.principal);
      const newRem=calcRemainingMonths(newBal,parseFloat(l.interestRate)||0,parseFloat(l.monthlyPayment)||0);
      return {...l,currentBalance:newBal.toFixed(2),remainingMonths:newRem<990?newRem.toString():l.remainingMonths};
    }));
    // Auto-log to Progress tab
    storeGet(logsKey,true).then(existing=>{
      const logs=existing||[];
      const newEntry={id:generateId(),loanId:payment.loanId,loanName:payment.loanName,loanColor:loans.find(l=>l.id===payment.loanId)?.color||"#6366f1",loanType:loans.find(l=>l.id===payment.loanId)?.type||"other",amount:payment.actual,planned:payment.expected,date:payment.date};
      storeSet(logsKey,[...logs,newEntry],true);
    });
    setQuickPayLoan(null);
  }
  function handleImport(importedLoans,mode){
    if(mode==="replace") setLoans(importedLoans.map(l=>({...l,id:l.id||generateId()})));
    else setLoans(ls=>{const existing=new Set(ls.map(l=>l.name?.toLowerCase()));const toAdd=importedLoans.filter(l=>!existing.has(l.name?.toLowerCase())).map(l=>({...l,id:generateId()}));return[...ls,...toAdd];});
  }

  const t=useTheme(darkMode);
  const {isMobile,isTablet}=useBreakpoint();

  if(loading) return(
    <div style={{minHeight:"100vh",background:t.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,padding:20}}>
      <div style={{width:40,height:40,border:"3px solid #6366f1",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
      <div style={{fontSize:14,color:t.tx2,textAlign:"center"}}>Loading your loans…</div>
      <div style={{fontSize:12,color:t.tx3,textAlign:"center",maxWidth:280}}>If a login prompt appeared, close it — the app loads in local mode automatically.</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif",color:t.tx1}}>
      {/* Nav */}
      <div style={{background:t.deepBg,borderBottom:`1px solid ${t.border}`,padding:isMobile?"10px 12px":"11px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#10b981,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🏦</div>
          {!isMobile&&<span style={{fontWeight:800,fontSize:18,color:t.tx1}}>LoanTracker</span>}
          <span style={{fontSize:10,color:hasCloudStorage()?"#10b981":"#f59e0b",background:hasCloudStorage()?"#10b98118":"#f59e0b18",border:`1px solid ${hasCloudStorage()?"#10b98133":"#f59e0b33"}`,borderRadius:6,padding:"2px 8px",whiteSpace:"nowrap"}}>{hasCloudStorage()?"☁ Cloud":"💾 Local"}</span>
          {loans.length>0&&<span style={{fontSize:10,background:"#6366f118",border:"1px solid #6366f133",color:"#6366f1",borderRadius:6,padding:"2px 8px",fontWeight:700}}>{loans.length} loan{loans.length!==1?"s":""}</span>}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {loans.length>0&&<button onClick={()=>{setFocusLoan(null);setShowPlanner(true);}} style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",border:"none",borderRadius:9,padding:isMobile?"7px 10px":"7px 14px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:isMobile?11:12,whiteSpace:"nowrap"}}>{isMobile?"📊":"📊 Planner"}</button>}
          <button onClick={()=>setAllExpanded(e=>!e)} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 11px",color:t.tx2,cursor:"pointer",fontSize:13}}>{allExpanded?"▲":"▼"}</button>
          <button onClick={()=>setDarkMode(d=>!d)} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 11px",color:t.tx1,cursor:"pointer",fontSize:14}}>{darkMode?"☀️":"🌙"}</button>
          {!isMobile&&<button onClick={()=>setShowBackup(true)} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 11px",color:t.tx2,cursor:"pointer",fontSize:13}}>📦</button>}
          {isMobile&&<button onClick={()=>setShowBackup(true)} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 9px",color:t.tx2,cursor:"pointer",fontSize:12}}>📦</button>}
          <button onClick={()=>setShowApiKey(true)} style={{background:apiKey?"#6366f118":t.surf,border:`1px solid ${apiKey?"#6366f133":t.border}`,borderRadius:8,padding:"6px 11px",color:apiKey?"#6366f1":t.tx2,cursor:"pointer",fontSize:13}}>🔑</button>
          <button onClick={()=>setShowProfile(true)} style={{width:32,height:32,borderRadius:"50%",background:activeProfile?.avatarColor||"#6366f1",border:"none",cursor:"pointer",fontWeight:800,fontSize:12,color:"#fff",flexShrink:0}}>{getInitials(activeProfile?.name)}</button>
        </div>
      </div>

      {/* Main */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:isMobile?"12px":"20px 16px"}}>
        {loans.length>0&&<SummaryBar loans={loans} darkMode={darkMode}/>}
        {loans.length>0&&(
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            {LOAN_TYPES.map(lt=>{
              const count=loans.filter(l=>l.type===lt.id).length;
              if(!count) return null;
              const totalBal=loans.filter(l=>l.type===lt.id).reduce((s,l)=>s+(parseFloat(l.currentBalance)||0),0);
              return(<div key={lt.id} style={{background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:10,padding:"8px 12px",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>{lt.icon}</span>
                <div><div style={{fontSize:11,fontWeight:700,color:t.tx1}}>{lt.label}</div><div style={{fontSize:10,color:t.tx3,fontFamily:"monospace"}}>{fmt$(totalBal)}</div></div>
              </div>);
            })}
          </div>
        )}
        {loans.length>0?(
          <div style={{display:"grid",gridTemplateColumns:isTablet&&!isMobile?"1fr 1fr":"1fr",gap:12,marginBottom:20}}>
            {loans.map(loan=>(
              <LoanPanel key={loan.id} loan={loan}
                onEdit={l=>{setEditLoan(l);setShowForm(true);}}
                onDelete={confirmDelete}
                onQuickPay={l=>setQuickPayLoan(l)}
                onOpenPlanner={l=>{setFocusLoan(l);setShowPlanner(true);}}
                darkMode={darkMode} globalExpanded={allExpanded}/>
            ))}
          </div>
        ):(
          <div style={{textAlign:"center",padding:"60px 20px"}}>
            <div style={{fontSize:56,marginBottom:16}}>🏦</div>
            <div style={{fontWeight:800,fontSize:20,color:t.tx1,marginBottom:8}}>No loans yet</div>
            <div style={{fontSize:14,color:t.tx2,maxWidth:380,margin:"0 auto 24px",lineHeight:1.6}}>Add your auto loan, mortgage, student loans, or any installment debt to start tracking payoff progress.</div>
            <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
              {LOAN_TYPES.map(lt=>(
                <button key={lt.id} onClick={()=>{setEditLoan({...DEFAULT_LOAN,type:lt.id,color:lt.defaultColor});setShowForm(true);}} style={{background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 18px",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13,display:"flex",alignItems:"center",gap:6}}>
                  {lt.icon} {lt.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {loans.length>0&&(
          <button onClick={()=>{setEditLoan(null);setShowForm(true);}} style={{width:"100%",background:t.panelBg,border:`2px dashed ${t.border}`,borderRadius:14,padding:"14px",color:t.tx2,cursor:"pointer",fontWeight:600,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            + Add Another Loan
          </button>
        )}
      </div>

      {/* Modals */}
      {showForm&&<LoanFormModal initial={editLoan} onSave={saveLoan} onClose={()=>{setShowForm(false);setEditLoan(null);}} darkMode={darkMode}/>}
      {showProfile&&<ProfileModal profile={activeProfile} onSave={saveProfile} onClose={()=>setShowProfile(false)} onSwitch={id=>{setActiveProfileId(id);setShowProfile(false);}} allProfiles={profiles} darkMode={darkMode}/>}
      {showPlanner&&<PayoffPlannerModal loans={loans} logsKey={logsKey} darkMode={darkMode} apiKey={apiKey} profileId={activeProfileId||"default"} focusLoan={focusLoan} onClose={()=>{setShowPlanner(false);setFocusLoan(null);}}/>}
      {showApiKey&&<ApiKeyModal currentKey={apiKey} onSave={k=>{setApiKey(k);storeSet("cc_apikey",k,true);}} onClose={()=>setShowApiKey(false)} darkMode={darkMode}/>}
      {showBackup&&<ImportExportModal loans={loans} profile={activeProfile} onImport={handleImport} onClose={()=>setShowBackup(false)} darkMode={darkMode}/>}
      {deleteTarget&&<DeleteConfirm loanName={deleteTarget.name} onConfirm={doDelete} onCancel={()=>setDeleteTarget(null)} darkMode={darkMode}/>}
      {quickPayLoan&&<QuickPayModal loan={quickPayLoan} onConfirm={handleQuickPay} onClose={()=>setQuickPayLoan(null)} darkMode={darkMode}/>}
    </div>
  );
}
