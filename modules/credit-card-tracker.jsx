import { useState, useEffect, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const PRESET_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#f59e0b","#8b5cf6","#ef4444","#14b8a6","#84cc16","#06b6d4","#f43f5e"];
const AVATAR_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];
const DEFAULT_CARD  = { id:null,name:"",last4:"",color:"#6366f1",balance:"",limit:"",apr:"",minPaymentMode:"auto",minPaymentFixed:"",monthlyPayment:"",payoffMonths:"",payoffMode:"payment",dueDay:"",statementDay:"",expiration:"",originalBalance:"" };
const DEFAULT_PROFILE = { id:null,name:"",email:"",avatarColor:"#6366f1",createdAt:null };
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL   = "claude-sonnet-4-20250514";

// ─── Pure Helpers ─────────────────────────────────────────────────────────────
const generateId  = () => Date.now().toString(36)+Math.random().toString(36).slice(2);
const calcMinPmt  = (bal,apr) => !bal||bal<=0 ? 0 : Math.max(25, bal*(apr/100/12)+bal*0.01);
const fmt$        = n => (!isFinite(n)||isNaN(n)) ? "—" : new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
const fmtMo       = d => d.toLocaleDateString("en-US",{month:"short",year:"numeric"});
const fmtDate     = d => d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const addMo       = (d,n) => { const x=new Date(d); x.setMonth(x.getMonth()+n); return x; };
const getInitials = n => !n ? "?" : n.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);

function calcPayoff(balance,apr,monthly){
  if(!balance||balance<=0||!monthly) return {months:0,totalInterest:0,totalPaid:0};
  const r=apr/100/12;
  if(r===0){ const m=Math.ceil(balance/monthly); return {months:m,totalInterest:0,totalPaid:monthly*m}; }
  if(monthly<=balance*r) return {months:Infinity,totalInterest:Infinity,totalPaid:Infinity};
  const m=Math.ceil(-Math.log(1-(balance*r)/monthly)/Math.log(1+r));
  return {months:m,totalInterest:monthly*m-balance,totalPaid:monthly*m};
}
function calcPmtForMonths(bal,apr,months){
  if(!bal||!months||months<=0) return 0;
  const r=apr/100/12;
  return r===0 ? bal/months : (bal*r)/(1-Math.pow(1+r,-months));
}
function getNextPmt(dueDay){
  if(!dueDay) return null;
  const today=new Date(), day=Number(dueDay);
  let t=new Date(today.getFullYear(),today.getMonth(),day);
  if(t<=today) t=new Date(today.getFullYear(),today.getMonth()+1,day);
  return {daysUntil:Math.ceil((t-today)/86400000)};
}

// ─── Anthropic API helper (works logged-in OR with explicit key) ──────────────
async function callClaude(apiKey, body) {
  const headers = { "Content-Type":"application/json" };
  if (apiKey && apiKey.trim()) headers["x-api-key"] = apiKey.trim();
  const res = await fetch(API_URL, { method:"POST", headers, body:JSON.stringify(body) });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res;
}

// ─── Storage helpers — probes cloud storage; falls back to localStorage ───────
let _cloudAvailable = null; // null = untested, true/false = result

async function probeCloudStorage() {
  if (_cloudAvailable !== null) return _cloudAvailable;
  if (typeof window === "undefined" || !window.storage || typeof window.storage.get !== "function") {
    _cloudAvailable = false; return false;
  }
  try {
    // Race: if the login modal appears and is dismissed, the promise either
    // rejects or never resolves — either way we timeout after 2.5s
    const probe = window.storage.get("__probe__", false);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2500));
    await Promise.race([probe, timeout]);
    _cloudAvailable = true;
  } catch {
    _cloudAvailable = false;
  }
  return _cloudAvailable;
}

async function storeGet(key, shared=false) {
  if (await probeCloudStorage()) {
    try { const r = await window.storage.get(key, shared); return r ? JSON.parse(r.value) : null; }
    catch { _cloudAvailable = false; } // disable cloud for rest of session
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

// ─── Schedule Engine ──────────────────────────────────────────────────────────
function computeSchedule(rawCards, method, opts={}) {
  const { extraBudget=0, lumpSums=[], dynamicMins=false } = opts;
  const cards=rawCards.map(c=>{
    const bal=parseFloat(c.balance)||0, apr=parseFloat(c.apr)||0;
    const min=c.minPaymentMode==="auto"?calcMinPmt(bal,apr):(parseFloat(c.minPaymentFixed)||0);
    const monthly=parseFloat(c.monthlyPayment)||min;
    return {id:c.id,name:c.name,color:c.color,last4:c.last4,apr,balance:bal,minPayment:min,userMonthly:monthly};
  }).filter(c=>c.balance>0);
  if(!cards.length) return {months:[],cardPayoffs:[],totalInterest:0,totalPaid:0,totalMonths:0,cards:[],totalBudget:0};

  const base=cards.reduce((s,c)=>s+c.userMonthly,0)+extraBudget;
  const sorted=method==="avalanche"?[...cards].sort((a,b)=>b.apr-a.apr):[...cards].sort((a,b)=>a.balance-b.balance);
  const balances={},paidOff={};
  cards.forEach(c=>{balances[c.id]=c.balance;paidOff[c.id]=false;});
  const payoffs=[],rows=[],intTotals={};
  cards.forEach(c=>{intTotals[c.id]=0;});
  let month=0;
  while(month<600){
    const active=sorted.filter(c=>balances[c.id]>0.005);
    if(!active.length) break;
    month++;
    lumpSums.filter(ls=>ls.month===month).forEach(ls=>{
      let rem=ls.amount;
      for(const c of sorted){ if(balances[c.id]<=0) continue; const a=Math.min(rem,balances[c.id]); balances[c.id]-=a; rem-=a; if(rem<=0) break; }
    });
    const mins={};
    active.forEach(c=>{ mins[c.id]=dynamicMins?calcMinPmt(balances[c.id],c.apr):c.minPayment; });
    const minTotal=active.reduce((s,c)=>s+Math.min(mins[c.id],balances[c.id]),0);
    let rem=Math.max(base,minTotal);
    const rPmts={},rInt={},rBal={};
    active.forEach(c=>{
      const int=balances[c.id]*(c.apr/100/12);
      const minDue=Math.min(mins[c.id],balances[c.id]+int);
      balances[c.id]=Math.max(0,balances[c.id]+int-minDue);
      rInt[c.id]=int; rPmts[c.id]=minDue;
      intTotals[c.id]=(intTotals[c.id]||0)+int;
      rem-=minDue;
    });
    for(const c of active){
      if(balances[c.id]<=0.005||rem<=0) { if(rem<=0) break; continue; }
      const ex=Math.min(rem,balances[c.id]);
      rPmts[c.id]=(rPmts[c.id]||0)+ex; balances[c.id]=Math.max(0,balances[c.id]-ex); rem-=ex;
    }
    active.forEach(c=>{
      rBal[c.id]=Math.max(0,balances[c.id]);
      if(balances[c.id]<0.005&&!paidOff[c.id]){ balances[c.id]=0; paidOff[c.id]=true; payoffs.push({id:c.id,name:c.name,color:c.color,month,date:addMo(new Date(),month)}); }
    });
    rows.push({month,payments:{...rPmts},interest:{...rInt},balances:{...rBal}});
  }
  const totalInterest=Object.values(intTotals).reduce((s,v)=>s+v,0);
  return {months:rows,cardPayoffs:payoffs,totalInterest,totalPaid:cards.reduce((s,c)=>s+c.balance,0)+totalInterest,totalMonths:month,cards,totalBudget:base};
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function useTheme(dm){
  return {
    bg:dm?"#020617":"#f1f5f9", panelBg:dm?"#0f172a":"#ffffff",
    surf:dm?"#1e293b":"#f1f5f9", deepBg:dm?"#0a0f1e":"#ffffff",
    border:dm?"#1e293b":"#e2e8f0", border2:dm?"#334155":"#cbd5e1",
    tx1:dm?"#f1f5f9":"#0f172a", tx2:dm?"#94a3b8":"#64748b", tx3:dm?"#475569":"#94a3b8",
  };
}

// ─── Responsive breakpoint hook ──────────────────────────────────────────────
function useBreakpoint(){
  const [w,setW]=useState(()=>typeof window!=="undefined"?window.innerWidth:1200);
  useEffect(()=>{
    const h=()=>setW(window.innerWidth);
    window.addEventListener("resize",h);
    return()=>window.removeEventListener("resize",h);
  },[]);
  return{isMobile:w<640,isTablet:w<1024,w};
}

// ─── ICS calendar export ──────────────────────────────────────────────────────
function generateICS(cards){
  const now=new Date();
  const stamp=now.toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z";
  const pad=(n)=>String(n).padStart(2,"0");
  const dateStr=(d)=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  const escape=(s)=>(s||"").replace(/[,;\\]/g,"\\$&").replace(/\n/g,"\\n");

  const lines=[
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CardTracker//Financial Freedom Platform//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:CardTracker Payments",
    "X-WR-TIMEZONE:America/New_York",
  ];

  cards.forEach(card=>{
    const bal=parseFloat(card.balance)||0;
    const apr=parseFloat(card.apr)||0;
    const mo=parseFloat(card.monthlyPayment)||calcMinPmt(bal,apr);

    // ── Payment due — monthly recurring ──────────────────────────────────────
    if(card.dueDay){
      const day=Number(card.dueDay);
      const yr=now.getFullYear(),mn=now.getMonth()+1;
      const dtstart=`${yr}${pad(mn)}${pad(day)}`;
      lines.push(
        "BEGIN:VEVENT",
        `UID:pmt-due-${card.id}@cardtracker`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `RRULE:FREQ=MONTHLY;BYMONTHDAY=${day}`,
        `SUMMARY:💳 ${escape(card.name)} Payment Due`,
        `DESCRIPTION:Payment due for ${escape(card.name)}${card.last4?` (****${card.last4})`:""}\\nBalance: $${bal.toFixed(2)}\\nMonthly payment: $${mo.toFixed(2)}`,
        "BEGIN:VALARM",
        "TRIGGER:-P3D",
        "ACTION:DISPLAY",
        `DESCRIPTION:3 days until ${escape(card.name)} payment is due`,
        "END:VALARM",
        "BEGIN:VALARM",
        "TRIGGER:-P1D",
        "ACTION:DISPLAY",
        `DESCRIPTION:Tomorrow: ${escape(card.name)} payment due`,
        "END:VALARM",
        "END:VEVENT"
      );
    }

    // ── Statement close — monthly recurring ───────────────────────────────────
    if(card.statementDay){
      const day=Number(card.statementDay);
      const yr=now.getFullYear(),mn=now.getMonth()+1;
      const dtstart=`${yr}${pad(mn)}${pad(day)}`;
      lines.push(
        "BEGIN:VEVENT",
        `UID:pmt-stmt-${card.id}@cardtracker`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `RRULE:FREQ=MONTHLY;BYMONTHDAY=${day}`,
        `SUMMARY:📋 ${escape(card.name)} Statement Closes`,
        `DESCRIPTION:Statement closing date for ${escape(card.name)}${card.last4?` (****${card.last4})`:""}\\nNew charges after this date appear on next month's bill.`,
        "BEGIN:VALARM",
        "TRIGGER:-P3D",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escape(card.name)} statement closes in 3 days — limit new charges`,
        "END:VALARM",
        "END:VEVENT"
      );
    }

    // ── Projected payoff — single event ──────────────────────────────────────
    const {months}=calcPayoff(bal,apr,mo);
    if(months<Infinity&&months>0){
      const pd=addMo(new Date(),months);
      lines.push(
        "BEGIN:VEVENT",
        `UID:pmt-payoff-${card.id}@cardtracker`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${dateStr(pd)}`,
        `SUMMARY:🎉 ${escape(card.name)} PAID OFF!`,
        `DESCRIPTION:Projected payoff date for ${escape(card.name)}\\n${months} months from today at $${mo.toFixed(2)}/mo\\nAPR: ${apr}%`,
        "END:VEVENT"
      );
    }
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// ─── SVG Balance Chart ────────────────────────────────────────────────────────
function BalanceChart({schedule,darkMode,title}){
  const t=useTheme(darkMode);
  const W=600,H=260,PL=64,PR=16,PT=20,PB=48,cW=W-PL-PR,cH=H-PT-PB;
  if(!schedule?.months?.length||!schedule?.cards?.length) return null;
  const step=Math.max(1,Math.floor(schedule.months.length/60));
  const sampled=[{month:0,balances:Object.fromEntries(schedule.cards.map(c=>[c.id,c.balance]))},
    ...schedule.months.filter((_,i)=>i%step===0||i===schedule.months.length-1)];
  const maxBal=Math.max(...schedule.cards.map(c=>c.balance),1);
  const maxMo=schedule.totalMonths||1;
  const xS=m=>(m/maxMo)*cW, yS=b=>cH-(b/maxBal)*cH;
  const yTicks=[0,.25,.5,.75,1].map(f=>({val:maxBal*f,y:yS(maxBal*f)}));
  const xTicks=[];
  for(let m=0;m<=maxMo;m+=12) xTicks.push({m,x:xS(m)});
  return (
    <div style={{background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:14,padding:"16px 20px"}}>
      {title&&<div style={{fontSize:11,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>{title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}>
        {yTicks.map((tk,i)=><g key={i}><line x1={PL} y1={PT+tk.y} x2={PL+cW} y2={PT+tk.y} stroke={t.border} strokeWidth=".5" strokeDasharray="4,4"/><text x={PL-6} y={PT+tk.y+4} textAnchor="end" fontSize={9} fill={t.tx3}>{fmt$(tk.val).replace(".00","")}</text></g>)}
        {xTicks.map((tk,i)=><g key={i}><line x1={PL+tk.x} y1={PT+cH} x2={PL+tk.x} y2={PT+cH+4} stroke={t.tx3} strokeWidth="1"/><text x={PL+tk.x} y={PT+cH+16} textAnchor="middle" fontSize={9} fill={t.tx3}>{tk.m===0?"Now":`Mo ${tk.m}`}</text></g>)}
        <line x1={PL} y1={PT} x2={PL} y2={PT+cH} stroke={t.border2} strokeWidth="1"/>
        <line x1={PL} y1={PT+cH} x2={PL+cW} y2={PT+cH} stroke={t.border2} strokeWidth="1"/>
        {schedule.cards.map((card,i)=>{
          const pts=sampled.map(r=>`${PL+xS(r.month)},${PT+yS(r.balances[card.id]??0)}`);
          const po=schedule.cardPayoffs.find(p=>p.id===card.id);
          return <g key={card.id}><polyline points={pts.join(" ")} fill="none" stroke={card.color} strokeWidth="2" strokeLinejoin="round"/>{po&&<circle cx={PL+xS(po.month)} cy={PT+cH} r={5} fill={card.color} stroke={t.panelBg} strokeWidth={2}/>}</g>;
        })}
        {schedule.cards.map((card,i)=>(
          <g key={card.id} transform={`translate(${PL+10+i*120},${PT+10})`}>
            <rect width={10} height={3} y={4} rx={1} fill={card.color}/><text x={14} y={10} fontSize={9} fill={t.tx2}>{card.name.slice(0,12)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Comparison Chart ─────────────────────────────────────────────────────────
function ComparisonChart({avalanche,snowball,darkMode}){
  const t=useTheme(darkMode);
  const W=600,H=220,PL=64,PR=16,PT=20,PB=48,cW=W-PL-PR,cH=H-PT-PB;
  if(!avalanche?.months?.length) return null;
  const maxBal=Math.max(...(avalanche.cards||[]).map(c=>c.balance),1);
  const maxMo=Math.max(avalanche.totalMonths,snowball.totalMonths,1);
  const xS=m=>(m/maxMo)*cW, yS=b=>cH-(b/maxBal)*cH;
  function totals(s){ return [{m:0,b:s.cards?.reduce((a,c)=>a+c.balance,0)||0},...s.months.map(r=>({m:r.month,b:Object.values(r.balances).reduce((a,v)=>a+v,0)}))] ; }
  const av=totals(avalanche), sn=totals(snowball);
  const yTicks=[0,.25,.5,.75,1].map(f=>({val:maxBal*f,y:yS(maxBal*f)}));
  const xTicks=[]; for(let m=0;m<=maxMo;m+=Math.max(6,Math.floor(maxMo/8))) xTicks.push({m,x:xS(m)});
  const line=pts=>pts.map(p=>`${PL+xS(p.m)},${PT+yS(p.b)}`).join(" ");
  return (
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
        <line x1={PL+xS(avalanche.totalMonths)} y1={PT} x2={PL+xS(avalanche.totalMonths)} y2={PT+cH} stroke="#f97316" strokeWidth="1" strokeDasharray="3,3"/>
        <line x1={PL+xS(snowball.totalMonths)} y1={PT} x2={PL+xS(snowball.totalMonths)} y2={PT+cH} stroke="#3b82f6" strokeWidth="1" strokeDasharray="3,3"/>
        <g transform={`translate(${PL+10},${PT+10})`}><line x1={0} y1={5} x2={20} y2={5} stroke="#f97316" strokeWidth="2.5"/><text x={24} y={9} fontSize={9} fill={t.tx2}>🔥 Avalanche ({avalanche.totalMonths} mo)</text></g>
        <g transform={`translate(${PL+10},${PT+24})`}><line x1={0} y1={5} x2={20} y2={5} stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="6,3"/><text x={24} y={9} fontSize={9} fill={t.tx2}>❄️ Snowball ({snowball.totalMonths} mo)</text></g>
      </svg>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
        {[{label:"🔥 Avalanche saves",val:fmt$(Math.abs(avalanche.totalInterest-snowball.totalInterest))+" interest",color:"#f97316"},{label:"❄️ Snowball first payoff",val:snowball.cardPayoffs[0]?`${snowball.cardPayoffs[0].name} — Mo ${snowball.cardPayoffs[0].month}`:"—",color:"#3b82f6"}].map(s=>(
          <div key={s.label} style={{background:t.surf,borderRadius:10,padding:"8px 12px"}}>
            <div style={{fontSize:9,color:s.color,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>{s.label}</div>
            <div style={{fontSize:12,fontWeight:700,color:t.tx1}}>{s.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportCSV(schedule,method){
  if(!schedule?.months?.length) return;
  const ordered=schedule.cardPayoffs.map(p=>schedule.cards.find(c=>c.id===p.id)).filter(Boolean);
  const headers=["Month","Date",...ordered.map(c=>`${c.name} Balance`),...ordered.map(c=>`${c.name} Payment`),"Total Paid","Total Interest"];
  const rows=schedule.months.map(row=>{
    const tPaid=Object.values(row.payments).reduce((s,v)=>s+v,0);
    const tInt=Object.values(row.interest).reduce((s,v)=>s+v,0);
    return [row.month,fmtDate(addMo(new Date(),row.month)),...ordered.map(c=>(row.balances[c.id]??0).toFixed(2)),...ordered.map(c=>(row.payments[c.id]||0).toFixed(2)),tPaid.toFixed(2),tInt.toFixed(2)];
  });
  const csv=[headers,...rows].map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=`payoff-${method}.csv`; a.style.display="none";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),100);
}

// ─── Markdown renderer (top-level component — never nest in another component) ─
function Markdown({text,tx1,tx2}){
  if(!text) return null;
  const lines=text.split("\n");
  return(
    <div>
      {lines.map((line,i)=>{
        if(line.startsWith("## ")||line.startsWith("### "))
          return <div key={i} style={{fontWeight:800,fontSize:14,color:tx1,margin:"14px 0 4px"}}>{line.replace(/^#+\s/,"")}</div>;
        if(line.startsWith("**")&&line.endsWith("**"))
          return <div key={i} style={{fontWeight:700,color:tx1,fontSize:13,margin:"6px 0"}}>{line.slice(2,-2)}</div>;
        if(line.startsWith("- ")||line.startsWith("• ")){
          const ps=line.slice(2).split(/\*\*(.*?)\*\*/g);
          return(
            <div key={i} style={{display:"flex",gap:8,margin:"3px 0",fontSize:13}}>
              <span style={{color:"#6366f1",flexShrink:0}}>▸</span>
              <span style={{color:tx2,lineHeight:1.6}}>{ps.map((p,j)=>j%2===1?<strong key={j} style={{color:tx1}}>{p}</strong>:p)}</span>
            </div>
          );
        }
        if(!line.trim()) return <div key={i} style={{height:5}}/>;
        const ps=line.split(/\*\*(.*?)\*\*/g);
        return <p key={i} style={{margin:"3px 0",fontSize:13,color:tx2,lineHeight:1.6}}>{ps.map((p,j)=>j%2===1?<strong key={j} style={{color:tx1}}>{p}</strong>:p)}</p>;
      })}
    </div>
  );
}

// ─── Import / Export Modal ────────────────────────────────────────────────────
function ImportExportModal({cards,profile,onImport,onClose,darkMode}){
  const t=useTheme(darkMode);
  const [tab,setTab]=useState("export");
  const [importText,setImportText]=useState("");
  const [importError,setImportError]=useState("");
  const [importPreview,setImportPreview]=useState(null);
  const [importSuccess,setImportSuccess]=useState(false);
  const fileRef=useRef(null);

  // ── Export helpers ──────────────────────────────────────────────────────────
  function downloadFile(content, filename, type){
    const blob=new Blob([content],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=filename; a.style.display="none";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),100);
  }

  function exportJSON(){
    const payload={
      exportedAt: new Date().toISOString(),
      exportVersion: 1,
      profile: {name:profile.name, pin:profile.pin||"", avatarColor:profile.avatarColor},
      cards: cards.map(c=>({...c}))
    };
    downloadFile(JSON.stringify(payload,null,2), `cardtracker-${(profile.name||"backup").replace(/\s+/g,"-").toLowerCase()}-${new Date().toISOString().slice(0,10)}.json`, "application/json");
  }

  function exportCSV(){
    const headers=["Name","Last4","Balance","CreditLimit","APR","MinPaymentMode","MinPaymentFixed","MonthlyPayment","PayoffMonths","DueDay","StatementDay","Expiration","OriginalBalance","Color"];
    const rows=cards.map(c=>[
      `"${(c.name||"").replace(/"/g,'""')}"`,
      c.last4||"", c.balance||"", c.limit||"", c.apr||"",
      c.minPaymentMode||"auto", c.minPaymentFixed||"", c.monthlyPayment||"",
      c.payoffMonths||"", c.dueDay||"", c.statementDay||"",
      c.expiration||"", c.originalBalance||"", c.color||"#6366f1"
    ].join(","));
    const csv=[headers.join(","),...rows].join("\n");
    downloadFile(csv, `cardtracker-${(profile.name||"backup").replace(/\s+/g,"-").toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`, "text/csv");
  }

  // ── Import helpers ──────────────────────────────────────────────────────────
  function parseImport(text){
    setImportError(""); setImportPreview(null); setImportSuccess(false);
    if(!text.trim()){ setImportError("Please paste your backup data or load a file."); return; }
    // Try JSON first
    try{
      const data=JSON.parse(text);
      const importedCards=data.cards||data; // support bare array too
      if(!Array.isArray(importedCards)) throw new Error("No cards array found");
      const cleaned=importedCards.map(c=>({
        ...{...c, id: c.id||generateId()}
      }));
      setImportPreview({type:"json",cards:cleaned,profile:data.profile||null,exportedAt:data.exportedAt||null});
      return;
    }catch(e){ /* not JSON, try CSV */ }
    // Try CSV
    try{
      const lines=text.trim().split("\n").filter(l=>l.trim());
      if(lines.length<2) throw new Error("Need at least a header row and one data row");
      const headers=lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/"/g,""));
      const nameIdx=headers.indexOf("name");
      if(nameIdx===-1) throw new Error("CSV must have a 'Name' column");
      const cleaned=lines.slice(1).map(line=>{
        // Handle quoted fields
        const cols=[]; let cur="",inQ=false;
        for(let i=0;i<line.length;i++){
          if(line[i]==='"'){ inQ=!inQ; }
          else if(line[i]===","&&!inQ){ cols.push(cur.trim()); cur=""; }
          else cur+=line[i];
        }
        cols.push(cur.trim());
        const get=(field)=>{ const i=headers.indexOf(field.toLowerCase()); return i>=0?(cols[i]||""):""; };
        return {
          id: generateId(),
          name: get("name"),
          last4: get("last4"),
          balance: get("balance"),
          limit: get("creditlimit"),
          apr: get("apr"),
          minPaymentMode: get("minpaymentmode")||"auto",
          minPaymentFixed: get("minpaymentfixed"),
          monthlyPayment: get("monthlypayment"),
          payoffMonths: get("payoffmonths"),
          payoffMode: get("payoffmonths")?"months":"payment",
          dueDay: get("dueday"),
          statementDay: get("statementday"),
          expiration: get("expiration"),
          originalBalance: get("originalbalance"),
          color: get("color")||"#6366f1",
        };
      }).filter(c=>c.name);
      if(!cleaned.length) throw new Error("No valid card rows found");
      setImportPreview({type:"csv",cards:cleaned,profile:null,exportedAt:null});
    }catch(e){ setImportError(`Could not parse file: ${e.message}`); }
  }

  function handleFile(e){
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{ const text=ev.target.result; setImportText(text); parseImport(text); };
    reader.readAsText(file);
  }

  function handleTextChange(e){ setImportText(e.target.value); if(e.target.value.trim()) parseImport(e.target.value); else{ setImportPreview(null); setImportError(""); } }

  function confirmImport(mode){
    if(!importPreview) return;
    onImport(importPreview.cards, mode);
    setImportSuccess(true); setImportPreview(null); setImportText("");
  }

  const tS=(active)=>({background:active?"#6366f1":t.surf,color:active?"#fff":t.tx2,border:`1px solid ${active?"#6366f1":t.border}`,borderRadius:8,padding:"7px 20px",cursor:"pointer",fontWeight:600,fontSize:13,transition:"all .15s"});

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      <div style={{background:t.panelBg,borderRadius:20,width:"100%",maxWidth:520,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{margin:0,color:t.tx1,fontSize:17,fontWeight:800}}>📦 Backup & Restore</h2>
          <button onClick={onClose} style={{background:t.surf,border:"none",borderRadius:8,padding:"5px 11px",color:t.tx1,cursor:"pointer"}}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          <button onClick={()=>setTab("export")} style={tS(tab==="export")}>⬇ Export</button>
          <button onClick={()=>{setTab("import");setImportSuccess(false);}} style={tS(tab==="import")}>⬆ Import</button>
        </div>

        {/* ── EXPORT TAB ── */}
        {tab==="export"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 14px",fontSize:12,color:t.tx2,lineHeight:1.6}}>
              Exporting <strong style={{color:t.tx1}}>{cards.length} card{cards.length!==1?"s":""}</strong> for profile <strong style={{color:t.tx1}}>{profile.name}</strong>. Save the file somewhere safe — Google Drive, iCloud, email to yourself, or a USB drive.
            </div>

            {/* JSON */}
            <div style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:12,padding:"16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:t.tx1}}>📄 Full Backup (JSON)</div>
                  <div style={{fontSize:11,color:t.tx2,marginTop:3}}>Restores everything exactly — all fields, colors, settings.</div>
                  <div style={{fontSize:11,color:t.tx3,marginTop:2}}>Best for: disaster recovery, moving to a new device</div>
                </div>
                <button onClick={exportJSON} disabled={!cards.length} style={{background:"#6366f1",border:"none",borderRadius:9,padding:"8px 16px",color:"#fff",cursor:cards.length?"pointer":"default",fontWeight:700,fontSize:12,opacity:cards.length?1:.4,whiteSpace:"nowrap",marginLeft:12}}>Download JSON</button>
              </div>
            </div>

            {/* CSV */}
            <div style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:12,padding:"16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:t.tx1}}>📊 Spreadsheet (CSV)</div>
                  <div style={{fontSize:11,color:t.tx2,marginTop:3}}>Opens in Excel, Google Sheets, Numbers. Edit your cards then import back.</div>
                  <div style={{fontSize:11,color:t.tx3,marginTop:2}}>Best for: bulk editing, sharing a readable summary</div>
                </div>
                <button onClick={exportCSV} disabled={!cards.length} style={{background:"#10b981",border:"none",borderRadius:9,padding:"8px 16px",color:"#fff",cursor:cards.length?"pointer":"default",fontWeight:700,fontSize:12,opacity:cards.length?1:.4,whiteSpace:"nowrap",marginLeft:12}}>Download CSV</button>
              </div>
            </div>

            {!cards.length&&<div style={{textAlign:"center",color:t.tx3,fontSize:12,padding:"8px 0"}}>Add cards first before exporting.</div>}

            <div style={{background:"#6366f118",border:"1px solid #6366f133",borderRadius:10,padding:"10px 14px",fontSize:11,color:t.tx2,lineHeight:1.6}}>
              💡 <strong style={{color:t.tx1}}>Tip:</strong> Export after adding or updating cards. Keep the JSON file as your master backup and use CSV when you want to edit in a spreadsheet.
            </div>
          </div>
        )}

        {/* ── IMPORT TAB ── */}
        {tab==="import"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {importSuccess?(
              <div style={{textAlign:"center",padding:"30px 20px"}}>
                <div style={{fontSize:48,marginBottom:12}}>✅</div>
                <div style={{fontWeight:800,fontSize:16,color:t.tx1,marginBottom:6}}>Cards Imported!</div>
                <div style={{fontSize:13,color:t.tx2,marginBottom:20}}>Your cards have been loaded successfully.</div>
                <button onClick={onClose} style={{background:"#6366f1",border:"none",borderRadius:10,padding:"10px 28px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>Done</button>
              </div>
            ):(
              <>
                {/* File picker */}
                <div>
                  <input ref={fileRef} type="file" accept=".json,.csv" onChange={handleFile} style={{display:"none"}}/>
                  <button onClick={()=>fileRef.current?.click()} style={{width:"100%",background:t.surf,border:`2px dashed ${t.border}`,borderRadius:12,padding:"18px",color:t.tx2,cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                    <span style={{fontSize:28}}>📂</span>
                    <span>Click to choose a file</span>
                    <span style={{fontSize:11,color:t.tx3}}>Supports .json and .csv</span>
                  </button>
                </div>

                <div style={{display:"flex",alignItems:"center",gap:10,color:t.tx3,fontSize:11}}>
                  <div style={{flex:1,height:1,background:t.border}}/>or paste your backup data below<div style={{flex:1,height:1,background:t.border}}/>
                </div>

                <textarea
                  value={importText}
                  onChange={handleTextChange}
                  placeholder={"Paste JSON or CSV content here…"}
                  style={{width:"100%",height:100,background:t.surf,border:`1px solid ${importError?"#ef4444":t.border}`,borderRadius:10,padding:"10px 12px",color:t.tx1,fontSize:12,fontFamily:"monospace",resize:"vertical",boxSizing:"border-box"}}
                />

                {importError&&<div style={{background:"#ef444418",border:"1px solid #ef444433",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#ef4444"}}>⚠ {importError}</div>}

                {/* Preview */}
                {importPreview&&(
                  <div style={{background:t.surf,border:`1px solid #10b98144`,borderRadius:12,padding:"14px 16px"}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#10b981",marginBottom:10}}>
                      ✓ Ready to import — {importPreview.cards.length} card{importPreview.cards.length!==1?"s":""} found ({importPreview.type.toUpperCase()})
                    </div>
                    {importPreview.exportedAt&&<div style={{fontSize:11,color:t.tx3,marginBottom:10}}>Backup from {new Date(importPreview.exportedAt).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>}
                    <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:14,maxHeight:150,overflowY:"auto"}}>
                      {importPreview.cards.map((c,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                          <div style={{width:10,height:10,borderRadius:"50%",background:c.color||"#6366f1",flexShrink:0}}/>
                          <span style={{color:t.tx1,fontWeight:600}}>{c.name||"Unnamed"}</span>
                          {c.balance&&<span style={{color:t.tx3}}>{fmt$(parseFloat(c.balance)||0)}</span>}
                          {c.apr&&<span style={{color:t.tx3}}>{c.apr}% APR</span>}
                        </div>
                      ))}
                    </div>
                    <div style={{fontSize:11,color:t.tx2,marginBottom:10}}>How would you like to import?</div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>confirmImport("replace")} style={{flex:1,background:"#ef4444",border:"none",borderRadius:9,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:12}}>Replace All Cards</button>
                      <button onClick={()=>confirmImport("merge")} style={{flex:1,background:"#6366f1",border:"none",borderRadius:9,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:12}}>Merge with Existing</button>
                    </div>
                    <div style={{fontSize:10,color:t.tx3,marginTop:6,textAlign:"center"}}>Replace removes current cards first. Merge adds imported cards alongside existing ones.</div>
                  </div>
                )}

                <div style={{background:"#f59e0b18",border:"1px solid #f59e0b33",borderRadius:10,padding:"10px 14px",fontSize:11,color:t.tx2,lineHeight:1.6}}>
                  💡 <strong style={{color:t.tx1}}>Tip:</strong> Use <strong style={{color:t.tx1}}>Merge</strong> to add cards from a CSV you edited in Excel without losing your existing data.
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────
function DeleteConfirm({cardName,onConfirm,onCancel,darkMode}){
  const t=useTheme(darkMode);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:t.panelBg,borderRadius:16,padding:24,maxWidth:340,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
        <div style={{fontSize:36,textAlign:"center",marginBottom:12}}>🗑️</div>
        <div style={{fontWeight:800,fontSize:16,color:t.tx1,textAlign:"center",marginBottom:6}}>Delete Card?</div>
        <div style={{fontSize:13,color:t.tx2,textAlign:"center",marginBottom:20}}>This will permanently remove <strong style={{color:t.tx1}}>{cardName}</strong> from your tracker.</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onCancel} style={{flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13}}>Cancel</button>
          <button onClick={onConfirm} style={{flex:1,background:"#ef4444",border:"none",borderRadius:10,padding:"10px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13}}>Delete</button>
        </div>
      </div>
    </div>
  );
}


function PrintTable({sched,ordered,title}){
  return(
    <div>
      <h2 style={{margin:"24px 0 6px",color:"#1e293b",fontSize:16}}>{title}</h2>
      <p style={{color:"#64748b",margin:"0 0 10px",fontSize:12}}>{sched.totalMonths} months · Interest: {fmt$(sched.totalInterest)} · Total: {fmt$(sched.totalPaid)}</p>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:10,marginBottom:32}}>
        <thead><tr style={{background:"#f1f5f9"}}>
          <th style={{padding:"5px 6px",textAlign:"left",borderBottom:"1px solid #e2e8f0"}}>Mo</th>
          <th style={{padding:"5px 6px",textAlign:"left",borderBottom:"1px solid #e2e8f0"}}>Date</th>
          {ordered.map(c=><th key={c.id} style={{padding:"5px 6px",textAlign:"right",borderBottom:"1px solid #e2e8f0"}}>{c.name}</th>)}
          <th style={{padding:"5px 6px",textAlign:"right",borderBottom:"1px solid #e2e8f0"}}>Paid</th>
          <th style={{padding:"5px 6px",textAlign:"right",borderBottom:"1px solid #e2e8f0"}}>Interest</th>
        </tr></thead>
        <tbody>
          {sched.months.map((row,idx)=>{
            const isPay=sched.cardPayoffs.some(p=>p.month===row.month);
            const tP=Object.values(row.payments).reduce((s,v)=>s+v,0);
            const tI=Object.values(row.interest).reduce((s,v)=>s+v,0);
            return(
              <tr key={row.month} style={{background:isPay?"#e8fdf5":idx%2===0?"#fff":"#f9fafb"}}>
                <td style={{padding:"4px 6px",fontFamily:"monospace"}}>{row.month}{isPay&&<span style={{marginLeft:4,background:"#10b981",color:"#fff",borderRadius:3,padding:"0 3px",fontSize:8}}>✓</span>}</td>
                <td style={{padding:"4px 6px",color:"#64748b"}}>{fmtMo(addMo(new Date(),row.month))}</td>
                {ordered.map(c=><td key={c.id} style={{padding:"4px 6px",textAlign:"right",fontFamily:"monospace"}}><div style={{fontSize:9}}>{(row.balances[c.id]??0)<0.01&&(row.payments[c.id]||0)>0?"✓ PAID":fmt$(row.balances[c.id]??0)}</div><div style={{fontSize:8,color:"#94a3b8"}}>{fmt$(row.payments[c.id]||0)}</div></td>)}
                <td style={{padding:"4px 6px",textAlign:"right",fontFamily:"monospace",fontWeight:600}}>{fmt$(tP)}</td>
                <td style={{padding:"4px 6px",textAlign:"right",fontFamily:"monospace",color:"#ea580c"}}>{fmt$(tI)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot><tr style={{background:"#f1f5f9",borderTop:"2px solid #e2e8f0"}}>
          <td colSpan={2} style={{padding:"5px 6px",fontWeight:700,fontSize:10}}>TOTALS</td>
          {ordered.map(c=><td key={c.id} style={{padding:"5px 6px",textAlign:"right",fontFamily:"monospace",fontWeight:700,fontSize:9}}>{fmt$(sched.months.reduce((s,r)=>s+(r.payments[c.id]||0),0))}</td>)}
          <td style={{padding:"5px 6px",textAlign:"right",fontFamily:"monospace",fontWeight:700}}>{fmt$(sched.totalPaid)}</td>
          <td style={{padding:"5px 6px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#ea580c"}}>{fmt$(sched.totalInterest)}</td>
        </tr></tfoot>
      </table>
    </div>
  );
}

// ─── Print Overlay ────────────────────────────────────────────────────────────
function PrintOverlay({avalanche,snowball,onClose}){
  const avO=avalanche.cardPayoffs.map(p=>avalanche.cards.find(c=>c.id===p.id)).filter(Boolean);
  const snO=snowball.cardPayoffs.map(p=>snowball.cards.find(c=>c.id===p.id)).filter(Boolean);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:3000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:20,overflowY:"auto"}}>
      <style>{`@media print{.print-hide{display:none!important}.print-page{box-shadow:none!important;margin:0!important;max-width:100%!important;border-radius:0!important}}`}</style>
      <div className="print-page" style={{background:"#fff",borderRadius:12,width:"100%",maxWidth:900,padding:"28px 32px",boxShadow:"0 8px 40px rgba(0,0,0,.4)"}}>
        <div className="print-hide" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,paddingBottom:16,borderBottom:"1px solid #e2e8f0"}}>
          <div><div style={{fontWeight:800,fontSize:16,color:"#0f172a"}}>CardTracker — Payoff Schedule</div><div style={{fontSize:12,color:"#64748b",marginTop:2}}>Generated {new Date().toLocaleDateString()}</div></div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>window.print()} style={{background:"#6366f1",border:"none",borderRadius:8,padding:"8px 18px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13}}>🖨 Print / Save as PDF</button>
            <button onClick={onClose} style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 14px",color:"#475569",cursor:"pointer",fontWeight:600,fontSize:13}}>✕ Close</button>
          </div>
        </div>
        <PrintTable sched={avalanche} ordered={avO} title="🔥 Avalanche Payoff Schedule"/>
        <PrintTable sched={snowball} ordered={snO} title="❄️ Snowball Payoff Schedule"/>
      </div>
    </div>
  );
}

// ─── API Key Modal ────────────────────────────────────────────────────────────
function ApiKeyModal({currentKey, onSave, onClose, darkMode}){
  const [key,setKey]=useState(currentKey||"");
  const [show,setShow]=useState(false);
  const t=useTheme(darkMode);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:t.panelBg,borderRadius:20,width:"100%",maxWidth:480,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div>
            <div style={{fontWeight:800,fontSize:16,color:t.tx1}}>🔑 Anthropic API Key</div>
            <div style={{fontSize:12,color:t.tx2,marginTop:3}}>Enables AI features for all family members on any device</div>
          </div>
          <button onClick={onClose} style={{background:t.surf,border:"none",borderRadius:8,padding:"5px 11px",color:t.tx1,cursor:"pointer"}}>✕</button>
        </div>

        <div style={{background:"#6366f118",border:"1px solid #6366f133",borderRadius:12,padding:"12px 14px",marginBottom:18}}>
          <div style={{fontSize:12,color:"#6366f1",fontWeight:700,marginBottom:6}}>ℹ️ How it works</div>
          <div style={{fontSize:12,color:t.tx2,lineHeight:1.6}}>
            Your API key is stored in shared cloud storage tied to this artifact URL. Anyone you share the link with will automatically have AI features enabled — no setup required on their end.
          </div>
          <div style={{fontSize:11,color:t.tx3,marginTop:8}}>Get your key at <span style={{color:"#6366f1"}}>console.anthropic.com</span> → API Keys. Your account usage applies.</div>
        </div>

        <div style={{marginBottom:16}}>
          <label style={{fontSize:11,color:t.tx2,fontWeight:600,display:"block",marginBottom:6}}>API Key</label>
          <div style={{display:"flex",gap:8}}>
            <input
              type={show?"text":"password"}
              value={key} onChange={e=>setKey(e.target.value)}
              placeholder="sk-ant-api03-..."
              style={{flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 12px",color:t.tx1,fontSize:13,fontFamily:"monospace"}}
            />
            <button onClick={()=>setShow(s=>!s)} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 12px",color:t.tx2,cursor:"pointer",fontSize:12}}>{show?"🙈":"👁"}</button>
          </div>
        </div>

        {currentKey && (
          <div style={{background:"#10b98118",border:"1px solid #10b98133",borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:12,color:"#10b981"}}>
            ✓ API key is currently set — AI features are active for all users
          </div>
        )}

        <div style={{display:"flex",gap:8}}>
          {currentKey && <button onClick={()=>onSave("")} style={{flex:1,background:"#ef444418",border:"1px solid #ef444433",borderRadius:10,padding:"9px 0",color:"#ef4444",cursor:"pointer",fontWeight:600,fontSize:13}}>Remove Key</button>}
          <button onClick={onClose} style={{flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600}}>Cancel</button>
          <button onClick={()=>{if(key.trim()||key==="") onSave(key.trim()); onClose();}} style={{flex:2,background:"#6366f1",border:"none",borderRadius:10,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>Save Key</button>
        </div>
      </div>
    </div>
  );
}

// ─── Progress Tab ─────────────────────────────────────────────────────────────
function ProgressTab({cards,schedule,logsKey,darkMode}){
  const t=useTheme(darkMode);
  const [logs,setLogs]=useState([]);
  const [logForm,setLogForm]=useState({cardId:"",month:"",amount:"",date:new Date().toISOString().slice(0,10)});

  useEffect(()=>{ storeGet(logsKey,true).then(v=>{ if(v) setLogs(v); }); },[logsKey]);
  useEffect(()=>{ storeSet(logsKey,logs,true); },[logs,logsKey]);

  const milestones=[];
  cards.forEach(c=>{
    const bal=parseFloat(c.balance)||0, orig=parseFloat(c.originalBalance)||bal;
    const pct=orig>0?(Math.max(0,orig-bal)/orig)*100:0;
    if(pct>=75&&pct<100) milestones.push({msg:`${c.name} is 75%+ paid off! 🎉`,color:"#10b981"});
    else if(pct>=50&&pct<75) milestones.push({msg:`${c.name} is over halfway paid off! 💪`,color:"#6366f1"});
    else if(pct>=25&&pct<50) milestones.push({msg:`${c.name} is 25%+ paid off — great start!`,color:"#f59e0b"});
  });
  schedule?.cardPayoffs?.forEach(po=>{
    const remaining=(schedule.months||[]).filter(r=>r.balances[po.id]>0.01).length;
    if(remaining<=1) milestones.push({msg:`${po.name} payoff date is almost here! 🏁`,color:po.color});
  });

  function addLog(){
    if(!logForm.cardId||!logForm.amount) return;
    const card=cards.find(c=>c.id===logForm.cardId);
    const planned=schedule?.cards?.find(c=>c.id===logForm.cardId)?.userMonthly||0;
    setLogs(l=>[...l,{id:generateId(),cardId:logForm.cardId,cardName:card?.name||"",cardColor:card?.color||"#6366f1",month:parseInt(logForm.month)||1,amount:parseFloat(logForm.amount)||0,planned,date:logForm.date}]);
    setLogForm(f=>({...f,amount:"",month:""}));
  }
  const grouped={};
  logs.forEach(l=>{ if(!grouped[l.cardId]) grouped[l.cardId]=[]; grouped[l.cardId].push(l); });
  const iS={background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 10px",color:t.tx1,fontSize:12,boxSizing:"border-box"};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {milestones.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          <div style={{fontSize:10,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8,marginBottom:2}}>🏆 Milestones</div>
          {milestones.map((m,i)=><div key={i} style={{background:m.color+"18",border:`1px solid ${m.color}33`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}><div style={{width:10,height:10,borderRadius:"50%",background:m.color,flexShrink:0}}/><span style={{fontSize:13,fontWeight:600,color:m.color}}>{m.msg}</span></div>)}
        </div>
      )}
      <div style={{background:t.surf,borderRadius:14,padding:"14px 16px"}}>
        <div style={{fontSize:11,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>📝 Log Actual Payment</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr auto",gap:8,alignItems:"end"}}>
          <div><div style={{fontSize:10,color:t.tx2,marginBottom:3}}>Card</div><select value={logForm.cardId} onChange={e=>setLogForm(f=>({...f,cardId:e.target.value}))} style={{...iS,width:"100%"}}><option value="">Select...</option>{cards.filter(c=>parseFloat(c.balance)>0).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><div style={{fontSize:10,color:t.tx2,marginBottom:3}}>Month #</div><input type="number" value={logForm.month} onChange={e=>setLogForm(f=>({...f,month:e.target.value}))} style={iS} placeholder="1"/></div>
          <div><div style={{fontSize:10,color:t.tx2,marginBottom:3}}>Amount Paid</div><input type="number" value={logForm.amount} onChange={e=>setLogForm(f=>({...f,amount:e.target.value}))} style={iS} placeholder="$0.00"/></div>
          <div><div style={{fontSize:10,color:t.tx2,marginBottom:3}}>Date</div><input type="date" value={logForm.date} onChange={e=>setLogForm(f=>({...f,date:e.target.value}))} style={iS}/></div>
          <button onClick={addLog} style={{background:"#10b981",border:"none",borderRadius:8,padding:"7px 14px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>+ Log</button>
        </div>
      </div>
      {Object.keys(grouped).length>0 ? Object.entries(grouped).map(([cardId,cardLogs])=>{
        const card=cards.find(c=>c.id===cardId);
        const totalA=cardLogs.reduce((s,l)=>s+l.amount,0), totalP=cardLogs.reduce((s,l)=>s+l.planned,0), diff=totalA-totalP;
        return(
          <div key={cardId} style={{border:`1px solid ${t.border}`,borderRadius:14,overflow:"hidden"}}>
            <div style={{background:card?.color||"#6366f1",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:800,fontSize:13,color:"#fff"}}>{card?.name||"Unknown"}</span>
              <div style={{display:"flex",gap:16}}>
                {[{l:"ACTUAL",v:fmt$(totalA),c:"#fff"},{l:"PLANNED",v:fmt$(totalP),c:"rgba(255,255,255,.8)"},{l:"DIFF",v:(diff>=0?"+":"")+fmt$(diff),c:diff>=0?"#a7f3d0":"#fca5a5"}].map(x=><div key={x.l} style={{textAlign:"right"}}><div style={{fontSize:9,color:"rgba(255,255,255,.6)"}}>{x.l}</div><div style={{fontSize:13,fontWeight:700,color:x.c}}>{x.v}</div></div>)}
              </div>
            </div>
            <div style={{padding:"8px 14px",display:"flex",flexDirection:"column",gap:4}}>
              {[...cardLogs].sort((a,b)=>a.month-b.month).map(log=>{
                const v=log.amount-log.planned;
                return(
                  <div key={log.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 8px",background:t.surf,borderRadius:8}}>
                    <div style={{fontSize:11,color:t.tx3,fontFamily:"monospace",minWidth:24}}>Mo {log.month}</div>
                    <div style={{fontSize:11,color:t.tx3,minWidth:80}}>{log.date}</div>
                    <div style={{fontSize:12,fontWeight:700,color:t.tx1,fontFamily:"monospace",flex:1}}>{fmt$(log.amount)}</div>
                    <div style={{fontSize:11,color:t.tx3}}>vs {fmt$(log.planned)} planned</div>
                    <div style={{fontSize:11,fontWeight:700,color:v>=0?"#10b981":"#ef4444",minWidth:60,textAlign:"right"}}>{v>=0?"+":""}{fmt$(v)}</div>
                    <button onClick={()=>setLogs(l=>l.filter(x=>x.id!==log.id))} style={{background:"none",border:"none",color:t.tx3,cursor:"pointer",fontSize:14,padding:"0 4px"}}>×</button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }) : (
        <div style={{textAlign:"center",padding:"32px 20px",color:t.tx3}}><div style={{fontSize:32,marginBottom:8}}>📋</div><div style={{fontSize:13}}>No payments logged yet.</div></div>
      )}
    </div>
  );
}

// ─── What-If AI Tab ───────────────────────────────────────────────────────────
function WhatIfTab({cards,avalanche,snowball,darkMode,apiKey}){
  const t=useTheme(darkMode);
  const [messages,setMessages]=useState([{role:"assistant",content:"Hi! I'm your debt payoff AI advisor. Ask me anything:\n\n• \"What if I paid an extra $200/month?\"\n• \"What if I got a $1,000 bonus?\"\n• \"Should I do a balance transfer?\"\n• \"What's the fastest way to pay off my debt?\""}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const scrollRef=useRef(null);
  useEffect(()=>{ if(scrollRef.current) scrollRef.current.scrollTop=scrollRef.current.scrollHeight; },[messages]);

  const cardSummary=cards.map(c=>{ const b=parseFloat(c.balance)||0,a=parseFloat(c.apr)||0,m=c.minPaymentMode==="auto"?calcMinPmt(b,a):(parseFloat(c.minPaymentFixed)||0); return `${c.name}: $${b.toFixed(2)}, ${a}% APR, $${(parseFloat(c.monthlyPayment)||m).toFixed(2)}/mo`; }).join("\n");

  async function send(){
    if(!input.trim()||loading) return;
    const userMsg={role:"user",content:input.trim()};
    setMessages(m=>[...m,userMsg]); setInput(""); setLoading(true);
    const sys=`Expert personal finance advisor. User cards:\n${cardSummary}\nAvalanche: ${avalanche.totalMonths}mo $${avalanche.totalInterest.toFixed(2)} interest. Snowball: ${snowball.totalMonths}mo $${snowball.totalInterest.toFixed(2)} interest.\nBe concise (<200 words), specific with numbers.`;
    try{
      const res=await callClaude(apiKey,{model:MODEL,max_tokens:1000,system:sys,messages:[...messages.filter((m,i)=>!(m.role==="assistant"&&i===0)).map(m=>({role:m.role,content:m.content})),{role:"user",content:input.trim()}]});
      const data=await res.json();
      const text=data.content?.[0]?.text||"Sorry, I couldn't generate a response.";
      setMessages(m=>[...m,{role:"assistant",content:text}]);
    }catch(e){ setMessages(m=>[...m,{role:"assistant",content:`Sorry, couldn't connect. ${!apiKey?"(No API key set — tap 🔑 in the top bar to add one.)":""}`}]); }
    finally{ setLoading(false); }
  }

  return(
    <div style={{display:"flex",flexDirection:"column",height:500}}>
      {!apiKey&&<div style={{background:"#f59e0b18",border:"1px solid #f59e0b33",borderRadius:10,padding:"8px 14px",marginBottom:10,fontSize:12,color:"#f59e0b"}}>⚠ No API key set. AI features require a key — tap 🔑 in the top bar to add yours.</div>}
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:12,padding:"4px 0 12px"}}>
        {messages.map((msg,i)=>(
          <div key={i} style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"80%",padding:"10px 14px",borderRadius:msg.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",background:msg.role==="user"?"#6366f1":t.surf,color:msg.role==="user"?"#fff":t.tx1,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8,paddingTop:12,borderTop:`1px solid ${t.border}`}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),send())} placeholder='Ask a what-if... e.g. "What if I paid $300 extra/month?"' style={{flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 14px",color:t.tx1,fontSize:13}}/>
        <button onClick={send} disabled={loading||!input.trim()} style={{background:loading?"#475569":"#6366f1",border:"none",borderRadius:10,padding:"9px 18px",color:"#fff",cursor:loading?"default":"pointer",fontWeight:700,fontSize:13}}>{loading?"…":"Send"}</button>
      </div>
    </div>
  );
}

// ─── Strategy Tab ─────────────────────────────────────────────────────────────
function StrategyTab({cards,avalanche,snowball,darkMode,apiKey,profileId,onApplyStrategy,initiallyShowQuestionnaire}){
  const t=useTheme(darkMode);
  const answersKey=`cc_strategy_answers_${profileId}`;
  const resultKey=`cc_ai_results_${profileId}`;
  const [answers,setAnswers]=useState({goal:"",stress:"",income:"",extra:"",timeline:""});
  const [analysis,setAnalysis]=useState("");
  const [strategyData,setStrategyData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [done,setDone]=useState(false);
  const [savedAt,setSavedAt]=useState(null);
  const [showQ,setShowQ]=useState(true);
  const [copied,setCopied]=useState(false);
  const scrollRef=useRef(null);

  // Load saved answers + result on mount
  useEffect(()=>{
    async function load(){
      const [savedAnswers,savedResult]=await Promise.all([
        storeGet(answersKey,true),
        storeGet(resultKey,true),
      ]);
      if(savedAnswers) setAnswers(savedAnswers);
      if(savedResult&&savedResult.analysis){
        setAnalysis(savedResult.analysis);
        if(savedResult.strategyData) setStrategyData(savedResult.strategyData);
        setSavedAt(savedResult.savedAt);
        setDone(true);
        setShowQ(initiallyShowQuestionnaire||false);
      } else {
        setShowQ(true);
      }
    }
    load();
  },[profileId]);

  const Qs=[
    {key:"goal",label:"What's your #1 financial goal?",opts:["Pay off all debt ASAP","Reduce monthly stress","Free up cash flow","Improve credit score","Save for something specific"]},
    {key:"stress",label:"How do you handle financial stress?",opts:["I need quick wins to stay motivated","I can play the long game for max savings","I want a balanced approach","I tend to give up without visible progress"]},
    {key:"income",label:"Is your income stable?",opts:["Very stable (salary)","Mostly stable","Variable (freelance/commission)","Currently fluctuating"]},
    {key:"extra",label:"Can you find extra monthly money?",opts:["Yes, $50-100","Yes, $100-300","Yes, $300+","Not right now","Maybe occasionally (windfalls only)"]},
    {key:"timeline",label:"When do you want to be debt-free?",opts:["As fast as possible","Within 2 years","Within 3-5 years","No specific timeline"]},
  ];

  async function generate(){
    if(Object.values(answers).some(v=>!v)) return;
    setLoading(true); setAnalysis(""); setStrategyData(null); setDone(false);
    await storeSet(answersKey,answers,true);
    const cs=cards.map(c=>{ const b=parseFloat(c.balance)||0,a=parseFloat(c.apr)||0,m=c.minPaymentMode==="auto"?calcMinPmt(b,a):(parseFloat(c.minPaymentFixed)||0); return `• ${c.name}: $${b.toFixed(2)}, ${a}% APR, $${(parseFloat(c.monthlyPayment)||m).toFixed(2)}/mo`; }).join("\n");
    const prompt=`You are a personalized financial advisor. The user has these credit cards:\n${cs}\nAvalanche method: ${avalanche.totalMonths} months, $${avalanche.totalInterest.toFixed(2)} total interest. Order: ${avalanche.cardPayoffs.map((p,i)=>`${i+1}. ${p.name}`).join(", ")}\nSnowball method: ${snowball.totalMonths} months, $${snowball.totalInterest.toFixed(2)} total interest. Order: ${snowball.cardPayoffs.map((p,i)=>`${i+1}. ${p.name}`).join(", ")}\nUser profile: goal="${answers.goal}", stress handling="${answers.stress}", income="${answers.income}", extra money="${answers.extra}", timeline="${answers.timeline}".\n\nProvide a thorough personalized plan covering: 1) Recommended method and why it fits this person specifically, 2) Custom payoff order with reasoning, 3) Monthly budget breakdown, 4) How to find and deploy extra money (remind them to enter extra amounts in the Extra Budget field on the Schedule tab!), 5) A 3-month action plan with specific steps, 6) Risk mitigation for their income situation, 7) Motivational close with their projected debt-free date. Use **bold** for key terms. Be specific with dollar amounts. ~500 words.\n\nAfter your analysis, output this exact block (no markdown around it):\n<strategy_data>\n{"method":"avalanche","extraBudget":0,"cardFocus":"","reasoning":""}\n</strategy_data>\n\nFill in: method = "avalanche" or "snowball" based on your recommendation. extraBudget = specific dollar amount you recommend adding monthly (0 if none). cardFocus = name of the card to attack first. reasoning = one sentence summary of your recommendation.`;
    try{
      const res=await callClaude(apiKey,{model:MODEL,max_tokens:1500,messages:[{role:"user",content:prompt}]});
      const data=await res.json();
      const raw=data.content?.[0]?.text||"Could not generate a response.";
      // Extract strategy_data JSON silently
      const jsonMatch=raw.match(/<strategy_data>\s*([\s\S]*?)\s*<\/strategy_data>/);
      let parsed=null;
      if(jsonMatch){
        try{ parsed=JSON.parse(jsonMatch[1]); }catch(e){ parsed=null; }
      }
      // Clean analysis — remove the strategy_data block from display
      const cleanAnalysis=raw.replace(/<strategy_data>[\s\S]*?<\/strategy_data>/,"").trim();
      setAnalysis(cleanAnalysis);
      setStrategyData(parsed);
      const now=new Date().toISOString();
      setSavedAt(now);
      setDone(true);
      setShowQ(false);
      // Auto-save silently
      await storeSet(resultKey,{analysis:cleanAnalysis,strategyData:parsed,savedAt:now,answers},true);
    }catch(e){
      setAnalysis(`Could not connect. ${!apiKey?"(No API key set — tap 🔑 in the top bar.)":""}`);
      setDone(true);
    }finally{ setLoading(false); }
  }

  function handleApply(){
    if(!strategyData||!onApplyStrategy) return;
    onApplyStrategy(strategyData);
  }

  async function copyToClipboard(){
    if(!analysis) return;
    const text=`CardTracker AI Strategy — ${savedAt?new Date(savedAt).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}):"Today"}\n\nYour Portfolio:\n${cards.map(c=>`• ${c.name}: ${fmt$(parseFloat(c.balance)||0)} @ ${c.apr}% APR`).join("\n")}\n\n${analysis}`;
    try{ await navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),2500); }catch(e){}
  }

  function downloadTxt(){
    if(!analysis) return;
    const text=`CardTracker AI Strategy\nGenerated: ${savedAt?new Date(savedAt).toLocaleString():"Today"}\n\nYour Portfolio:\n${cards.map(c=>`• ${c.name}: ${fmt$(parseFloat(c.balance)||0)} @ ${c.apr}% APR`).join("\n")}\n\nAnswers:\n${Object.entries(answers).map(([k,v])=>`${k}: ${v}`).join("\n")}\n\n${analysis}`;
    const blob=new Blob([text],{type:"text/plain"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=`cardtracker-strategy-${new Date().toISOString().slice(0,10)}.txt`; a.style.display="none";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),100);
  }

  const allAnswered=Object.values(answers).every(v=>v);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {!apiKey&&<div style={{background:"#f59e0b18",border:"1px solid #f59e0b33",borderRadius:10,padding:"8px 14px",fontSize:12,color:"#f59e0b"}}>⚠ No API key set. Tap 🔑 in the top bar to add yours.</div>}

      {/* Saved result banner */}
      {done&&savedAt&&!showQ&&(
        <div style={{background:"#10b98110",border:"1px solid #10b98133",borderRadius:10,padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
          <span style={{fontSize:12,color:"#10b981",fontWeight:600}}>✓ Strategy from {new Date(savedAt).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</span>
          <button onClick={()=>setShowQ(true)} style={{background:"none",border:"1px solid #10b98155",borderRadius:7,padding:"3px 10px",color:"#10b981",cursor:"pointer",fontSize:11,fontWeight:700}}>↺ Rerun Questionnaire</button>
        </div>
      )}

      {/* Questionnaire */}
      {showQ&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",borderRadius:14,padding:"14px 18px"}}>
            <div style={{fontWeight:800,fontSize:14,color:"#fff"}}>🎯 Personalized Strategy Builder</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:3}}>Answer 5 questions to get a custom debt elimination plan tailored to your goals and psychology</div>
          </div>
          {Qs.map(q=>(
            <div key={q.key} style={{background:t.surf,borderRadius:12,padding:"12px 14px"}}>
              <div style={{fontSize:12,fontWeight:700,color:t.tx1,marginBottom:8}}>{q.label}</div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {q.opts.map(opt=>(
                  <button key={opt} onClick={()=>setAnswers(a=>({...a,[q.key]:opt}))} style={{background:answers[q.key]===opt?"#6366f1":t.panelBg,border:`1px solid ${answers[q.key]===opt?"#6366f1":t.border}`,borderRadius:8,padding:"7px 12px",color:answers[q.key]===opt?"#fff":t.tx2,cursor:"pointer",textAlign:"left",fontSize:12,transition:"all .15s"}}>
                    {answers[q.key]===opt?"✓ ":""}{opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {done&&<button onClick={()=>setShowQ(false)} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"8px 0",color:t.tx2,cursor:"pointer",fontWeight:600,fontSize:13}}>← Back to Last Analysis</button>}
          <button onClick={generate} disabled={!allAnswered||loading} style={{background:allAnswered?"linear-gradient(135deg,#6366f1,#8b5cf6)":t.surf,border:"none",borderRadius:12,padding:"12px 0",color:allAnswered?"#fff":t.tx3,cursor:allAnswered?"pointer":"default",fontWeight:700,fontSize:14,transition:"all .2s"}}>
            {loading?"✨ Building your strategy…":"✨ Generate My Personalized Strategy"}
          </button>
        </div>
      )}

      {/* Loading spinner */}
      {loading&&(
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px",background:t.surf,borderRadius:12,color:t.tx2}}>
          <div style={{width:16,height:16,border:"2px solid #6366f1",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite",flexShrink:0}}/>
          <span style={{fontSize:13}}>Claude is analyzing your portfolio and building a personalized strategy…</span>
        </div>
      )}

      {/* Analysis result */}
      {done&&analysis&&!showQ&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div ref={scrollRef} style={{background:t.surf,borderRadius:14,padding:"16px 18px",maxHeight:420,overflowY:"auto"}}>
            <Markdown text={analysis} tx1={t.tx1} tx2={t.tx2}/>
          </div>

          {/* Action buttons */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {strategyData&&(
              <button onClick={handleApply} style={{flex:"1 1 160px",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:10,padding:"10px 16px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                ✅ Apply This Strategy
              </button>
            )}
            <button onClick={copyToClipboard} style={{flex:"1 1 120px",background:copied?"#10b981":t.surf,border:`1px solid ${copied?"#10b981":t.border}`,borderRadius:10,padding:"10px 14px",color:copied?"#fff":t.tx2,cursor:"pointer",fontWeight:600,fontSize:12,transition:"all .2s"}}>
              {copied?"✓ Copied!":"📋 Copy"}
            </button>
            <button onClick={downloadTxt} style={{flex:"1 1 120px",background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 14px",color:t.tx2,cursor:"pointer",fontWeight:600,fontSize:12}}>
              ⬇ Download .txt
            </button>
          </div>

          {/* Applied confirmation */}
          {strategyData&&(
            <div style={{background:"#6366f110",border:"1px solid #6366f133",borderRadius:10,padding:"10px 14px",fontSize:12,color:t.tx2,lineHeight:1.6}}>
              💡 <strong style={{color:t.tx1}}>Apply This Strategy</strong> will set the planner to <strong style={{color:"#6366f1"}}>{strategyData.method==="avalanche"?"🔥 Avalanche":"❄️ Snowball"}</strong> method{strategyData.cardFocus?` and focus on ${strategyData.cardFocus} first`:""}.{strategyData.extraBudget>0?` It also recommends adding ${fmt$(strategyData.extraBudget)}/mo in extra budget — you can adjust that in the Extra Budget field above.`:" "}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Payoff Schedule Modal ────────────────────────────────────────────────────
function PayoffScheduleModal({cards,logsKey,darkMode,apiKey,profileId,onClose}){
  const t=useTheme(darkMode);
  const {isMobile}=useBreakpoint();
  const [method,setMethod]=useState("avalanche");
  const [activeTab,setActiveTab]=useState("loading"); // resolved after checking storage
  const [showFull,setShowFull]=useState(false);
  const [showPrint,setShowPrint]=useState(false);
  const [extraBudget,setExtraBudget]=useState(0);
  const [dynamicMins,setDynamicMins]=useState(false);
  const [lumpSums,setLumpSums]=useState([]);
  const [lumpForm,setLumpForm]=useState({month:"",amount:""});
  const [aiText,setAiText]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [aiGenerated,setAiGenerated]=useState(false);
  const [aiSavedAt,setAiSavedAt]=useState(null);
  const [aiCopied,setAiCopied]=useState(false);
  const [appliedStrategy,setAppliedStrategy]=useState(null);
  const aiRef=useRef(null);

  const resultKey=`cc_ai_results_${profileId}`;

  // Determine initial tab — first-time users go to strategy, returning go to schedule
  useEffect(()=>{
    storeGet(resultKey,true).then(saved=>{
      setActiveTab(saved?.analysis ? "schedule" : "strategy");
    });
  },[profileId]);

  const validCards=cards.filter(c=>(parseFloat(c.balance)||0)>0);
  const opts={extraBudget,lumpSums,dynamicMins};
  const avalanche=computeSchedule(validCards,"avalanche",opts);
  const snowball=computeSchedule(validCards,"snowball",opts);
  const schedule=method==="avalanche"?avalanche:snowball;
  const orderedCards=schedule.cardPayoffs.map(p=>schedule.cards?.find(c=>c.id===p.id)).filter(Boolean);
  const tableRows=showFull?schedule.months:schedule.months.slice(0,12);
  const interestSaved=Math.abs(avalanche.totalInterest-snowball.totalInterest);
  const fasterMethod=avalanche.totalMonths<=snowball.totalMonths?"avalanche":"snowball";

  function addLump(){ if(!lumpForm.month||!lumpForm.amount) return; setLumpSums(l=>[...l,{id:generateId(),month:parseInt(lumpForm.month),amount:parseFloat(lumpForm.amount)}]); setLumpForm({month:"",amount:""}); }

  // Apply strategy from StrategyTab
  function applyStrategy(data){
    if(!data) return;
    setMethod(data.method||"avalanche");
    if(data.extraBudget>0) setExtraBudget(data.extraBudget);
    setAppliedStrategy(data);
    setActiveTab("schedule");
  }

  async function generateAI(){
    setAiLoading(true); setAiText(""); setAiGenerated(true);
    const cs=validCards.map(c=>{ const b=parseFloat(c.balance)||0,a=parseFloat(c.apr)||0,m=c.minPaymentMode==="auto"?calcMinPmt(b,a):(parseFloat(c.minPaymentFixed)||0); return `• ${c.name}${c.last4?` (****${c.last4})`:""}: $${b.toFixed(2)}, ${a}% APR, $${(parseFloat(c.monthlyPayment)||m).toFixed(2)}/mo`; }).join("\n");
    const prompt=`Expert personal finance advisor. Cards:\n${cs}${extraBudget>0?`\nExtra budget: $${extraBudget}/mo`:""}${dynamicMins?"\nDynamic minimums enabled":""}\nAvalanche: ${avalanche.totalMonths}mo, $${avalanche.totalInterest.toFixed(2)} interest, order: ${avalanche.cardPayoffs.map((p,i)=>`${i+1}. ${p.name} (Mo ${p.month})`).join(", ")}\nSnowball: ${snowball.totalMonths}mo, $${snowball.totalInterest.toFixed(2)} interest, order: ${snowball.cardPayoffs.map((p,i)=>`${i+1}. ${p.name} (Mo ${p.month})`).join(", ")}\nProvide: 1) Method recommendation + reasoning, 2) Avalanche analysis, 3) Snowball analysis, 4) Key insight unique to this portfolio, 5) 3 action steps for this month, 6) Motivational close. Use **bold**, be specific with numbers, ~400 words.`;
    try{
      const res=await callClaude(apiKey,{model:MODEL,max_tokens:1000,messages:[{role:"user",content:prompt}]});
      const data=await res.json();
      const text=data.content?.[0]?.text||"Could not generate a response.";
      setAiText(text);
      const now=new Date().toISOString();
      setAiSavedAt(now);
      // Auto-save — merge with any saved strategy result
      const existing=await storeGet(resultKey,true)||{};
      await storeSet(resultKey,{...existing,scheduleAnalysis:text,scheduleAnalysisSavedAt:now},true);
    }catch(e){ setAiText(`Could not connect. ${!apiKey?"(No API key set — tap 🔑 in the top bar.)":""}`); }
    finally{ setAiLoading(false); }
  }

  async function copyAI(){
    if(!aiText) return;
    try{ await navigator.clipboard.writeText(aiText); setAiCopied(true); setTimeout(()=>setAiCopied(false),2500); }catch(e){}
  }
  function downloadAI(){
    if(!aiText) return;
    const text=`CardTracker AI Schedule Analysis\nGenerated: ${aiSavedAt?new Date(aiSavedAt).toLocaleString():"Today"}\nMethod: ${method}\n\nPortfolio:\n${validCards.map(c=>`• ${c.name}: ${fmt$(parseFloat(c.balance)||0)} @ ${c.apr}% APR`).join("\n")}\n\n${aiText}`;
    const blob=new Blob([text],{type:"text/plain"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`cardtracker-analysis-${new Date().toISOString().slice(0,10)}.txt`; a.style.display="none";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),100);
  }

  const iSm={background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.25)",borderRadius:7,padding:"6px 10px",color:"#fff",fontSize:12};
  // NEW tab order: Strategy first
  const TABS=[
    {id:"strategy",icon:"🎯",label:"Strategy"},
    {id:"schedule",icon:"📅",label:"Schedule"},
    {id:"charts",icon:"📈",label:"Charts"},
    {id:"whatif",icon:"💬",label:"What-If AI"},
    {id:"progress",icon:"📊",label:"Progress"},
  ];

  if(activeTab==="loading") return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:32,height:32,border:"3px solid #6366f1",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:isMobile?8:16,overflowY:"auto"}}>
      <div style={{background:t.panelBg,borderRadius:20,width:"100%",maxWidth:960,boxShadow:"0 24px 80px rgba(0,0,0,.6)",marginBottom:20}}>

        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81,#4c1d95)",padding:isMobile?"14px 16px":"20px 24px",borderRadius:"20px 20px 0 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
            <div>
              <div style={{fontSize:isMobile?16:20,fontWeight:900,color:"#fff"}}>📊 Payoff Strategy Planner</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:2}}>{validCards.length} card{validCards.length!==1?"s":""} · AI-powered</div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {!isMobile&&<button onClick={()=>setShowPrint(true)} style={{background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.2)",borderRadius:8,padding:"6px 12px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600}}>🖨 Print</button>}
              {!isMobile&&<button onClick={()=>exportCSV(schedule,method)} style={{background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.2)",borderRadius:8,padding:"6px 12px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600}}>⬇ CSV</button>}
              <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:10,padding:"7px 14px",color:"#fff",cursor:"pointer",fontWeight:700}}>✕</button>
            </div>
          </div>
          {/* Method toggles */}
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {[{id:"avalanche",icon:"🔥",label:"Avalanche",sub:"Highest APR First"},{id:"snowball",icon:"❄️",label:"Snowball",sub:"Lowest Balance First"}].map(m=>(
              <button key={m.id} onClick={()=>setMethod(m.id)} style={{flex:1,background:method===m.id?"rgba(255,255,255,.2)":"rgba(255,255,255,.06)",border:`2px solid ${method===m.id?"rgba(255,255,255,.5)":"rgba(255,255,255,.12)"}`,borderRadius:12,padding:isMobile?"8px 10px":"10px 16px",color:"#fff",cursor:"pointer",textAlign:"left",transition:"all .2s"}}>
                <div style={{fontWeight:800,fontSize:isMobile?12:13}}>{m.icon} {m.label}</div>
                {!isMobile&&<div style={{fontSize:10,color:"rgba(255,255,255,.6)",marginTop:2}}>{m.sub}</div>}
              </button>
            ))}
          </div>
          {/* Applied strategy badge */}
          {appliedStrategy&&(
            <div style={{background:"rgba(99,102,241,.3)",border:"1px solid rgba(99,102,241,.5)",borderRadius:8,padding:"6px 12px",marginBottom:10,fontSize:11,color:"#fff",display:"flex",alignItems:"center",gap:6}}>
              ✅ <strong>AI Strategy Applied:</strong> {appliedStrategy.method==="avalanche"?"🔥 Avalanche":"❄️ Snowball"}{appliedStrategy.cardFocus?` · Focus: ${appliedStrategy.cardFocus}`:""}
              {appliedStrategy.extraBudget>0&&` · +${fmt$(appliedStrategy.extraBudget)}/mo extra`}
            </div>
          )}
          {/* Extra budget + lump sums */}
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>Extra/mo:</span>
              <input type="number" value={extraBudget||""} onChange={e=>setExtraBudget(parseFloat(e.target.value)||0)} placeholder="$0" style={{...iSm,width:80}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>Lump sum at month:</span>
              <input type="number" value={lumpForm.month} onChange={e=>setLumpForm(f=>({...f,month:e.target.value}))} placeholder="Mo" style={{...iSm,width:50}}/>
              <input type="number" value={lumpForm.amount} onChange={e=>setLumpForm(f=>({...f,amount:e.target.value}))} placeholder="$" style={{...iSm,width:70}}/>
              <button onClick={addLump} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:6,padding:"5px 10px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>+ Add</button>
              {lumpSums.map(ls=><span key={ls.id} style={{background:"rgba(255,255,255,.15)",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#fff",display:"flex",alignItems:"center",gap:4}}>Mo{ls.month}: {fmt$(ls.amount)}<button onClick={()=>setLumpSums(l=>l.filter(x=>x.id!==ls.id))} style={{background:"none",border:"none",color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:12,padding:0,lineHeight:1}}>×</button></span>)}
            </div>
            <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
              <input type="checkbox" checked={dynamicMins} onChange={e=>setDynamicMins(e.target.checked)} style={{accentColor:"#6366f1"}}/>
              <span style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>Recalculate minimums monthly</span>
            </label>
          </div>
        </div>

        {/* Tabs */}
        <div style={{borderBottom:`1px solid ${t.border}`,padding:"0 16px",display:"flex",gap:2,overflowX:"auto"}}>
          {TABS.map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{background:"none",border:"none",borderBottom:`2px solid ${activeTab===tab.id?"#6366f1":"transparent"}`,padding:isMobile?"8px 10px":"10px 14px",color:activeTab===tab.id?"#6366f1":t.tx2,cursor:"pointer",fontWeight:activeTab===tab.id?700:500,fontSize:isMobile?11:12,display:"flex",alignItems:"center",gap:4,transition:"all .15s",marginBottom:-1,whiteSpace:"nowrap"}}>
              <span>{tab.icon}</span>{!isMobile&&tab.label}
            </button>
          ))}
        </div>

        <div style={{padding:isMobile?14:24,display:"flex",flexDirection:"column",gap:20}}>
          {!validCards.length&&<div style={{textAlign:"center",padding:"40px 20px",color:t.tx2}}><div style={{fontSize:36,marginBottom:10}}>🃏</div><div style={{fontWeight:700,color:t.tx1}}>No cards with balances</div></div>}

          {/* ── Strategy Tab (first) ── */}
          {activeTab==="strategy"&&(
            <StrategyTab
              cards={validCards}
              avalanche={avalanche}
              snowball={snowball}
              darkMode={darkMode}
              apiKey={apiKey}
              profileId={profileId}
              onApplyStrategy={applyStrategy}
              initiallyShowQuestionnaire={false}
            />
          )}

          {/* ── Schedule Tab ── */}
          {validCards.length>0&&activeTab==="schedule"&&(<>
            {/* Apply Strategy button on Schedule tab */}
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <button onClick={()=>setActiveTab("strategy")} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:10,padding:"8px 16px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:6}}>
                🎯 {appliedStrategy?"Change Strategy":"Apply AI Strategy"}
              </button>
            </div>
            {/* Comparison cards */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[{id:"avalanche",icon:"🔥",s:avalanche,ac:"#f97316"},{id:"snowball",icon:"❄️",s:snowball,ac:"#3b82f6"}].map(m=>{
                const isA=method===m.id;
                return(<div key={m.id} style={{background:isA?m.ac+"18":t.surf,border:`2px solid ${isA?m.ac:t.border}`,borderRadius:14,padding:"14px 16px",transition:"all .2s"}}>
                  <div style={{fontWeight:800,fontSize:14,color:isA?m.ac:t.tx2,marginBottom:10}}>{m.icon} {m.id.charAt(0).toUpperCase()+m.id.slice(1)}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div><div style={{fontSize:9,color:t.tx3,textTransform:"uppercase"}}>Payoff Time</div><div style={{fontSize:18,fontWeight:800,color:t.tx1,fontFamily:"monospace"}}>{m.s.totalMonths} mo</div></div>
                    <div><div style={{fontSize:9,color:t.tx3,textTransform:"uppercase"}}>Total Interest</div><div style={{fontSize:14,fontWeight:700,color:"#f97316",fontFamily:"monospace"}}>{fmt$(m.s.totalInterest)}</div></div>
                    <div><div style={{fontSize:9,color:t.tx3,textTransform:"uppercase"}}>Total Paid</div><div style={{fontSize:13,fontWeight:700,color:t.tx1,fontFamily:"monospace"}}>{fmt$(m.s.totalPaid)}</div></div>
                    <div><div style={{fontSize:9,color:t.tx3,textTransform:"uppercase"}}>Debt Free</div><div style={{fontSize:12,fontWeight:700,color:"#10b981"}}>{fmtMo(addMo(new Date(),m.s.totalMonths))}</div></div>
                  </div>
                </div>);
              })}
            </div>
            {/* Stats row */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:10}}>
              {[{l:"Interest Saved (Avalanche)",v:fmt$(interestSaved),c:"#10b981"},{l:`${fasterMethod==="avalanche"?"🔥 Avalanche":"❄️ Snowball"} faster by`,v:`${Math.abs(avalanche.totalMonths-snowball.totalMonths)} months`,c:"#6366f1"},{l:"Monthly Budget",v:fmt$(schedule.totalBudget),c:t.tx2}].map(s=>(
                <div key={s.l} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 14px",textAlign:"center"}}><div style={{fontSize:9,color:s.c,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{s.l}</div><div style={{fontSize:16,fontWeight:800,color:t.tx1,fontFamily:"monospace"}}>{s.v}</div></div>
              ))}
            </div>
            {/* Payoff order */}
            <div>
              <div style={{fontSize:11,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>{method==="avalanche"?"🔥":"❄️"} Payoff Order</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {schedule.cardPayoffs.map((po,i)=>{
                  const card=validCards.find(c=>c.id===po.id);
                  return(<div key={po.id} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:po.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",flexShrink:0}}>{i+1}</div>
                    <div style={{width:3,height:36,borderRadius:2,background:po.color,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:13,color:t.tx1}}>{po.name}</div><div style={{fontSize:11,color:t.tx2,marginTop:1}}>{fmt$(parseFloat(card?.balance)||0)} · {parseFloat(card?.apr)||0}% APR</div></div>
                    <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:13,fontWeight:700,color:"#10b981"}}>Month {po.month}</div><div style={{fontSize:11,color:t.tx3}}>{fmtDate(po.date)}</div></div>
                    <div style={{fontSize:20}}>✓</div>
                  </div>);
                })}
              </div>
            </div>
            {/* Table */}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:6}}>
                <div style={{fontSize:11,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8}}>Month-by-Month Schedule</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>exportCSV(schedule,method)} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:7,padding:"4px 10px",fontSize:10,color:t.tx2,cursor:"pointer",fontWeight:600}}>⬇ CSV</button>
                  <button onClick={()=>setShowFull(f=>!f)} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:7,padding:"4px 10px",fontSize:10,color:t.tx2,cursor:"pointer",fontWeight:600}}>{showFull?`▲ Show Less`:`▼ All ${schedule.months.length} Months`}</button>
                </div>
              </div>
              <div style={{overflowX:"auto",borderRadius:12,border:`1px solid ${t.border}`}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{background:t.surf}}>
                    <th style={{padding:"9px 11px",textAlign:"left",color:t.tx2,fontWeight:600,fontSize:9,textTransform:"uppercase",whiteSpace:"nowrap"}}>Month</th>
                    <th style={{padding:"9px 11px",textAlign:"left",color:t.tx2,fontWeight:600,fontSize:9,textTransform:"uppercase",whiteSpace:"nowrap"}}>Date</th>
                    {orderedCards.map((c,i)=><th key={c.id} style={{padding:"9px 11px",textAlign:"right",whiteSpace:"nowrap"}}><div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end"}}><div style={{width:16,height:16,borderRadius:"50%",background:c.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,color:"#fff",flexShrink:0}}>{i+1}</div><span style={{color:t.tx2,fontWeight:600,fontSize:9,textTransform:"uppercase"}}>{c.name.slice(0,10)}</span></div></th>)}
                    <th style={{padding:"9px 11px",textAlign:"right",color:t.tx2,fontWeight:600,fontSize:9,textTransform:"uppercase",whiteSpace:"nowrap"}}>Paid</th>
                    <th style={{padding:"9px 11px",textAlign:"right",color:t.tx2,fontWeight:600,fontSize:9,textTransform:"uppercase",whiteSpace:"nowrap"}}>Interest</th>
                  </tr></thead>
                  <tbody>
                    {tableRows.map((row,idx)=>{
                      const payHere=schedule.cardPayoffs.filter(p=>p.month===row.month);
                      const isPay=payHere.length>0;
                      const hasLump=lumpSums.some(ls=>ls.month===row.month);
                      const tP=Object.values(row.payments).reduce((s,v)=>s+v,0);
                      const tI=Object.values(row.interest).reduce((s,v)=>s+v,0);
                      return(<tr key={row.month} style={{background:isPay?"#10b98110":hasLump?"#6366f108":idx%2===0?"transparent":t.surf+"66",borderBottom:`1px solid ${t.border}`}}>
                        <td style={{padding:"7px 11px",color:t.tx1,fontFamily:"monospace",fontWeight:isPay?700:400}}>{row.month}{isPay&&<span style={{marginLeft:5,fontSize:9,background:"#10b981",color:"#fff",borderRadius:4,padding:"1px 4px"}}>PAYOFF</span>}{hasLump&&<span style={{marginLeft:3,fontSize:9,background:"#6366f1",color:"#fff",borderRadius:4,padding:"1px 4px"}}>LUMP</span>}</td>
                        <td style={{padding:"7px 11px",color:t.tx3,whiteSpace:"nowrap"}}>{fmtMo(addMo(new Date(),row.month))}</td>
                        {orderedCards.map(c=>{ const pHere=payHere.find(p=>p.id===c.id); return(<td key={c.id} style={{padding:"7px 11px",textAlign:"right",fontFamily:"monospace",background:pHere?c.color+"22":"transparent"}}>{row.balances[c.id]!==undefined?<div><div style={{color:pHere?"#10b981":t.tx1,fontSize:10,fontWeight:pHere?700:400}}>{pHere?"✓ PAID":fmt$(row.balances[c.id])}</div><div style={{color:t.tx3,fontSize:9}}>pmt {fmt$(row.payments[c.id]||0)}</div></div>:<span style={{color:t.tx3,fontSize:10}}>—</span>}</td>); })}
                        <td style={{padding:"7px 11px",textAlign:"right",fontFamily:"monospace",color:t.tx1,fontWeight:600}}>{fmt$(tP)}</td>
                        <td style={{padding:"7px 11px",textAlign:"right",fontFamily:"monospace",color:"#f97316"}}>{fmt$(tI)}</td>
                      </tr>);
                    })}
                    {!showFull&&schedule.months.length>12&&<tr style={{background:t.surf}}><td colSpan={99} style={{padding:"9px 11px",textAlign:"center",color:t.tx2,fontSize:11}}>+{schedule.months.length-12} more months — <button onClick={()=>setShowFull(true)} style={{background:"none",border:"none",color:"#6366f1",cursor:"pointer",fontWeight:700,fontSize:11}}>Show all</button></td></tr>}
                  </tbody>
                  <tfoot><tr style={{background:t.surf,borderTop:`2px solid ${t.border}`}}>
                    <td colSpan={2} style={{padding:"9px 11px",fontWeight:800,color:t.tx1,fontSize:11}}>TOTALS</td>
                    {orderedCards.map(c=><td key={c.id} style={{padding:"9px 11px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:t.tx1,fontSize:10}}>{fmt$(schedule.months.reduce((s,r)=>s+(r.payments[c.id]||0),0))}</td>)}
                    <td style={{padding:"9px 11px",textAlign:"right",fontFamily:"monospace",fontWeight:800,color:t.tx1}}>{fmt$(schedule.totalPaid)}</td>
                    <td style={{padding:"9px 11px",textAlign:"right",fontFamily:"monospace",fontWeight:800,color:"#f97316"}}>{fmt$(schedule.totalInterest)}</td>
                  </tr></tfoot>
                </table>
              </div>
            </div>
            {/* AI Analysis */}
            <div style={{border:"1px solid #6366f133",borderRadius:16,overflow:"hidden"}}>
              <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",padding:"12px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{fontWeight:800,fontSize:13,color:"#fff"}}>✨ AI Analysis</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.55)",marginTop:1}}>{aiSavedAt?`Last saved ${new Date(aiSavedAt).toLocaleDateString()}`:apiKey?"Powered by your API key":"Powered by Claude"}</div>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {aiGenerated&&aiText&&(
                    <>
                      <button onClick={copyAI} style={{background:aiCopied?"#10b981":"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",borderRadius:7,padding:"5px 10px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600}}>{aiCopied?"✓ Copied":"📋 Copy"}</button>
                      <button onClick={downloadAI} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",borderRadius:7,padding:"5px 10px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600}}>⬇ .txt</button>
                    </>
                  )}
                  <button onClick={generateAI} disabled={aiLoading} style={{background:aiLoading?"rgba(255,255,255,.1)":"#6366f1",border:"none",borderRadius:8,padding:"7px 16px",color:"#fff",cursor:aiLoading?"default":"pointer",fontWeight:700,fontSize:12,opacity:aiLoading?.7:1}}>{aiLoading?"Analyzing…":aiGenerated?"↺ Regenerate":"Generate Analysis"}</button>
                </div>
              </div>
              <div ref={aiRef} style={{padding:"16px 20px",minHeight:aiGenerated?100:70,maxHeight:420,overflowY:"auto"}}>
                {!apiKey&&!aiGenerated&&<div style={{background:"#f59e0b18",border:"1px solid #f59e0b33",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#f59e0b"}}>⚠ No API key set — tap 🔑 in the top bar to enable AI features.</div>}
                {!aiGenerated&&<div style={{textAlign:"center",padding:"16px 0",color:t.tx3}}><div style={{fontSize:24,marginBottom:6}}>🤖</div><div style={{fontSize:12}}>Click "Generate Analysis" for AI recommendations on your current schedule</div></div>}
                {aiLoading&&!aiText&&<div style={{display:"flex",alignItems:"center",gap:8,color:t.tx2,padding:"12px 0"}}><div style={{width:14,height:14,border:"2px solid #6366f1",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite"}}/><span style={{fontSize:12}}>Analyzing your portfolio…</span></div>}
                {aiText&&<Markdown text={aiText} tx1={t.tx1} tx2={t.tx2}/>}
              </div>
            </div>
          </>)}

          {validCards.length>0&&activeTab==="charts"&&(<div style={{display:"flex",flexDirection:"column",gap:18}}><ComparisonChart avalanche={avalanche} snowball={snowball} darkMode={darkMode}/><BalanceChart schedule={schedule} darkMode={darkMode} title={`${method==="avalanche"?"🔥 Avalanche":"❄️ Snowball"} — Individual Card Balances Over Time`}/></div>)}
          {validCards.length>0&&activeTab==="whatif"&&<WhatIfTab cards={validCards} avalanche={avalanche} snowball={snowball} darkMode={darkMode} apiKey={apiKey}/>}
          {activeTab==="progress"&&<ProgressTab cards={cards} schedule={schedule} logsKey={logsKey} darkMode={darkMode}/>}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {showPrint&&<PrintOverlay avalanche={avalanche} snowball={snowball} onClose={()=>setShowPrint(false)}/>}
    </div>
  );
}

// ─── Mini Util Bar ────────────────────────────────────────────────────────────
function MiniUtilBar({balance,limit}){
  const pct=limit>0?Math.min(100,(balance/limit)*100):0;
  const bc=pct<20?"#10b981":pct<80?"#f59e0b":"#ef4444";
  return(<div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
    <div style={{flex:1,height:5,background:"rgba(255,255,255,.2)",borderRadius:3,overflow:"hidden",minWidth:40,position:"relative"}}>
      <div style={{height:"100%",width:`${pct}%`,background:bc,borderRadius:3,transition:"width .4s"}}/>
      <div style={{position:"absolute",left:"20%",top:0,bottom:0,width:1,background:"rgba(255,255,255,.4)"}}/>
      <div style={{position:"absolute",left:"80%",top:0,bottom:0,width:1,background:"rgba(255,255,255,.4)"}}/>
    </div>
    <span style={{fontSize:11,fontWeight:700,color:bc,whiteSpace:"nowrap"}}>{pct.toFixed(0)}%</span>
  </div>);
}

function UtilizationBar({balance,limit,darkMode}){
  const t=useTheme(darkMode);
  const pct=limit>0?Math.min(100,(balance/limit)*100):0;
  const bc=pct<20?"#10b981":pct<80?"#f59e0b":"#ef4444";
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:11,color:t.tx2}}>Credit Utilization</span><span style={{fontSize:13,fontWeight:700,color:bc,fontFamily:"monospace"}}>{pct.toFixed(1)}%</span></div>
    <div style={{position:"relative",height:18,background:t.surf,borderRadius:9,overflow:"visible"}}>
      <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${pct}%`,background:bc,borderRadius:9,transition:"width .5s"}}/>
      <div style={{position:"absolute",left:"20%",top:-5,bottom:-5,width:2,background:"#10b981",borderRadius:1}}><span style={{position:"absolute",top:"115%",left:"50%",transform:"translateX(-50%)",fontSize:9,color:"#10b981",whiteSpace:"nowrap"}}>20%</span></div>
      <div style={{position:"absolute",left:"80%",top:-5,bottom:-5,width:2,background:"#ef4444",borderRadius:1}}><span style={{position:"absolute",top:"115%",left:"50%",transform:"translateX(-50%)",fontSize:9,color:"#ef4444",whiteSpace:"nowrap"}}>80%</span></div>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",marginTop:18,fontSize:11,color:t.tx3}}><span>{fmt$(balance)} used</span><span>{fmt$(limit-balance)} available</span></div>
  </div>);
}

function PaymentStrip({dueDay,statementDay,color,darkMode}){
  const t=useTheme(darkMode);
  const today=new Date().getDate();
  const warnDay=statementDay?((Number(statementDay)-4+31)%31)+1:null;
  return(<div>
    <div style={{fontSize:11,color:t.tx2,marginBottom:6}}>Monthly Timeline</div>
    <div style={{display:"flex",gap:1,flexWrap:"wrap"}}>
      {Array.from({length:31},(_,i)=>i+1).map(d=>{
        const isToday=d===today,isDue=d===Number(dueDay),isStmt=d===Number(statementDay),isWarn=d===warnDay;
        let bg=t.surf,dot=null;
        if(isToday) bg=darkMode?"#334155":"#e0e7ff";
        if(isWarn) dot="#f59e0b"; if(isStmt) dot="#e2e8f0"; if(isDue) dot=color;
        return(<div key={d} title={isDue?"Payment Due":isStmt?"Statement Close":isWarn?"3 Days Before Statement":isToday?"Today":""}
          style={{width:18,height:28,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderRadius:4,background:bg}}>
          <span style={{fontSize:7,color:isToday?(darkMode?"#fff":"#4f46e5"):t.tx3,fontWeight:isToday?700:400}}>{d}</span>
          {dot&&<div style={{width:isDue?6:4,height:isDue?6:4,borderRadius:"50%",background:dot,marginTop:1}}/>}
        </div>);
      })}
    </div>
    <div style={{display:"flex",gap:12,marginTop:8,fontSize:10,color:t.tx3}}>
      {dueDay&&<span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:7,height:7,borderRadius:"50%",background:color,display:"inline-block"}}/>Due (Day {dueDay})</span>}
      {statementDay&&<span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:7,height:7,borderRadius:"50%",background:"#e2e8f0",display:"inline-block"}}/>Stmt (Day {statementDay})</span>}
      {warnDay&&<span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:7,height:7,borderRadius:"50%",background:"#f59e0b",display:"inline-block"}}/>⚠ (Day {warnDay})</span>}
    </div>
  </div>);
}

function PayoffBar({balance,originalBalance,color,darkMode}){
  const t=useTheme(darkMode);
  const orig=(originalBalance&&originalBalance>0)?originalBalance:balance;
  const pct=orig>0?(Math.max(0,orig-balance)/orig)*100:0;
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:t.tx2,marginBottom:4}}><span>Payoff Progress</span><span>{pct.toFixed(1)}% paid down</span></div>
    <div style={{height:8,background:t.surf,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:4,transition:"width .5s"}}/></div>
  </div>);
}

// ─── Quick Pay Modal ──────────────────────────────────────────────────────────
function QuickPayModal({card,onConfirm,onClose,darkMode}){
  const t=useTheme(darkMode);
  const bal=parseFloat(card.balance)||0;
  const apr=parseFloat(card.apr)||0;
  const minPmt=card.minPaymentMode==="auto"?calcMinPmt(bal,apr):(parseFloat(card.minPaymentFixed)||0);
  const expected=parseFloat(card.monthlyPayment)||minPmt;
  const monthlyInterest=bal*(apr/100/12);
  const [amount,setAmount]=useState(expected.toFixed(2));
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const paid=parseFloat(amount)||0;
  const principal=Math.max(0,paid-monthlyInterest);
  const newBal=Math.max(0,bal-principal);
  const diff=paid-expected;
  const iS={width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 12px",color:t.tx1,fontSize:14,boxSizing:"border-box",fontFamily:"monospace"};

  function confirm(){
    if(!paid||paid<=0) return;
    onConfirm({cardId:card.id,expected,actual:paid,principal,newBalance:newBal,date,cardName:card.name,cardColor:card.color});
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:5000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:t.panelBg,borderRadius:20,width:"100%",maxWidth:400,boxShadow:"0 24px 80px rgba(0,0,0,.6)"}}>
        {/* Card header */}
        <div style={{background:card.color,borderRadius:"20px 20px 0 0",padding:"16px 20px"}}>
          <div style={{fontWeight:800,fontSize:16,color:"#fff"}}>{card.name}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.7)",fontFamily:"monospace",marginTop:2}}>•••• {card.last4||"????"}  ·  Balance: {fmt$(bal)}</div>
        </div>
        <div style={{padding:20,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:11,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:.8}}>✓ Log Payment</div>
          {/* Expected vs actual */}
          <div style={{background:t.surf,borderRadius:12,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:9,color:t.tx3,textTransform:"uppercase",letterSpacing:.5}}>Expected This Month</div><div style={{fontSize:18,fontWeight:800,color:t.tx1,fontFamily:"monospace"}}>{fmt$(expected)}</div></div>
            {diff!==0&&paid>0&&<div style={{textAlign:"right"}}><div style={{fontSize:9,color:t.tx3,textTransform:"uppercase",letterSpacing:.5}}>{diff>0?"Over":"Under"}</div><div style={{fontSize:14,fontWeight:700,color:diff>0?"#10b981":"#f59e0b",fontFamily:"monospace"}}>{diff>0?"+":""}{fmt$(diff)}</div></div>}
          </div>
          {/* Actual amount */}
          <div>
            <div style={{fontSize:11,color:t.tx2,marginBottom:5,fontWeight:600}}>Actual Amount Paid</div>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} style={iS} min="0" step="0.01" autoFocus/>
          </div>
          {/* Date */}
          <div>
            <div style={{fontSize:11,color:t.tx2,marginBottom:5,fontWeight:600}}>Payment Date</div>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={iS}/>
          </div>
          {/* Balance preview */}
          {paid>0&&(
            <div style={{background:principal>0?"#10b98110":"#f59e0b10",border:`1px solid ${principal>0?"#10b98133":"#f59e0b33"}`,borderRadius:10,padding:"10px 14px"}}>
              <div style={{fontSize:11,color:t.tx2,marginBottom:6}}>Balance after this payment</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><span style={{fontSize:9,color:t.tx3}}>Interest: </span><span style={{fontSize:12,fontFamily:"monospace",color:"#f97316"}}>{fmt$(monthlyInterest)}</span></div>
                <div><span style={{fontSize:9,color:t.tx3}}>Principal: </span><span style={{fontSize:12,fontFamily:"monospace",color:"#10b981"}}>{fmt$(principal)}</span></div>
                <div><span style={{fontSize:9,color:t.tx3}}>New balance: </span><span style={{fontSize:14,fontWeight:800,fontFamily:"monospace",color:t.tx1}}>{fmt$(newBal)}</span></div>
              </div>
            </div>
          )}
          {/* Buttons */}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={onClose} style={{flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13}}>Cancel</button>
            <button onClick={confirm} disabled={!paid||paid<=0} style={{flex:2,background:paid>0?"#10b981":t.surf,border:"none",borderRadius:10,padding:"10px 0",color:paid>0?"#fff":t.tx3,cursor:paid>0?"pointer":"default",fontWeight:700,fontSize:14,transition:"all .2s"}}>✓ Confirm Payment</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card Panel ───────────────────────────────────────────────────────────────
function CardPanel({card,onEdit,onDelete,onQuickPay,darkMode,globalExpanded}){
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>{ setExpanded(globalExpanded); },[globalExpanded]);
  const t=useTheme(darkMode);
  const {isMobile}=useBreakpoint();
  const balance=parseFloat(card.balance)||0,limit=parseFloat(card.limit)||0,apr=parseFloat(card.apr)||0;
  const minPay=card.minPaymentMode==="auto"?calcMinPmt(balance,apr):(parseFloat(card.minPaymentFixed)||0);
  const monthly=parseFloat(card.monthlyPayment)||minPay;
  const {months,totalInterest,totalPaid}=calcPayoff(balance,apr,monthly);
  const payoffDate=months<Infinity&&months>0?addMo(new Date(),months):null;
  const nextPmt=getNextPmt(card.dueDay);
  return(
    <div style={{background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:16,overflow:"hidden",boxShadow:darkMode?"0 4px 24px rgba(0,0,0,.35)":"0 2px 12px rgba(0,0,0,.07)"}}>
      <div style={{background:card.color,padding:expanded?"12px 14px":"10px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1,minWidth:0}}><div style={{fontWeight:800,fontSize:15,color:"#fff",letterSpacing:.3}}>{card.name||"Unnamed Card"}</div><div style={{fontSize:11,color:"rgba(255,255,255,.75)",fontFamily:"monospace",marginTop:1}}>•••• {card.last4}{card.expiration?` · Exp ${card.expiration}`:""}</div></div>
          <div style={{display:"flex",gap:5,flexShrink:0,marginLeft:8}}>
            <button onClick={()=>onQuickPay&&onQuickPay(card)} title="Log a payment" style={{background:"rgba(16,185,129,.25)",border:"1px solid rgba(16,185,129,.4)",borderRadius:7,padding:"4px 9px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>✓ Pay</button>
            <button onClick={()=>setExpanded(e=>!e)} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:7,padding:"4px 9px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>{expanded?"▲":"▼"}</button>
            <button onClick={()=>onEdit(card)} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:7,padding:"4px 9px",color:"#fff",cursor:"pointer",fontSize:11}}>✎</button>
            <button onClick={()=>onDelete(card)} style={{background:"rgba(0,0,0,.2)",border:"none",borderRadius:7,padding:"4px 9px",color:"#fff",cursor:"pointer",fontSize:11}}>✕</button>
          </div>
        </div>
        {!expanded&&(
          <div style={{display:"flex",alignItems:"center",gap:10,marginTop:8}}>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:9,color:"rgba(255,255,255,.6)",marginBottom:3,textTransform:"uppercase",letterSpacing:.5}}>Utilization</div><MiniUtilBar balance={balance} limit={limit}/></div>
            <div style={{width:1,height:30,background:"rgba(255,255,255,.25)",flexShrink:0}}/>
            <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:9,color:"rgba(255,255,255,.6)",marginBottom:3,textTransform:"uppercase",letterSpacing:.5}}>Monthly Pmt</div><div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{fmt$(monthly)}</div></div>
            <div style={{width:1,height:30,background:"rgba(255,255,255,.25)",flexShrink:0}}/>
            <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:9,color:"rgba(255,255,255,.6)",marginBottom:3,textTransform:"uppercase",letterSpacing:.5}}>Next Payment</div>{nextPmt?<div style={{display:"flex",alignItems:"baseline",gap:4,justifyContent:"flex-end"}}><span style={{fontSize:13,fontWeight:700,color:"#fff"}}>Day {card.dueDay}</span><span style={{fontSize:10,color:"rgba(255,255,255,.7)"}}>{nextPmt.daysUntil===0?"Today!":nextPmt.daysUntil===1?"Tomorrow":`in ${nextPmt.daysUntil}d`}</span></div>:<span style={{fontSize:11,color:"rgba(255,255,255,.45)"}}>Not set</span>}</div>
          </div>
        )}
      </div>
      {expanded&&(
        <div style={{padding:16,display:"flex",flexDirection:"column",gap:18}}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:8}}>
            {[{l:"Balance",v:fmt$(balance)},{l:"Credit Limit",v:fmt$(limit)},{l:"APR",v:`${apr}%`},{l:"Monthly Pmt",v:fmt$(monthly)}].map(({l,v})=>(
              <div key={l} style={{background:t.surf,borderRadius:10,padding:"9px 11px"}}><div style={{fontSize:9,color:t.tx2,marginBottom:2,textTransform:"uppercase",letterSpacing:.4}}>{l}</div><div style={{fontSize:13,fontWeight:700,color:t.tx1,fontFamily:"monospace"}}>{v}</div></div>
            ))}
          </div>
          <div style={{background:t.surf,borderRadius:10,padding:"11px 14px",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <div><div style={{fontSize:9,color:t.tx2,textTransform:"uppercase"}}>Payoff In</div><div style={{fontSize:20,fontWeight:800,color:card.color,fontFamily:"monospace"}}>{months===Infinity?"Never ⚠":months>0?`${months} mo`:"—"}</div></div>
            <div><div style={{fontSize:9,color:t.tx2,textTransform:"uppercase"}}>Payoff Date</div><div style={{fontSize:13,fontWeight:700,color:t.tx1}}>{payoffDate?fmtDate(payoffDate):"—"}</div></div>
            <div><div style={{fontSize:9,color:t.tx2,textTransform:"uppercase"}}>Total Interest</div><div style={{fontSize:13,fontWeight:700,color:"#f97316"}}>{fmt$(totalInterest)}</div></div>
            <div><div style={{fontSize:9,color:t.tx2,textTransform:"uppercase"}}>Total Paid</div><div style={{fontSize:13,fontWeight:700,color:t.tx1}}>{fmt$(totalPaid)}</div></div>
          </div>
          <PayoffBar balance={balance} originalBalance={parseFloat(card.originalBalance)||balance} color={card.color} darkMode={darkMode}/>
          <div style={{borderTop:`1px solid ${t.border}`,paddingTop:16}}><UtilizationBar balance={balance} limit={limit} darkMode={darkMode}/></div>
          <div style={{borderTop:`1px solid ${t.border}`,paddingTop:16}}><PaymentStrip dueDay={card.dueDay} statementDay={card.statementDay} color={card.color} darkMode={darkMode}/></div>
        </div>
      )}
    </div>
  );
}

// ─── Alerts Banner ────────────────────────────────────────────────────────────
function AlertsBanner({cards,dismissed,onDismiss}){
  const today=new Date(),alerts=[];
  cards.forEach(card=>{
    const b=parseFloat(card.balance)||0,l=parseFloat(card.limit)||0,p=l>0?(b/l)*100:0,d=today.getDate();
    if(p>80) alerts.push({id:card.id+"-util",color:"#ef4444",msg:`${card.name}: Utilization at ${p.toFixed(0)}% — above 80%!`});
    if(card.dueDay){ const diff=Number(card.dueDay)-d; if(diff>=0&&diff<=7) alerts.push({id:card.id+"-due",color:card.color,msg:`${card.name}: Payment due in ${diff} day${diff!==1?"s":""} (Day ${card.dueDay})`}); }
    if(card.statementDay){ const diff=Number(card.statementDay)-d; if(diff>=0&&diff<=3) alerts.push({id:card.id+"-stmt",color:"#f59e0b",msg:`${card.name}: Statement closes in ${diff} day${diff!==1?"s":""}`}); }
    if(card.expiration){ const [m,y]=card.expiration.split("/"); if(m&&y){ const exp=new Date(2000+parseInt(y),parseInt(m)-1,1),diff=Math.ceil((exp-today)/86400000); if(diff<0) alerts.push({id:card.id+"-exp",color:"#ef4444",msg:`${card.name}: Card EXPIRED!`}); else if(diff<=30) alerts.push({id:card.id+"-exp",color:"#f97316",msg:`${card.name}: Expires in ${diff} days`}); } }
  });
  const active=alerts.filter(a=>!dismissed.includes(a.id));
  if(!active.length) return null;
  return <div style={{display:"flex",flexDirection:"column",gap:5}}>{active.map(a=><div key={a.id} style={{background:a.color+"22",border:`1px solid ${a.color}44`,borderRadius:10,padding:"7px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{color:a.color,fontSize:13,fontWeight:600}}>⚡ {a.msg}</span><button onClick={()=>onDismiss(a.id)} style={{background:"none",border:"none",color:a.color,cursor:"pointer",fontSize:18,lineHeight:1,padding:"0 2px"}}>×</button></div>)}</div>;
}

// ─── Summary Dashboard ────────────────────────────────────────────────────────
function SummaryDashboard({cards,darkMode,onOpenSchedule}){
  const [utilExpanded,setUtilExpanded]=useState(false);
  const [balanceMode,setBalanceMode]=useState("dollar");
  const t=useTheme(darkMode);
  const {isMobile,isTablet}=useBreakpoint();
  const totalBalance=cards.reduce((s,c)=>s+(parseFloat(c.balance)||0),0);
  const totalLimit=cards.reduce((s,c)=>s+(parseFloat(c.limit)||0),0);
  const totalUtil=totalLimit>0?(totalBalance/totalLimit)*100:0;
  const totalMonthly=cards.reduce((s,c)=>{ const b=parseFloat(c.balance)||0,a=parseFloat(c.apr)||0,m=c.minPaymentMode==="auto"?calcMinPmt(b,a):(parseFloat(c.minPaymentFixed)||0); return s+(parseFloat(c.monthlyPayment)||m); },0);
  const upcoming=cards.filter(c=>c.dueDay).map(c=>({...c,du:(getNextPmt(c.dueDay)?.daysUntil??999)})).sort((a,b)=>a.du-b.du)[0];
  const obc=totalUtil<20?"#10b981":totalUtil<80?"#f59e0b":"#ef4444";
  const statCols=isMobile?"repeat(2,1fr)":isTablet?"repeat(2,1fr)":"repeat(4,1fr)";
  return(
    <div style={{background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:16,padding:isMobile?14:20,boxShadow:darkMode?"0 4px 24px rgba(0,0,0,.35)":"0 2px 12px rgba(0,0,0,.07)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:10,color:t.tx2,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Portfolio Summary</div>
        <button onClick={onOpenSchedule} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:10,padding:"7px 16px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:isMobile?11:12,display:"flex",alignItems:"center",gap:6}}>📊 {isMobile?"Strategy":"Payoff Strategy Planner"}</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:statCols,gap:10,marginBottom:20}}>
        <div style={{background:t.surf,borderRadius:12,padding:"11px 14px",borderLeft:"3px solid #f97316"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{fontSize:9,color:t.tx2,textTransform:"uppercase",letterSpacing:.5}}>Total Balance</div>
            <div style={{display:"flex",borderRadius:5,overflow:"hidden",border:`1px solid ${t.border}`}}>
              {[["dollar","$"],["percent","%"]].map(([mode,lbl])=><button key={mode} onClick={()=>setBalanceMode(mode)} style={{padding:"1px 7px",fontSize:9,fontWeight:700,border:"none",cursor:"pointer",background:balanceMode===mode?"#f97316":t.panelBg,color:balanceMode===mode?"#fff":t.tx3,transition:"all .15s"}}>{lbl}</button>)}
            </div>
          </div>
          <div style={{fontSize:14,fontWeight:800,color:t.tx1,fontFamily:"monospace"}}>{balanceMode==="dollar"?fmt$(totalBalance):`${totalUtil.toFixed(1)}%`}</div>
          {balanceMode==="percent"&&<div style={{fontSize:9,color:obc,marginTop:2,fontWeight:600}}>{totalUtil<20?"✓ Good":totalUtil<80?"⚠ Moderate":"⚠ High"} utilization</div>}
        </div>
        {[{l:"Total Credit",v:fmt$(totalLimit),a:"#10b981"},{l:"Monthly Commitment",v:fmt$(totalMonthly),a:"#6366f1"},{l:"Next Payment",v:upcoming?`${upcoming.name.length>12?upcoming.name.slice(0,12)+"…":upcoming.name} · ${upcoming.du===0?"Today!":upcoming.du===1?"Tomorrow":`${upcoming.du}d`}`:"—",a:upcoming?.color||"#94a3b8"}].map(({l,v,a})=>(
          <div key={l} style={{background:t.surf,borderRadius:12,padding:"11px 14px",borderLeft:`3px solid ${a}`}}><div style={{fontSize:9,color:t.tx2,marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>{l}</div><div style={{fontSize:isMobile?12:14,fontWeight:800,color:t.tx1,fontFamily:"monospace"}}>{v}</div></div>
        ))}
      </div>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
          <span style={{fontSize:11,color:t.tx2}}>Overall Utilization</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12,fontWeight:700,color:obc,fontFamily:"monospace"}}>{totalUtil.toFixed(1)}%</span>
            <button onClick={()=>setUtilExpanded(e=>!e)} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:6,padding:"2px 9px",fontSize:10,color:t.tx2,cursor:"pointer",fontWeight:600}}>{utilExpanded?"▲ Collapse":"▼ Per Card"}</button>
          </div>
        </div>
        <div style={{position:"relative",height:14,background:t.surf,borderRadius:7,overflow:"visible"}}>
          <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${Math.min(100,totalUtil)}%`,background:obc,borderRadius:7,transition:"width .5s"}}/>
          <div style={{position:"absolute",left:"20%",top:-4,bottom:-4,width:2,background:"#10b981",borderRadius:1}}><span style={{position:"absolute",top:"115%",left:"50%",transform:"translateX(-50%)",fontSize:8,color:"#10b981",whiteSpace:"nowrap"}}>20%</span></div>
          <div style={{position:"absolute",left:"80%",top:-4,bottom:-4,width:2,background:"#ef4444",borderRadius:1}}><span style={{position:"absolute",top:"115%",left:"50%",transform:"translateX(-50%)",fontSize:8,color:"#ef4444",whiteSpace:"nowrap"}}>80%</span></div>
        </div>
        {utilExpanded&&cards.length>0&&(
          <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${t.border}`,display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:10,color:t.tx2,fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>Individual Card Utilization</div>
            {cards.map(card=>{ const b=parseFloat(card.balance)||0,l=parseFloat(card.limit)||0,p=l>0?Math.min(100,(b/l)*100):0,bc=p<20?"#10b981":p<80?"#f59e0b":"#ef4444"; return(<div key={card.id}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:"50%",background:card.color,flexShrink:0}}/><span style={{fontSize:12,color:t.tx1,fontWeight:600}}>{card.name||"Unnamed"}</span>{card.last4&&!isMobile&&<span style={{fontSize:10,color:t.tx3,fontFamily:"monospace"}}>•••• {card.last4}</span>}</div><div style={{display:"flex",gap:12,alignItems:"center"}}>{!isMobile&&<span style={{fontSize:11,color:t.tx3,fontFamily:"monospace"}}>{fmt$(b)} / {fmt$(l)}</span>}<span style={{fontSize:12,fontWeight:700,color:bc,fontFamily:"monospace",minWidth:38,textAlign:"right"}}>{p.toFixed(0)}%</span></div></div><div style={{position:"relative",height:10,background:t.surf,borderRadius:5,overflow:"visible"}}><div style={{position:"absolute",left:0,top:0,height:"100%",width:`${p}%`,background:card.color,borderRadius:5,opacity:.85,transition:"width .4s"}}/><div style={{position:"absolute",left:"20%",top:-2,bottom:-2,width:1.5,background:"#10b981",opacity:.7}}/><div style={{position:"absolute",left:"80%",top:-2,bottom:-2,width:1.5,background:"#ef4444",opacity:.7}}/></div></div>); })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function CalendarView({cards,darkMode}){
  const [viewDate,setViewDate]=useState(new Date());
  const t=useTheme(darkMode);
  const {isMobile}=useBreakpoint();
  const year=viewDate.getFullYear(),month=viewDate.getMonth();
  const firstDay=new Date(year,month,1).getDay(),totalDays=new Date(year,month+1,0).getDate();
  const cells=Array.from({length:firstDay+totalDays},(_,i)=>i<firstDay?null:i-firstDay+1);
  const today=new Date();

  function getEvents(day){ const ev=[]; cards.forEach(card=>{ const b=parseFloat(card.balance)||0,a=parseFloat(card.apr)||0; const wd=card.statementDay?((Number(card.statementDay)-4+31)%31)+1:null; if(Number(card.dueDay)===day) ev.push({card,type:"payment",label:"Due"}); if(Number(card.statementDay)===day) ev.push({card,type:"statement",label:"Stmt"}); if(wd===day) ev.push({card,type:"warning",label:"⚠"}); const {months}=calcPayoff(b,a,parseFloat(card.monthlyPayment)||calcMinPmt(b,a)); if(months<Infinity&&months>0){ const pd=addMo(new Date(),months); if(pd.getFullYear()===year&&pd.getMonth()===month&&pd.getDate()===day) ev.push({card,type:"payoff",label:"✓"}); } }); return ev; }

  function exportICS(){
    const ics=generateICS(cards);
    const blob=new Blob([ics],{type:"text/calendar;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download="cardtracker-payments.ics"; a.style.display="none";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),100);
  }

  return (
    <div style={{background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:16,padding:isMobile?12:20}}>

      {/* Header row */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:8,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setViewDate(d=>new Date(d.getFullYear(),d.getMonth()-1))} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 14px",color:t.tx1,cursor:"pointer",fontSize:16,lineHeight:1}}>‹</button>
          <span style={{fontWeight:700,fontSize:isMobile?13:15,color:t.tx1,whiteSpace:"nowrap"}}>{viewDate.toLocaleDateString("en-US",{month:"long",year:"numeric"})}</span>
          <button onClick={()=>setViewDate(new Date())} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:6,padding:"2px 8px",color:t.tx2,cursor:"pointer",fontSize:10}}>Today</button>
          <button onClick={()=>setViewDate(d=>new Date(d.getFullYear(),d.getMonth()+1))} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 14px",color:t.tx1,cursor:"pointer",fontSize:16,lineHeight:1}}>›</button>
        </div>
        <button
          onClick={exportICS}
          disabled={!cards.length}
          title="Export to Google Calendar, Apple Calendar, Outlook, etc."
          style={{background:cards.length?"#6366f1":t.surf,border:`1px solid ${cards.length?"#6366f1":t.border}`,borderRadius:8,padding:"7px 14px",color:cards.length?"#fff":t.tx3,cursor:cards.length?"pointer":"default",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap",opacity:cards.length?1:.5}}
        >
          📅 {isMobile?"Export":"Export to Calendar"}
        </button>
      </div>

      {/* Day headers */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:isMobile?2:3,marginBottom:isMobile?2:3}}>
        {(isMobile?["S","M","T","W","T","F","S"]:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]).map((d,i)=>(
          <div key={i} style={{textAlign:"center",fontSize:isMobile?9:10,color:t.tx3,fontWeight:600,padding:"3px 0"}}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:isMobile?2:3}}>
        {cells.map((day,i)=>{
          const isTd=day&&today.getDate()===day&&today.getMonth()===month&&today.getFullYear()===year;
          const evs=day?getEvents(day):[];
          return (
            <div key={i} style={{minHeight:isMobile?44:58,background:isTd?(darkMode?"#1e3a5f":"#dbeafe"):day?t.surf:"transparent",borderRadius:isMobile?5:7,padding:isMobile?3:4}}>
              {day&&<div style={{fontSize:isMobile?10:11,color:isTd?"#3b82f6":t.tx3,fontWeight:isTd?700:400,marginBottom:2}}>{day}</div>}
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                {evs.slice(0,isMobile?2:4).map((ev,j)=>(
                  <div key={j} title={`${ev.card.name} — ${ev.type}`} style={{fontSize:isMobile?7:9,borderRadius:3,padding:isMobile?"1px 2px":"1px 4px",fontWeight:600,background:ev.type==="warning"?"#f59e0b22":ev.card.color+"22",color:ev.type==="warning"?"#f59e0b":ev.type==="statement"?(darkMode?"#e2e8f0":"#475569"):ev.card.color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {isMobile?ev.label:`${ev.label} ${ev.card.name}`}
                  </div>
                ))}
                {isMobile&&evs.length>2&&<div style={{fontSize:7,color:t.tx3}}>+{evs.length-2}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:isMobile?8:14,marginTop:10,flexWrap:"wrap",fontSize:10,color:t.tx3}}>
        <span>● Payment Due</span>
        <span>○ Statement</span>
        <span style={{color:"#f59e0b"}}>⚠ Warning</span>
        <span>✓ Payoff</span>
      </div>

      {/* Export info */}
      <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${t.border}`,fontSize:11,color:t.tx3,lineHeight:1.6}}>
        📅 <strong style={{color:t.tx2}}>Export to Calendar</strong> downloads a <code style={{background:t.surf,padding:"1px 4px",borderRadius:4,fontSize:10}}>.ics</code> file with all payment due dates, statement close dates, and projected payoff events — works with Google Calendar, Apple Calendar, Outlook, and any calendar app. Includes 3-day and 1-day reminders for payments.
      </div>
    </div>
  );
}

// ─── Profile Modal ────────────────────────────────────────────────────────────
function ProfileModal({profile,onSave,onClose,onSwitch,allProfiles,darkMode}){
  const [mode,setMode]=useState("view");
  const [form,setForm]=useState(profile?{...profile}:{...DEFAULT_PROFILE,id:generateId(),createdAt:new Date().toISOString()});
  const [pin,setPin]=useState(profile?.pin||"");
  const t=useTheme(darkMode); const isNew=!profile;
  const iS={width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx1,fontSize:13,boxSizing:"border-box"};
  const lS={fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600};

  function handleSave(){
    if(!form.name.trim()) return;
    // PIN becomes part of the stable ID so data is recoverable across devices
    const stableId = pin.trim()
      ? "pin_" + pin.trim().toLowerCase().replace(/\s+/g,"_")
      : form.id;
    onSave({...form, id: stableId, pin: pin.trim()});
  }

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:t.panelBg,borderRadius:20,width:"100%",maxWidth:440,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{margin:0,color:t.tx1,fontSize:17,fontWeight:800}}>
            {mode==="create"?"New Profile":isNew?"Welcome to CardTracker":"My Profile"}
          </h2>
          {/* Only show X when editing an existing profile, never on first-time setup */}
          {!isNew&&mode!=="create"&&<button onClick={onClose} style={{background:t.surf,border:"none",borderRadius:8,padding:"5px 11px",color:t.tx1,cursor:"pointer"}}>✕</button>}
        </div>

        {mode==="view"&&profile&&(
          <div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:20}}>
              <div style={{width:72,height:72,borderRadius:"50%",background:profile.avatarColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:800,color:"#fff",boxShadow:`0 0 0 4px ${profile.avatarColor}44`,marginBottom:10}}>{getInitials(profile.name)}</div>
              <div style={{fontWeight:800,fontSize:18,color:t.tx1}}>{profile.name}</div>
              {profile.email&&<div style={{fontSize:13,color:t.tx2,marginTop:2}}>{profile.email}</div>}
              {profile.pin&&<div style={{fontSize:11,color:t.tx3,marginTop:4,fontFamily:"monospace"}}>🔑 PIN: {profile.pin}</div>}
              {profile.createdAt&&<div style={{fontSize:10,color:t.tx3,marginTop:4}}>Member since {new Date(profile.createdAt).toLocaleDateString("en-US",{month:"long",year:"numeric"})}</div>}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:20}}>
              <button onClick={()=>{setForm({...profile});setPin(profile.pin||"");setMode("edit");}} style={{flex:1,background:profile.avatarColor,border:"none",borderRadius:10,padding:"9px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13}}>Edit Profile</button>
              <button onClick={()=>{setForm({...DEFAULT_PROFILE,id:generateId(),createdAt:new Date().toISOString()});setPin("");setMode("create");}} style={{flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600,fontSize:13}}>+ New Profile</button>
            </div>
            {allProfiles.filter(p=>p.id!==profile.id).length>0&&(<div><div style={{fontSize:10,color:t.tx2,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Switch Profile</div>{allProfiles.filter(p=>p.id!==profile.id).map(p=><div key={p.id} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 12px",display:"flex",alignItems:"center",gap:10,marginBottom:6}}><div style={{width:32,height:32,borderRadius:"50%",background:p.avatarColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",flexShrink:0}}>{getInitials(p.name)}</div><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:t.tx1}}>{p.name||"Unnamed"}</div>{p.pin&&<div style={{fontSize:10,color:t.tx3,fontFamily:"monospace"}}>PIN: {p.pin}</div>}</div><button onClick={()=>onSwitch(p.id)} style={{background:p.avatarColor,border:"none",borderRadius:7,padding:"4px 10px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>Switch</button></div>)}</div>)}
          </div>
        )}

        {(mode==="edit"||mode==="create"||isNew)&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {isNew&&(
              <div style={{background:"#6366f118",border:"1px solid #6366f133",borderRadius:12,padding:"12px 14px"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#6366f1",marginBottom:4}}>👋 Create your profile to get started</div>
                <div style={{fontSize:11,color:t.tx2,lineHeight:1.6}}>Your cards and progress are saved to your profile. Set an optional PIN to recover your data on any device — even without a cloud account.</div>
              </div>
            )}
            <div style={{display:"flex",justifyContent:"center",marginBottom:4}}>
              <div style={{width:64,height:64,borderRadius:"50%",background:form.avatarColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#fff",boxShadow:`0 0 0 4px ${form.avatarColor}44`}}>{getInitials(form.name)}</div>
            </div>
            <div><label style={lS}>Display Name <span style={{color:"#ef4444"}}>*</span></label><input style={iS} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Your Name"/></div>
            <div><label style={lS}>Email (optional)</label><input style={iS} value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="you@email.com"/></div>
            <div>
              <label style={lS}>
                Recovery PIN <span style={{color:t.tx3,fontWeight:400}}>(optional but recommended)</span>
              </label>
              <input style={iS} value={pin} onChange={e=>setPin(e.target.value)} placeholder="e.g. smithfamily or john2024"/>
              <div style={{fontSize:10,color:t.tx3,marginTop:5,lineHeight:1.5}}>
                💡 Choose any memorable word or phrase. This becomes your data key — enter the same PIN on a new device to recover all your cards. <strong style={{color:t.tx2}}>Write it down somewhere safe.</strong>
              </div>
            </div>
            <div><label style={lS}>Avatar Color</label><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{AVATAR_COLORS.map(c=><div key={c} onClick={()=>setForm(f=>({...f,avatarColor:c}))} style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:form.avatarColor===c?"3px solid #fff":"2px solid transparent",boxShadow:form.avatarColor===c?`0 0 0 2px ${c}`:"none",transition:"all .15s"}}/>)}</div></div>
            <div style={{display:"flex",gap:8,marginTop:4}}>
              {mode==="edit"&&<button onClick={()=>setMode("view")} style={{flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600}}>Cancel</button>}
              {mode==="create"&&<button onClick={()=>setMode("view")} style={{flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 0",color:t.tx1,cursor:"pointer",fontWeight:600}}>Cancel</button>}
              <button onClick={handleSave} disabled={!form.name.trim()} style={{flex:2,background:form.name.trim()?form.avatarColor:t.surf,border:"none",borderRadius:10,padding:"9px 0",color:form.name.trim()?"#fff":t.tx3,cursor:form.name.trim()?"pointer":"default",fontWeight:700,fontSize:14,transition:"all .2s"}}>
                {mode==="edit"?"Save Changes":"Create Profile"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Card Form Modal ──────────────────────────────────────────────────────────
function CardFormModal({initial,onSave,onClose,darkMode}){
  const [form,setForm]=useState(initial?{...initial}:{...DEFAULT_CARD,id:generateId()});
  const [errors,setErrors]=useState({});
  const t=useTheme(darkMode);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const balance=parseFloat(form.balance)||0,limit=parseFloat(form.limit)||0,apr=parseFloat(form.apr)||0;
  const minPay=form.minPaymentMode==="auto"?calcMinPmt(balance,apr):(parseFloat(form.minPaymentFixed)||0);
  useEffect(()=>{ if(form.payoffMode==="months"&&form.payoffMonths&&balance>0) set("monthlyPayment",calcPmtForMonths(balance,apr,parseInt(form.payoffMonths)).toFixed(2)); },[form.payoffMode,form.payoffMonths,form.balance,form.apr]);
  const effectivePmt = parseFloat(form.monthlyPayment) || minPay;
  const preview = balance > 0 ? calcPayoff(balance, apr, effectivePmt) : null;
  function validate(){ const e={}; if(!form.name) e.name="Required"; if(balance>limit&&limit>0) e.balance="Exceeds limit"; if(apr<0||apr>100) e.apr="0–100%"; if(parseFloat(form.monthlyPayment)>0&&parseFloat(form.monthlyPayment)<minPay&&minPay>0) e.monthlyPayment=`Min ${fmt$(minPay)}`; setErrors(e); return !Object.keys(e).length; }
  const iS={width:"100%",background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 12px",color:t.tx1,fontSize:13,boxSizing:"border-box"};
  const lS={fontSize:11,color:t.tx2,display:"block",marginBottom:4,fontWeight:600};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:t.panelBg,borderRadius:20,width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{margin:0,color:t.tx1,fontSize:17,fontWeight:800}}>{initial?"Edit Card":"Add Card"}</h2><button onClick={onClose} style={{background:t.surf,border:"none",borderRadius:8,padding:"5px 11px",color:t.tx1,cursor:"pointer"}}>✕</button></div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div><label style={lS}>Card Color</label><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{PRESET_COLORS.map(c=><div key={c} onClick={()=>set("color",c)} style={{width:27,height:27,borderRadius:"50%",background:c,cursor:"pointer",border:form.color===c?"3px solid #fff":"2px solid transparent",boxShadow:form.color===c?`0 0 0 2px ${c}`:"none",transition:"all .15s"}}/>)}</div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
            <div><label style={lS}>Card Name {errors.name&&<span style={{color:"#ef4444"}}>*</span>}</label><input style={iS} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Chase Sapphire"/></div>
            <div><label style={lS}>Last 4 Digits</label><input style={iS} value={form.last4} onChange={e=>set("last4",e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="1234" maxLength={4}/></div>
            <div><label style={lS}>Current Balance {errors.balance&&<span style={{color:"#ef4444"}}>({errors.balance})</span>}</label><input style={iS} type="number" value={form.balance} onChange={e=>set("balance",e.target.value)} placeholder="0.00"/></div>
            <div><label style={lS}>Starting Balance <span style={{color:t.tx3,fontSize:10}}>(for progress bar)</span></label><input style={iS} type="number" value={form.originalBalance} onChange={e=>set("originalBalance",e.target.value)} placeholder="Leave blank = current"/></div>
            <div><label style={lS}>Credit Limit</label><input style={iS} type="number" value={form.limit} onChange={e=>set("limit",e.target.value)} placeholder="5000"/></div>
            <div><label style={lS}>APR % {errors.apr&&<span style={{color:"#ef4444"}}>({errors.apr})</span>}</label><input style={iS} type="number" value={form.apr} onChange={e=>set("apr",e.target.value)} placeholder="22.99" step="0.01"/></div>
            <div><label style={lS}>Expiration (MM/YY)</label><input style={iS} value={form.expiration} onChange={e=>set("expiration",e.target.value)} placeholder="12/27" maxLength={5}/></div>
            <div><label style={lS}>Payment Due Day</label><input style={iS} type="number" value={form.dueDay} onChange={e=>set("dueDay",e.target.value)} placeholder="15" min="1" max="31"/></div>
            <div><label style={lS}>Statement Closing Day</label><input style={iS} type="number" value={form.statementDay} onChange={e=>set("statementDay",e.target.value)} placeholder="10" min="1" max="31"/></div>
          </div>
          <div><label style={lS}>Minimum Payment</label><div style={{display:"flex",gap:7}}>{["auto","fixed"].map(m=><button key={m} onClick={()=>set("minPaymentMode",m)} style={{flex:1,background:form.minPaymentMode===m?form.color:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 0",color:form.minPaymentMode===m?"#fff":t.tx2,cursor:"pointer",fontSize:12,fontWeight:600}}>{m==="auto"?`Auto (${fmt$(calcMinPmt(balance,apr))})`:  "Fixed Amount"}</button>)}</div>{form.minPaymentMode==="fixed"&&<input style={{...iS,marginTop:7}} type="number" value={form.minPaymentFixed} onChange={e=>set("minPaymentFixed",e.target.value)} placeholder="Minimum payment amount"/>}</div>
          <div><label style={lS}>Payoff Calculator</label><div style={{display:"flex",gap:7}}>{[["payment","Set monthly payment"],["months","Pay off in X months"]].map(([m,l])=><button key={m} onClick={()=>set("payoffMode",m)} style={{flex:1,background:form.payoffMode===m?form.color:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 0",color:form.payoffMode===m?"#fff":t.tx2,cursor:"pointer",fontSize:11,fontWeight:600}}>{l}</button>)}</div>{form.payoffMode==="payment"?<div style={{marginTop:7}}><label style={lS}>Monthly Payment {errors.monthlyPayment&&<span style={{color:"#ef4444"}}>({errors.monthlyPayment})</span>}</label><input style={iS} type="number" value={form.monthlyPayment} onChange={e=>set("monthlyPayment",e.target.value)} placeholder={fmt$(minPay)}/></div>:<div style={{marginTop:7}}><label style={lS}>Desired Months to Payoff</label><input style={iS} type="number" value={form.payoffMonths} onChange={e=>set("payoffMonths",e.target.value)} placeholder="24"/></div>}</div>
          {preview&&<div style={{background:form.color+"22",border:`1px solid ${form.color}44`,borderRadius:12,padding:"12px 14px"}}><div style={{fontSize:11,color:form.color,fontWeight:700,marginBottom:8}}>Payoff Preview</div><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>{[{l:"Monthly Payment",v:fmt$(effectivePmt),c:form.color},{l:"Months",v:preview.months===Infinity?"Never":preview.months,c:t.tx1},{l:"Total Interest",v:fmt$(preview.totalInterest),c:"#f97316"},{l:"Total Paid",v:fmt$(preview.totalPaid),c:t.tx1}].map(({l,v,c})=><div key={l}><div style={{fontSize:9,color:t.tx2,marginBottom:2}}>{l}</div><div style={{fontSize:13,fontWeight:700,color:c,fontFamily:"monospace"}}>{v}</div></div>)}</div><div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${form.color}33`,fontSize:10,color:t.tx2}}>Auto min = interest ({fmt$(balance*(parseFloat(form.apr)||0)/100/12)}/mo) + 1% principal ({fmt$(balance*0.01)}) = <strong style={{color:form.color}}>{fmt$(minPay)}/mo</strong></div></div>}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={onClose} style={{flex:1,background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 0",color:t.tx1,cursor:"pointer",fontWeight:600}}>Cancel</button>
            <button onClick={()=>{if(validate())onSave({...form});}} style={{flex:2,background:form.color,border:"none",borderRadius:10,padding:"10px 0",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>Save Card</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [loading,setLoading]=useState(true);
  const [profiles,setProfiles]=useState([]);
  const [activeProfileId,setActiveProfileId]=useState(null);
  const [cards,setCards]=useState([]);
  const [apiKey,setApiKey]=useState("");
  const [showProfile,setShowProfile]=useState(false);
  const [deleteTarget,setDeleteTarget]=useState(null); // card to confirm-delete

  // Per-device prefs (localStorage)
  const [darkMode,setDarkMode]=useState(()=>localStorage.getItem("cc_dark")!=="false");
  useEffect(()=>{ localStorage.setItem("cc_dark",darkMode); },[darkMode]);

  // Load data on mount — probes cloud storage first (2.5s timeout), falls back to localStorage
  useEffect(()=>{
    async function init(){
      // probeCloudStorage() is called implicitly by storeGet — it resolves when
      // cloud is confirmed available OR times out (e.g. user closed the login modal)
      const [profs,aid,key] = await Promise.all([
        storeGet("cc_profiles",true),
        storeGet("cc_active_profile",true),
        storeGet("cc_apikey",true),
      ]);
      if(profs) setProfiles(profs);
      if(aid) setActiveProfileId(aid);
      if(key) setApiKey(key);
      const cardsKey=aid?`cc_cards_${aid}`:"cc_cards_default";
      const savedCards=await storeGet(cardsKey,true);
      if(savedCards) setCards(savedCards);
      setLoading(false);
      if(!profs||profs.length===0) setShowProfile(true);
    }
    init();
  },[]);

  // Persist shared data on change
  useEffect(()=>{ if(!loading) storeSet("cc_profiles",profiles,true); },[profiles,loading]);
  useEffect(()=>{ if(!loading&&activeProfileId){ storeSet("cc_active_profile",activeProfileId,true); const cardsKey=`cc_cards_${activeProfileId}`; storeGet(cardsKey,true).then(v=>{ if(v) setCards(v); else setCards([]); }); } },[activeProfileId]);
  useEffect(()=>{ if(!loading){ const ck=activeProfileId?`cc_cards_${activeProfileId}`:"cc_cards_default"; storeSet(ck,cards,true); } },[cards,loading,activeProfileId]);
  useEffect(()=>{ if(!loading) storeSet("cc_apikey",apiKey,true); },[apiKey,loading]);

  const activeProfile=profiles.find(p=>p.id===activeProfileId)||null;
  const logsKey=activeProfileId?`cc_logs_${activeProfileId}`:"cc_logs_default";

  const [showForm,setShowForm]=useState(false);
  const [editCard,setEditCard]=useState(null);
  const [dismissed,setDismissed]=useState([]);
  const [activeTab,setActiveTab]=useState("cards");
  const [showSchedule,setShowSchedule]=useState(false);
  const [allCardsExpanded,setAllCardsExpanded]=useState(false);
  const [showApiKey,setShowApiKey]=useState(false);
  const [showBackup,setShowBackup]=useState(false);
  const [quickPayCard,setQuickPayCard]=useState(null);

  function saveProfile(p){ setProfiles(ps=>{ const i=ps.findIndex(x=>x.id===p.id); if(i>=0){const n=[...ps];n[i]=p;return n;} return[...ps,p]; }); setActiveProfileId(p.id); setShowProfile(false); }
  function saveCard(card){ setCards(cs=>{ const i=cs.findIndex(c=>c.id===card.id); if(i>=0){const n=[...cs];n[i]=card;return n;} return[...cs,card]; }); setShowForm(false); setEditCard(null); }
  function confirmDelete(card){ setDeleteTarget(card); }
  function doDelete(){ if(deleteTarget) setCards(cs=>cs.filter(c=>c.id!==deleteTarget.id)); setDeleteTarget(null); }
  function handleQuickPay(payment){
    // Update card balance and log payment
    setCards(cs=>cs.map(c=>{
      if(c.id!==payment.cardId) return c;
      const newBal=Math.max(0,(parseFloat(c.balance)||0)-payment.principal);
      return {...c,balance:newBal.toFixed(2)};
    }));
    setQuickPayCard(null);
  }
  function handleImport(importedCards, mode){
    if(mode==="replace") setCards(importedCards.map(c=>({...c,id:c.id||generateId()})));
    else setCards(cs=>{
      const existingNames=new Set(cs.map(c=>c.name?.toLowerCase()));
      const toAdd=importedCards.filter(c=>!existingNames.has(c.name?.toLowerCase())).map(c=>({...c,id:generateId()}));
      return [...cs,...toAdd];
    });
  }

  const t=useTheme(darkMode);
  const {isMobile,isTablet}=useBreakpoint();
  const aTS={background:"#6366f1",color:"#fff",border:"none"};
  const iTS={background:t.panelBg,color:t.tx2,border:`1px solid ${t.border}`};

  if(loading) return(
    <div style={{minHeight:"100vh",background:t.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,padding:20}}>
      <div style={{width:40,height:40,border:"3px solid #6366f1",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
      <div style={{fontSize:14,color:t.tx2,textAlign:"center"}}>Loading your cards…</div>
      <div style={{fontSize:12,color:t.tx3,textAlign:"center",maxWidth:280}}>If a login prompt appeared, you can close it — the app will load in local mode automatically.</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // Block entire app until profile exists
  if(!activeProfile) return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <ProfileModal profile={null} onSave={saveProfile} onClose={()=>{}} onSwitch={()=>{}} allProfiles={[]} darkMode={darkMode}/>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif",color:t.tx1}}>

      {/* ── Nav bar ── */}
      <div style={{background:t.deepBg,borderBottom:`1px solid ${t.border}`,padding:isMobile?"9px 12px":"11px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100,gap:8}}>

        {/* Left: logo + badges */}
        <div style={{display:"flex",alignItems:"center",gap:isMobile?6:10,minWidth:0}}>
          <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#6366f1,#ec4899)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>💳</div>
          {!isMobile&&<span style={{fontWeight:800,fontSize:17,color:t.tx1,whiteSpace:"nowrap"}}>CardTracker</span>}
          <span style={{fontSize:10,color:t.tx2,background:t.surf,border:`1px solid ${t.border}`,borderRadius:6,padding:"2px 7px",whiteSpace:"nowrap"}}>{cards.length} card{cards.length!==1?"s":""}</span>
          {!isMobile&&<span title={hasCloudStorage()?"Synced via cloud":"Saved locally"} style={{fontSize:10,color:hasCloudStorage()?"#10b981":"#f59e0b",background:hasCloudStorage()?"#10b98118":"#f59e0b18",border:`1px solid ${hasCloudStorage()?"#10b98133":"#f59e0b33"}`,borderRadius:6,padding:"2px 7px",whiteSpace:"nowrap",cursor:"default"}}>{hasCloudStorage()?"☁ Sync":"💾 Local"}</span>}
        </div>

        {/* Right: action buttons */}
        <div style={{display:"flex",gap:isMobile?5:8,alignItems:"center",flexShrink:0}}>
          <button onClick={()=>setDarkMode(d=>!d)} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:isMobile?"5px 9px":"6px 11px",color:t.tx1,cursor:"pointer",fontSize:14}}>{darkMode?"☀️":"🌙"}</button>
          <button onClick={()=>setShowBackup(true)} title="Backup & Restore" style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:8,padding:isMobile?"5px 9px":"6px 11px",color:t.tx2,cursor:"pointer",fontSize:14}}>📦</button>
          <button onClick={()=>setShowApiKey(true)} title="Anthropic API Key" style={{background:apiKey?t.surf:"#f59e0b22",border:`1px solid ${apiKey?t.border:"#f59e0b66"}`,borderRadius:8,padding:isMobile?"5px 9px":"6px 11px",color:apiKey?t.tx2:"#f59e0b",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",gap:4}}>
            🔑{!apiKey&&!isMobile&&<span style={{fontSize:10,fontWeight:700}}>Set Key</span>}
          </button>
          {/* Profile avatar — shows name on tablet+, just avatar on mobile */}
          <button onClick={()=>setShowProfile(true)} style={{background:t.surf,border:`1px solid ${t.border}`,borderRadius:10,padding:isMobile?"4px 7px":"5px 10px",color:t.tx1,cursor:"pointer",display:"flex",alignItems:"center",gap:isMobile?0:8}}>
            <div style={{width:24,height:24,borderRadius:"50%",background:activeProfile?.avatarColor||"#6366f1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff"}}>{activeProfile?getInitials(activeProfile.name):"?"}</div>
            {!isMobile&&<span style={{fontSize:12,fontWeight:600,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{activeProfile?.name||"Profile"}</span>}
          </button>
          <button onClick={()=>{setEditCard(null);setShowForm(true);}} style={{background:"#6366f1",border:"none",borderRadius:8,padding:isMobile?"6px 12px":"6px 16px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:isMobile?12:13,whiteSpace:"nowrap"}}>
            {isMobile?"+ Card":"+ Add Card"}
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{maxWidth:1200,margin:"0 auto",padding:isMobile?"12px 10px":"20px 16px",display:"flex",flexDirection:"column",gap:isMobile?12:20}}>

        {/* API key banner */}
        {!apiKey&&(
          <div style={{background:"#f59e0b18",border:"1px solid #f59e0b44",borderRadius:12,padding:isMobile?"10px 12px":"12px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontWeight:700,color:"#f59e0b",marginBottom:2,fontSize:isMobile?12:14}}>🔑 Enable AI Features</div>
              {!isMobile&&<div style={{fontSize:13,color:t.tx2}}>Add your Anthropic API key so all family members can use AI analysis, What-If chat, and Strategy Builder.</div>}
            </div>
            <button onClick={()=>setShowApiKey(true)} style={{background:"#f59e0b",border:"none",borderRadius:8,padding:"7px 14px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>Add API Key</button>
          </div>
        )}

        <AlertsBanner cards={cards} dismissed={dismissed} onDismiss={id=>setDismissed(d=>[...d,id])}/>
        {cards.length>0&&<SummaryDashboard cards={cards} darkMode={darkMode} onOpenSchedule={()=>setShowSchedule(true)}/>}

        {/* Tab bar */}
        <div style={{display:"flex",gap:7}}>
          {[["cards","💳 Cards"],["calendar","📅 Calendar"]].map(([tab,label])=>(
            <button key={tab} onClick={()=>setActiveTab(tab)} style={{borderRadius:10,padding:isMobile?"7px 14px":"7px 18px",cursor:"pointer",fontWeight:600,fontSize:isMobile?12:13,...(activeTab===tab?aTS:iTS)}}>{label}</button>
          ))}
        </div>

        {/* Cards tab */}
        {activeTab==="cards"&&(cards.length===0?(
          <div style={{textAlign:"center",padding:isMobile?"40px 16px":"60px 20px",color:t.tx2}}>
            <div style={{fontSize:48,marginBottom:12}}>💳</div>
            <div style={{fontWeight:700,fontSize:18,marginBottom:6,color:t.tx1}}>No cards yet</div>
            <div style={{fontSize:14,marginBottom:20}}>Add your first credit card to start tracking</div>
            <button onClick={()=>setShowForm(true)} style={{background:"#6366f1",border:"none",borderRadius:10,padding:"10px 28px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>+ Add Your First Card</button>
          </div>
        ):(
          <>
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <button onClick={()=>setAllCardsExpanded(e=>!e)} style={{background:t.panelBg,border:`1px solid ${t.border}`,borderRadius:8,padding:"5px 12px",color:t.tx2,cursor:"pointer",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:14}}>{allCardsExpanded?"⊟":"⊞"}</span>{allCardsExpanded?"Collapse All":"Expand All"}
              </button>
            </div>
            {/* 1 col mobile, 2 col tablet, auto-fill desktop */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":isTablet?"repeat(2,1fr)":"repeat(auto-fill,minmax(360px,1fr))",gap:isMobile?10:14}}>
              {cards.map(card=><CardPanel key={card.id} card={card} onEdit={c=>{setEditCard(c);setShowForm(true);}} onDelete={confirmDelete} onQuickPay={c=>setQuickPayCard(c)} darkMode={darkMode} globalExpanded={allCardsExpanded}/>)}
            </div>
          </>
        ))}

        {activeTab==="calendar"&&<CalendarView cards={cards} darkMode={darkMode}/>}
      </div>

      {showForm&&<CardFormModal initial={editCard} onSave={saveCard} onClose={()=>{setShowForm(false);setEditCard(null);}} darkMode={darkMode}/>}
      {showProfile&&<ProfileModal profile={activeProfile} onSave={saveProfile} onClose={()=>setShowProfile(false)} onSwitch={id=>{setActiveProfileId(id);setShowProfile(false);}} allProfiles={profiles} darkMode={darkMode}/>}
      {showSchedule&&<PayoffScheduleModal cards={cards} logsKey={logsKey} darkMode={darkMode} apiKey={apiKey} profileId={activeProfileId||"default"} onClose={()=>setShowSchedule(false)}/>}
      {showApiKey&&<ApiKeyModal currentKey={apiKey} onSave={k=>{setApiKey(k);setShowApiKey(false);}} onClose={()=>setShowApiKey(false)} darkMode={darkMode}/>}
      {showBackup&&<ImportExportModal cards={cards} profile={activeProfile} onImport={handleImport} onClose={()=>setShowBackup(false)} darkMode={darkMode}/>}
      {deleteTarget&&<DeleteConfirm cardName={deleteTarget.name} onConfirm={doDelete} onCancel={()=>setDeleteTarget(null)} darkMode={darkMode}/>}
      {quickPayCard&&<QuickPayModal card={quickPayCard} onConfirm={handleQuickPay} onClose={()=>setQuickPayCard(null)} darkMode={darkMode}/>}
    </div>
  );
}
