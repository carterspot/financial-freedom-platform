// FFP Dashboard v1.0
// modules/dashboard.jsx
import { useState, useEffect } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#6366f1","#ec4899","#f97316","#10b981","#3b82f6","#8b5cf6","#f43f5e","#06b6d4"];
const COLOR = {
  primary:"#6366f1", success:"#10b981", warning:"#f59e0b", danger:"#ef4444",
  pink:"#ec4899", blue:"#3b82f6", orange:"#f97316", purple:"#8b5cf6", cyan:"#06b6d4"
};
const URLS = {
  debt:       "https://carterspot.github.io/financial-freedom-platform/debt/",
  income:     "https://carterspot.github.io/financial-freedom-platform/income/",
  spending:   "https://carterspot.github.io/financial-freedom-platform/spending/",
  savings:    "https://carterspot.github.io/financial-freedom-platform/savings/",
  retirement: "https://carterspot.github.io/financial-freedom-platform/retirement/",
  investment: "https://carterspot.github.io/financial-freedom-platform/investment/",
};

// ─── Storage ─────────────────────────────────────────────────────────────────
let _cloudAvail = null;
async function probeCloud() {
  if (_cloudAvail !== null) return _cloudAvail;
  if (!window?.storage?.get) { _cloudAvail = false; return false; }
  try {
    await Promise.race([
      window.storage.get("__probe__", false),
      new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 2500))
    ]);
    _cloudAvail = true;
  } catch { _cloudAvail = false; }
  return _cloudAvail;
}
async function storeGet(key, shared = false) {
  if (await probeCloud()) {
    try { const r = await window.storage.get(key, shared); return r ? JSON.parse(r.value) : null; }
    catch { _cloudAvail = false; }
  }
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function storeSet(key, value, shared = false) {
  if (await probeCloud()) {
    try { await window.storage.set(key, JSON.stringify(value), shared); return; }
    catch { _cloudAvail = false; }
  }
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ─── API Probe ───────────────────────────────────────────────────────────────
const API_URL = "https://ffp-api-proxy.carterspot.workers.dev/";
async function probeApiKey(key) {
  if (!key?.trim().startsWith("sk-ant-")) return "invalid";
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json","anthropic-version":"2023-06-01","x-api-key": key.trim() },
      body: JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:1, messages:[{role:"user",content:"hi"}] })
    });
    return res.ok ? "valid" : "invalid";
  } catch { return "unknown"; }
}

// ─── Hooks ───────────────────────────────────────────────────────────────────
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

// ─── Pure Helpers ────────────────────────────────────────────────────────────
function fmt$(n) {
  return (parseFloat(n)||0).toLocaleString("en-US", { minimumFractionDigits:0, maximumFractionDigits:0 });
}
function fmtPct(n) { return (parseFloat(n)||0).toFixed(1) + "%"; }

function normalizeMonthly(stream) {
  const amt = parseFloat(stream.amount) || 0;
  switch (stream.frequency) {
    case "Monthly":      return amt;
    case "Bi-weekly":    return amt * 26 / 12;
    case "Weekly":       return amt * 52 / 12;
    case "Semi-monthly":
    case "Bi-monthly":   return amt * 2;
    case "Annual":
    case "Yearly":       return amt / 12;
    case "Quarterly":    return amt / 3;
    default:             return amt;
  }
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr) - new Date()) / 864e5);
}

function calcFreedomScore(dh, ih, sh, savH, rh) {
  return Math.round((dh*30 + ih*20 + sh*20 + savH*20 + rh*10) / 100);
}

function getActiveSpendingMonth(transactions) {
  const months = [...new Set((transactions||[]).map(tx => tx.date?.slice(0,7)).filter(Boolean))].sort();
  return months[months.length-1] || new Date().toISOString().slice(0,7);
}

function getAvatar(profile) {
  if (!profile) return { initials:"?", color:AVATAR_COLORS[0] };
  const name = profile.name || profile.id || "?";
  const initials = name.split(" ").map(w => w[0]||"").join("").toUpperCase().slice(0,2) || "?";
  return { initials, color: profile.avatarColor || AVATAR_COLORS[0] };
}

// ─── NavRing ─────────────────────────────────────────────────────────────────
function NavRing({ health, color, icon }) {
  const sz = 28, cx = 14, cy = 14, r = 13;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(parseFloat(health)||0, 0), 100);
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ position:"relative", width:sz, height:sz, flexShrink:0 }}>
      <svg style={{ position:"absolute", top:0, left:0 }} width={sz} height={sz} viewBox="0 0 28 28">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth="2"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="2"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 14 14)"/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex",
        alignItems:"center", justifyContent:"center", fontSize:14, lineHeight:1 }}>
        {icon}
      </div>
    </div>
  );
}

// ─── StatTile ────────────────────────────────────────────────────────────────
function StatTile({ label, primary, secondary, color, onClick, alt, t }) {
  return (
    <div title={alt} onClick={onClick}
      style={{ background:t.panelBg, border:`1px solid ${t.border}`, borderRadius:12,
        padding:"14px 16px", cursor:onClick?"pointer":"default", transition:"transform .15s" }}
      onMouseEnter={e => { if(onClick) e.currentTarget.style.transform="scale(1.02)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform="scale(1)"; }}>
      {label && (
        <div style={{ fontSize:10, color:t.tx3, fontWeight:600,
          textTransform:"uppercase", letterSpacing:0.8, marginBottom:4 }}>{label}</div>
      )}
      <div style={{ fontSize:20, fontWeight:800, color, fontFamily:"monospace", lineHeight:1.2 }}>{primary}</div>
      {secondary && <div style={{ fontSize:11, color:t.tx2, marginTop:4 }}>{secondary}</div>}
    </div>
  );
}

// ─── AlertCard ───────────────────────────────────────────────────────────────
function AlertCard({ sev, title, body, href, t }) {
  const cols = { red:"#ef4444", amber:"#f59e0b", info:"#3b82f6", success:"#10b981" };
  const bgs  = { red:"rgba(239,68,68,.08)", amber:"rgba(245,158,11,.08)",
                 info:"rgba(59,130,246,.08)", success:"rgba(16,185,129,.08)" };
  const c = cols[sev] || COLOR.primary;
  return (
    <div title="Click to view details" onClick={() => window.open(href, "_blank")}
      style={{ background:bgs[sev]||"transparent", border:`1px solid ${c}40`,
        borderLeft:`3px solid ${c}`, borderRadius:10, padding:"12px 14px",
        cursor:"pointer", transition:"transform .15s" }}
      onMouseEnter={e => { e.currentTarget.style.transform="translateX(3px)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform="translateX(0)"; }}>
      <div style={{ fontSize:13, fontWeight:700, color:c, marginBottom:3 }}>{title}</div>
      <div style={{ fontSize:12, color:t.tx2 }}>{body}</div>
    </div>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────
function EmptyState({ label, url, t }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      gap:8, padding:"20px 16px", color:t.tx3, fontSize:12, textAlign:"center" }}>
      <div>No data yet</div>
      {url && (
        <button onClick={e => { e.stopPropagation(); window.open(url,"_blank"); }}
          style={{ background:"none", border:`1px solid ${t.border2}`, borderRadius:8,
            padding:"4px 12px", color:t.tx2, cursor:"pointer", fontSize:11 }}>
          Launch {label} →
        </button>
      )}
    </div>
  );
}

// ─── FreedomRings ────────────────────────────────────────────────────────────
function FreedomRings({ score, momentumProg, horizonProg, t }) {
  const [hov, setHov] = useState(null);
  const cx = 110, cy = 110;
  const rings = [
    { r:82, color:"#6366f1", pct:score/100,         label:"Score",    detail:`Freedom Score: ${score}`,                 url:URLS.debt },
    { r:64, color:"#10b981", pct:momentumProg/100,  label:"Momentum", detail:`Cash-flow positive: ${Math.round(momentumProg)}%`, url:URLS.spending },
    { r:46, color:"#f59e0b", pct:horizonProg/100,   label:"Horizon",  detail:`Debt payments made: ${Math.round(horizonProg)}%`, url:URLS.debt },
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <div style={{ fontSize:28, fontWeight:800, color:"#6366f1", fontFamily:"monospace" }}>{score}</div>
      <div style={{ fontSize:11, color:t.tx2, marginBottom:4 }}>Freedom Score</div>
      <svg width="220" height="220" viewBox="0 0 220 220">
        {rings.map((ring, i) => {
          const circ = 2 * Math.PI * ring.r;
          const offset = circ - Math.min(ring.pct,1) * circ;
          return (
            <g key={i} style={{ cursor:"pointer" }}
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
              onClick={() => window.open(ring.url,"_blank")}>
              <circle cx={cx} cy={cy} r={ring.r} fill="none" stroke={t.surf} strokeWidth="10"/>
              <circle cx={cx} cy={cy} r={ring.r} fill="none" stroke={ring.color} strokeWidth="10"
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
                opacity={hov !== null && hov !== i ? 0.4 : 1}
                style={{ transition:"opacity .2s" }}/>
            </g>
          );
        })}
        {hov !== null
          ? <text x={cx} y={cy+5} textAnchor="middle" fill={rings[hov].color} fontSize="10" fontWeight="700">
              {rings[hov].detail}
            </text>
          : <text x={cx} y={cy+5} textAnchor="middle" fill={t.tx3} fontSize="9">hover rings · click to open</text>
        }
      </svg>
    </div>
  );
}

// ─── WealthRings ─────────────────────────────────────────────────────────────
function WealthRings({ retirementHealth, t }) {
  const [hov, setHov] = useState(null);
  const cx = 110, cy = 110;
  const rings = [
    { r:82, color:"#10b981", pct:0.8,                   label:"Growth",  detail:"Net worth growing",                       url:URLS.investment },
    { r:64, color:"#06b6d4", pct:0,                     label:"Legacy",  detail:"Insurance coverage — coming soon",         url:null },
    { r:46, color:"#8b5cf6", pct:retirementHealth/100,  label:"Horizon", detail:`Retirement: ${Math.round(retirementHealth)}% to goal`, url:URLS.retirement },
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <div style={{ fontSize:28, fontWeight:800, color:"#10b981", fontFamily:"monospace" }}>100</div>
      <div style={{ fontSize:11, color:t.tx2, marginBottom:4 }}>Wealth Score</div>
      <svg width="220" height="220" viewBox="0 0 220 220">
        {rings.map((ring, i) => {
          const circ = 2 * Math.PI * ring.r;
          const offset = circ - Math.min(ring.pct,1) * circ;
          return (
            <g key={i} style={{ cursor: ring.url ? "pointer" : "default" }}
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
              onClick={() => ring.url && window.open(ring.url,"_blank")}>
              <circle cx={cx} cy={cy} r={ring.r} fill="none" stroke={t.surf} strokeWidth="10"/>
              <circle cx={cx} cy={cy} r={ring.r} fill="none" stroke={ring.color} strokeWidth="10"
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
                opacity={hov !== null && hov !== i ? 0.4 : 1}
                style={{ transition:"opacity .2s" }}/>
            </g>
          );
        })}
        {hov !== null
          ? <text x={cx} y={cy+5} textAnchor="middle" fill={rings[hov].color} fontSize="10" fontWeight="700">
              {rings[hov].detail}
            </text>
          : <text x={cx} y={cy+5} textAnchor="middle" fill={t.tx3} fontSize="9">hover rings · click to open</text>
        }
      </svg>
    </div>
  );
}

// ─── ChartOverBudget ─────────────────────────────────────────────────────────
function ChartOverBudget({ transactions, baseline, t }) {
  if (!transactions.length) return <EmptyState label="SpendingTracker" url={URLS.spending} t={t}/>;
  const activeMonth = getActiveSpendingMonth(transactions);
  const monthTxns = transactions.filter(tx => tx.date?.startsWith(activeMonth));
  const catSpend = {};
  monthTxns.forEach(tx => {
    const cat = tx.categoryId || "Uncategorized";
    catSpend[cat] = (catSpend[cat]||0) + (parseFloat(tx.amount)||0);
  });
  const bdlMap = {};
  (baseline?.breakdown||[]).forEach(b => { bdlMap[b.categoryId] = parseFloat(b.average)||0; });
  const overages = Object.entries(catSpend)
    .map(([cat, spent]) => {
      const avg = bdlMap[cat] || 0;
      const pctOver = avg > 0 ? ((spent - avg) / avg) * 100 : 0;
      return { cat, spent, avg, pctOver };
    })
    .filter(d => d.pctOver > 0)
    .sort((a,b) => b.pctOver - a.pctOver)
    .slice(0, 5);
  if (!overages.length) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
        minHeight:80, color:t.tx2, fontSize:12, textAlign:"center" }}>
        ✓ All categories within budget this month
      </div>
    );
  }
  const maxPct = Math.max(...overages.map(d => d.pctOver), 1);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ fontSize:10, color:t.tx3, fontWeight:600,
        textTransform:"uppercase", letterSpacing:0.5 }}>{activeMonth} · over budget</div>
      {overages.map(d => {
        const barColor = d.pctOver >= 40 ? COLOR.danger : d.pctOver >= 20 ? COLOR.warning : COLOR.primary;
        return (
          <div key={d.cat}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
              <span style={{ fontSize:11, color:t.tx1, fontWeight:600,
                maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {d.cat}
              </span>
              <span style={{ fontSize:11, color:barColor, fontFamily:"monospace" }}>+{fmtPct(d.pctOver)}</span>
            </div>
            <div style={{ height:6, background:t.surf, borderRadius:3, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(d.pctOver/maxPct)*100}%`,
                background:barColor, borderRadius:3 }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ChartIncomeTrend ────────────────────────────────────────────────────────
function ChartIncomeTrend({ streams, t }) {
  if (!streams.length) return <EmptyState label="IncomeTracker" url={URLS.income} t={t}/>;
  const today = new Date();
  const months = [2, 1, 0].map(offset => {
    const d = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    return {
      label:  d.toLocaleString("default", { month:"short" }),
      mStart: d,
      mEnd:   new Date(d.getFullYear(), d.getMonth()+1, 0),
    };
  });
  const totals = months.map(m => ({
    label: m.label,
    total: streams.filter(s => {
      const start = s.startDate ? new Date(s.startDate) : null;
      const end   = s.endDate   ? new Date(s.endDate)   : null;
      if (start && start > m.mEnd)   return false;
      if (end   && end   < m.mStart) return false;
      return true;
    }).reduce((sum, s) => sum + normalizeMonthly(s), 0)
  }));
  const maxVal   = Math.max(...totals.map(m => m.total), 1);
  const curr     = totals[totals.length-1].total;
  const prev     = totals[totals.length-2]?.total || 0;
  const changePct = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
  const svgW = 200, svgH = 60;
  const pts = totals.map((m, i) => ({
    x: i === 0 ? 0 : i === totals.length-1 ? svgW : svgW * i / (totals.length-1),
    y: svgH - (m.total / maxVal) * (svgH - 12) - 6
  }));
  const pathD = pts.map((p,i) => `${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
        <span style={{ fontSize:20, fontWeight:800, color:COLOR.success, fontFamily:"monospace" }}>
          ${fmt$(curr)}<span style={{ fontSize:10, color:t.tx3, fontWeight:400 }}>/mo</span>
        </span>
        <span style={{ fontSize:11, fontWeight:700,
          color:changePct>=0?COLOR.success:COLOR.danger,
          background:changePct>=0?"rgba(16,185,129,.12)":"rgba(239,68,68,.12)",
          padding:"2px 7px", borderRadius:20 }}>
          {changePct>=0?"+":""}{fmtPct(changePct)}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${svgW} ${svgH+12}`} style={{ overflow:"visible" }}>
        <defs>
          <linearGradient id="incGr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLOR.success} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={COLOR.success} stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        <path d={`${pathD} L${pts[pts.length-1].x},${svgH} L0,${svgH} Z`} fill="url(#incGr)"/>
        <path d={pathD} fill="none" stroke={COLOR.success} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={COLOR.success}/>)}
        {totals.map((m,i) => (
          <text key={i} x={pts[i].x} y={svgH+11}
            textAnchor={i===0?"start":i===totals.length-1?"end":"middle"}
            fill={t.tx3} fontSize="9">{m.label}</text>
        ))}
      </svg>
    </div>
  );
}

// ─── ChartDTI ────────────────────────────────────────────────────────────────
function ChartDTI({ cards, loans, monthlyIncome, t }) {
  const debtPmt = [...cards,...loans].reduce((s,d) => s+(parseFloat(d.minimumPayment||d.monthlyPayment)||0), 0);
  const ratio = monthlyIncome > 0 ? debtPmt / monthlyIncome : 0;
  const pct = Math.min(ratio * 100, 100);
  const gaugeColor = pct < 36 ? COLOR.success : pct < 55 ? COLOR.warning : COLOR.danger;
  const cx = 80, cy = 72, r = 58;
  const fillDeg = -180 + pct * 1.8;
  const toRad = d => d * Math.PI / 180;
  const ax = cx + r * Math.cos(toRad(fillDeg));
  const ay = cy + r * Math.sin(toRad(fillDeg));
  const largeArc = pct > 50 ? 1 : 0;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <svg width="160" height="84" viewBox="0 0 160 84">
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
          fill="none" stroke={t.surf} strokeWidth="12" strokeLinecap="round"/>
        {pct > 0.5 && (
          <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${ax} ${ay}`}
            fill="none" stroke={gaugeColor} strokeWidth="12" strokeLinecap="round"/>
        )}
        <text x={cx} y={cy-14} textAnchor="middle" fill={gaugeColor}
          fontSize="20" fontWeight="800" fontFamily="monospace">{fmtPct(pct)}</text>
        <text x={cx} y={cy+2} textAnchor="middle" fill={t.tx3} fontSize="9">DTI Ratio</text>
        <text x={cx-r+2} y={cy+16} fill={t.tx3} fontSize="8">0%</text>
        <text x={cx}     y={cy+16} textAnchor="middle" fill={t.tx3} fontSize="8">36%</text>
        <text x={cx+r-2} y={cy+16} textAnchor="end"    fill={t.tx3} fontSize="8">55%+</text>
      </svg>
      <div style={{ fontSize:11, color:t.tx2, marginTop:4, textAlign:"center" }}>
        ${fmt$(debtPmt)}/mo debt · ${fmt$(monthlyIncome)}/mo income
      </div>
    </div>
  );
}

// ─── ChartSavingsGoals ───────────────────────────────────────────────────────
function ChartSavingsGoals({ goals, t }) {
  if (!goals.length) return <EmptyState label="Savings Module" url={URLS.savings} t={t}/>;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {goals.slice(0,5).map(g => {
        const curr  = parseFloat(g.currentAmount)||0;
        const tgt   = parseFloat(g.targetAmount)||1;
        const pct   = Math.min((curr/tgt)*100, 100);
        const funded = curr >= tgt;
        const days  = g.dueDate ? daysUntil(g.dueDate) : null;
        return (
          <div key={g.id}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
              <span style={{ fontSize:11, color:t.tx1, fontWeight:600, maxWidth:130,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.name}</span>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                {days !== null && days >= 0 && days <= 30 && (
                  <span style={{ fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:10,
                    background:funded?"rgba(16,185,129,.15)":"rgba(245,158,11,.15)",
                    color:funded?COLOR.success:COLOR.warning }}>
                    {funded ? "✓ Ready" : `${days}d`}
                  </span>
                )}
                <span style={{ fontSize:11, color:COLOR.primary, fontFamily:"monospace" }}>{Math.round(pct)}%</span>
              </div>
            </div>
            <div style={{ height:5, background:t.surf, borderRadius:3, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${pct}%`,
                background:funded?COLOR.success:COLOR.primary, borderRadius:3 }}/>
            </div>
            <div style={{ fontSize:9, color:t.tx3, marginTop:2, fontFamily:"monospace" }}>
              ${fmt$(curr)} / ${fmt$(tgt)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ChartRetirementRing ─────────────────────────────────────────────────────
function ChartRetirementRing({ accounts, profile, t }) {
  if (!profile) return <EmptyState label="Retirement Module" url={URLS.retirement} t={t}/>;
  const rateMap = { four_percent:4, three_point_three:3.3, five_percent:5 };
  const rate   = rateMap[profile.lockedPlan] || 4;
  const target = profile.targetMonthlyIncome
    ? (parseFloat(profile.targetMonthlyIncome)*12) / (rate/100) : 0;
  const curr  = accounts.reduce((s,a) => s+(parseFloat(a.currentBalance)||0), 0);
  const pct   = target > 0 ? Math.min((curr/target)*100, 100) : 0;
  const cx = 80, cy = 70, r = 55;
  const fillDeg = -180 + pct * 1.8;
  const toRad = d => d * Math.PI / 180;
  const ax = cx + r * Math.cos(toRad(fillDeg));
  const ay = cy + r * Math.sin(toRad(fillDeg));
  const largeArc = pct > 50 ? 1 : 0;
  const yearsLeft = (profile.retirementAge && profile.currentAge)
    ? profile.retirementAge - profile.currentAge : null;
  const onTrack = pct >= 30;
  return (
    <div>
      <svg width="160" height="78" viewBox="0 0 160 78">
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
          fill="none" stroke={t.surf} strokeWidth="12" strokeLinecap="round"/>
        {pct > 0.5 && (
          <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${ax} ${ay}`}
            fill="none" stroke={COLOR.purple} strokeWidth="12" strokeLinecap="round"/>
        )}
        <text x={cx} y={cy-14} textAnchor="middle" fill={COLOR.purple}
          fontSize="20" fontWeight="800" fontFamily="monospace">{Math.round(pct)}%</text>
        <text x={cx} y={cy+2} textAnchor="middle" fill={t.tx3} fontSize="9">to nest egg goal</text>
      </svg>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:8 }}>
        {[
          { label:"Balance",   value:`$${fmt$(curr)}` },
          { label:"Target",    value: target>0 ? `$${fmt$(target)}` : "Not set" },
          { label:"Years Left",value: yearsLeft !== null ? `${yearsLeft}y` : "—" },
          { label:"Status",    value: onTrack ? "✓ On Track" : "Needs Boost",
            color: onTrack ? COLOR.success : COLOR.warning },
        ].map(s => (
          <div key={s.label} style={{ background:t.surf, borderRadius:8, padding:"6px 8px" }}>
            <div style={{ fontSize:9, color:t.tx3, marginBottom:1 }}>{s.label}</div>
            <div style={{ fontSize:11, fontWeight:700, color:s.color||t.tx1, fontFamily:"monospace" }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ChartWaterfall ──────────────────────────────────────────────────────────
function ChartWaterfall({ transactions, incStreams, cards, loans, t }) {
  const [mode, setMode] = useState("category");
  const today = new Date();
  const activeMonth = getActiveSpendingMonth(transactions);
  const monthTxns   = transactions.filter(tx => tx.date?.startsWith(activeMonth));
  const totalIncome = incStreams.filter(s => {
    const start = s.startDate ? new Date(s.startDate) : null;
    const end   = s.endDate   ? new Date(s.endDate)   : null;
    if (start && start > today) return false;
    if (end   && end   < today) return false;
    return true;
  }).reduce((sum, s) => sum + normalizeMonthly(s), 0);
  const totalSpend  = monthTxns.reduce((s,tx) => s + (parseFloat(tx.amount)||0), 0);
  const net         = totalIncome - totalSpend;
  const catGroups   = {};
  monthTxns.forEach(tx => {
    const cat = tx.categoryId || "Uncategorized";
    catGroups[cat] = (catGroups[cat]||0) + (parseFloat(tx.amount)||0);
  });
  const catEntries = Object.entries(catGroups).sort((a,b) => b[1]-a[1]).slice(0, 5);
  const debtPmt    = [...cards,...loans].reduce((s,d) => s+(parseFloat(d.minimumPayment||d.monthlyPayment)||0), 0);
  const discret    = Math.max(totalSpend - debtPmt, 0);
  const LABEL_W = 90, BAR_MAX = 170, barH = 18, barGap = 5;
  const maxVal  = Math.max(totalIncome, totalSpend, 1);

  const buildSteps = () => {
    if (mode === "category") {
      const steps = [
        { label:"Income",  val:totalIncome, color:COLOR.success },
        ...catEntries.map(([cat,val]) => ({ label:cat, val, color:COLOR.orange })),
        { label:"Net",     val:Math.abs(net), color:net>=0?COLOR.success:COLOR.danger },
      ];
      let runX = 0;
      return steps.map((s,i) => {
        const off = (i===0||i===steps.length-1) ? 0 : runX;
        if (i>0 && i<steps.length-1) runX += s.val/maxVal*BAR_MAX;
        return { ...s, off };
      });
    }
    const steps = [
      { label:"Income",       val:totalIncome,   color:COLOR.success },
      { label:"Debt Pmts",    val:debtPmt,        color:COLOR.danger },
      { label:"Discretionary",val:discret,        color:COLOR.orange },
      { label:"Net",          val:Math.abs(net),  color:net>=0?COLOR.success:COLOR.danger },
    ].filter(s => s.val > 0.01);
    let runX = 0;
    return steps.map((s,i) => {
      const off = (i===0||i===steps.length-1) ? 0 : runX;
      if (i>0 && i<steps.length-1) runX += s.val/maxVal*BAR_MAX;
      return { ...s, off };
    });
  };

  const steps  = buildSteps();
  const svgW   = LABEL_W + BAR_MAX + 60;
  const svgH   = steps.length * (barH+barGap) + 6;

  if (!transactions.length && !incStreams.length) {
    return <EmptyState label="SpendingTracker" url={URLS.spending} t={t}/>;
  }

  return (
    <div>
      <div style={{ display:"flex", gap:4, marginBottom:8 }}>
        {["category","account"].map(m => (
          <button key={m} onClick={e => { e.stopPropagation(); setMode(m); }}
            style={{ background:mode===m?COLOR.primary:t.surf, color:mode===m?"#fff":t.tx2,
              border:"none", borderRadius:6, padding:"2px 10px", fontSize:10, cursor:"pointer",
              fontWeight:mode===m?700:500 }}>
            {m === "category" ? "Category" : "Account"}
          </button>
        ))}
      </div>
      <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`}>
        {steps.map((s, i) => {
          const bw = Math.max(s.val/maxVal*BAR_MAX, 2);
          const bx = LABEL_W + s.off;
          const by = i * (barH+barGap);
          return (
            <g key={i}>
              <text x={LABEL_W-4} y={by+barH/2} textAnchor="end" fill={t.tx2} fontSize="9"
                dominantBaseline="middle">
                {s.label.length>13 ? s.label.slice(0,11)+"…" : s.label}
              </text>
              <rect x={bx} y={by} width={bw} height={barH} fill={s.color} rx="3" opacity="0.85"/>
              <text x={bx+bw+4} y={by+barH/2} fill={t.tx1} fontSize="9"
                dominantBaseline="middle" fontFamily="monospace">
                ${fmt$(s.val)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [darkMode, setDarkMode]           = useState(true);
  const t  = useTheme(darkMode);
  const { isMobile, isTablet }            = useBreakpoint();

  const [profiles, setProfiles]           = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [apiKey, setApiKey]               = useState("");
  const [apiKeyStatus, setApiKeyStatus]   = useState("unknown");
  const [showProfilePanel, setShowProfilePanel] = useState(false);

  const [navPinned, setNavPinned]         = useState(false);
  const [navHovered, setNavHovered]       = useState(false);
  const navExpanded = navPinned || navHovered;

  const [dtCards, setDtCards]             = useState([]);
  const [dtLoans, setDtLoans]             = useState([]);
  const [dtLogs, setDtLogs]               = useState([]);
  const [incStreams, setIncStreams]        = useState([]);
  const [spTransactions, setSpTransactions] = useState([]);
  const [baseline, setBaseline]           = useState(null);
  const [savFunds, setSavFunds]           = useState([]);
  const [savGoals, setSavGoals]           = useState([]);
  const [retAccounts, setRetAccounts]     = useState([]);
  const [retProfile, setRetProfile]       = useState(null);
  const [investments, setInvestments]     = useState(null);
  const [loading, setLoading]             = useState(true);

  async function loadModuleData(id) {
    const [dtC, dtL, dtLg, incS, spTx, bdl, savF, savG, retA, retP, retAss, inv] =
      await Promise.all([
        storeGet(`dt_cards_${id}`, true),
        storeGet(`dt_loans_${id}`, true),
        storeGet(`dt_logs_${id}`, true),
        storeGet(`inc_streams_${id}`, true),
        storeGet(`sp_transactions_${id}`, true),
        storeGet(`ffp_baseline_${id}`, true),
        storeGet(`sav_funds_${id}`, true),
        storeGet(`sav_goals_${id}`, true),
        storeGet(`ret_accounts_${id}`, true),
        storeGet(`ret_profile_${id}`, true),
        storeGet(`ret_assumptions_${id}`, true),
        storeGet(`ffp_investments_${id}`, true),
      ]);
    setDtCards(dtC||[]);      setDtLoans(dtL||[]);      setDtLogs(dtLg||[]);
    setIncStreams(incS||[]);   setSpTransactions(spTx||[]); setBaseline(bdl||null);
    setSavFunds(savF||[]);     setSavGoals(savG||[]);
    setRetAccounts(retA||[]);  setRetProfile(retP||null);
    setInvestments(inv||null);
    setLoading(false);
  }

  useEffect(() => {
    async function boot() {
      const profs = await storeGet("cc_profiles", true) || [];
      const actId = await storeGet("cc_active_profile", true);
      const key   = await storeGet("cc_apikey", true);
      setProfiles(profs);
      if (key) { setApiKey(key); probeApiKey(key).then(setApiKeyStatus); }
      const id = actId || profs[0]?.id || null;
      setActiveProfileId(id);
      const savedDark   = localStorage.getItem("dash_dark");
      if (savedDark !== null) setDarkMode(savedDark === "true");
      const savedPinned = localStorage.getItem("dash_nav_collapsed");
      if (savedPinned === "false") setNavPinned(true);
      if (id) await loadModuleData(id);
      else setLoading(false);
    }
    boot();
  }, []);

  function switchProfile(id) {
    setActiveProfileId(id);
    storeSet("cc_active_profile", id, true);
    setShowProfilePanel(false);
    setDtCards([]); setDtLoans([]); setDtLogs([]);
    setIncStreams([]); setSpTransactions([]); setBaseline(null);
    setSavFunds([]); setSavGoals([]);
    setRetAccounts([]); setRetProfile(null); setInvestments(null);
    setLoading(true);
    loadModuleData(id);
  }

  function toggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("dash_dark", String(next));
  }

  function toggleNav() {
    const next = !navPinned;
    setNavPinned(next);
    setNavHovered(false);
    localStorage.setItem("dash_nav_collapsed", String(!next));
  }

  // ── Computed values ────────────────────────────────────────────────────────
  const today = new Date();

  const origTotal = dtCards.reduce((s,c)=>s+(parseFloat(c.originalBalance)||0),0) +
                    dtLoans.reduce((s,l)=>s+(parseFloat(l.originalBalance)||0),0);
  const currTotal = dtCards.reduce((s,c)=>s+(parseFloat(c.balance)||0),0) +
                    dtLoans.reduce((s,l)=>s+(parseFloat(l.currentBalance)||0),0);
  const debtHealth = origTotal > 0 ? Math.min(((origTotal-currTotal)/origTotal)*100, 100) : 0;

  const stableStreams  = incStreams.filter(s => s.stabilityRating==="Stable"||s.stabilityRating==="Mostly Stable");
  const incomeHealth   = incStreams.length > 0 ? (stableStreams.length/incStreams.length)*100 : 0;
  const monthlyIncome  = incStreams.filter(s => {
    const start = s.startDate ? new Date(s.startDate) : null;
    const end   = s.endDate   ? new Date(s.endDate)   : null;
    if (start && start > today) return false;
    if (end   && end   < today) return false;
    return true;
  }).reduce((sum,s) => sum+normalizeMonthly(s), 0);

  const activeMonth    = getActiveSpendingMonth(spTransactions);
  const thisMonthTxns  = spTransactions.filter(tx => tx.date?.startsWith(activeMonth));
  const thisMonthSpend = thisMonthTxns.reduce((s,tx) => s+(parseFloat(tx.amount)||0), 0);
  const catSpendMap    = {};
  thisMonthTxns.forEach(tx => {
    const c = tx.categoryId||"unc";
    catSpendMap[c] = (catSpendMap[c]||0) + (parseFloat(tx.amount)||0);
  });
  const bdlMap2 = {};
  (baseline?.breakdown||[]).forEach(b => { bdlMap2[b.categoryId] = parseFloat(b.average)||0; });
  const totalCats = Math.max(Object.keys(catSpendMap).length, 1);
  let catsIn = 0;
  Object.entries(catSpendMap).forEach(([cid,spent]) => {
    const avg = bdlMap2[cid];
    if (!avg || spent <= avg) catsIn++;
  });
  const spendingHealth = (catsIn/totalCats)*100;

  const fundedGoals  = savGoals.filter(g => (parseFloat(g.currentAmount)||0) >= (parseFloat(g.targetAmount)||1));
  const savingsHealth = savGoals.length > 0 ? (fundedGoals.length/savGoals.length)*100 : 0;
  const totalSavBal  = savFunds.reduce((s,f) => s+(parseFloat(f.balance)||0), 0);

  const rateMap = { four_percent:4, three_point_three:3.3, five_percent:5 };
  const planRate = rateMap[retProfile?.lockedPlan] || 4;
  const targetNestEgg = retProfile?.targetMonthlyIncome
    ? (parseFloat(retProfile.targetMonthlyIncome)*12) / (planRate/100) : 0;
  const retTotal      = retAccounts.reduce((s,a) => s+(parseFloat(a.currentBalance)||0), 0);
  const retirementHealth = targetNestEgg > 0 ? Math.min((retTotal/targetNestEgg)*100, 100) : 0;

  const invAccts = investments?.accounts || [];
  let invCost = 0, invVal = 0;
  invAccts.forEach(acc => (acc.positions||[]).forEach(p => {
    invCost += (parseFloat(p.costBasis)||0) * (parseFloat(p.shares)||0);
    invVal  += (parseFloat(p.currentPrice)||0) * (parseFloat(p.shares)||0);
  }));
  const gainPct   = invCost > 0 ? ((invVal-invCost)/invCost)*100 : 0;
  const investHealth = Math.min(Math.max(gainPct+50, 0), 100);

  const freedomScore    = calcFreedomScore(debtHealth, incomeHealth, spendingHealth, savingsHealth, retirementHealth);
  const monthlyDebtPmt  = [...dtCards,...dtLoans].reduce((s,d) => s+(parseFloat(d.minimumPayment||d.monthlyPayment)||0), 0);
  const netCashflow     = monthlyIncome - thisMonthSpend - monthlyDebtPmt;
  const momentumProg    = netCashflow > 0 ? Math.min((netCashflow/Math.max(monthlyIncome,1))*300, 100) : 0;
  const currMonthStr    = today.toISOString().slice(0,7);
  const actualPmts      = dtLogs.filter(l => l.date?.startsWith(currMonthStr)).reduce((s,l)=>s+(parseFloat(l.amount)||0),0);
  const horizonProg     = monthlyDebtPmt > 0 ? Math.min((actualPmts/monthlyDebtPmt)*100, 100) : 0;

  const netPosition  = totalSavBal + retTotal - currTotal;
  const emergencyMo  = baseline?.amount && parseFloat(baseline.amount) > 0
    ? (totalSavBal/parseFloat(baseline.amount)).toFixed(1) : null;

  // Alerts
  const allAlerts = [];
  dtCards.forEach(c => {
    if (c.promoEndDate) {
      const d = daysUntil(c.promoEndDate);
      if (d >= 0 && d <= 30) allAlerts.push({
        sev:"red", title:`Promo APR expires in ${d} days`,
        body:`${c.name} 0% ends ${c.promoEndDate} · $${fmt$(c.balance)} remaining`, href:URLS.debt
      });
    }
  });
  const unreviewedCount = spTransactions.filter(tx => tx.needsReview).length;
  if (unreviewedCount > 0) allAlerts.push({
    sev:"amber", title:`${unreviewedCount} transaction${unreviewedCount>1?"s":""} need review`,
    body:"SpendingTracker · categorization pending", href:URLS.spending
  });
  savGoals.forEach(g => {
    if (g.dueDate) {
      const d = daysUntil(g.dueDate);
      if (d >= 0 && d <= 30) {
        const funded = (parseFloat(g.currentAmount)||0) >= (parseFloat(g.targetAmount)||1);
        allAlerts.push({
          sev: funded ? "success" : "amber",
          title: funded ? `${g.name} ready to pay` : `${g.name} due in ${d} days`,
          body: funded ? `$${fmt$(g.targetAmount)} funded ✓` : `$${fmt$(g.targetAmount-g.currentAmount)} short`,
          href: URLS.savings
        });
      }
    }
  });
  if (retProfile?.targetMonthlyIncome && baseline?.amount &&
      parseFloat(retProfile.targetMonthlyIncome) < parseFloat(baseline.amount)) {
    allAlerts.push({
      sev:"info", title:"Retirement target below spending baseline",
      body:`$${fmt$(retProfile.targetMonthlyIncome)}/mo target · $${fmt$(baseline.amount)}/mo essential floor`,
      href:URLS.retirement
    });
  }
  const sevOrd = { red:0, amber:1, info:2, success:3 };
  const alerts = allAlerts.sort((a,b) => sevOrd[a.sev]-sevOrd[b.sev]).slice(0,4);

  // Nav
  const activeProfile = profiles.find(p => p.id===activeProfileId) || profiles[0];
  const { initials:avInit, color:avColor } = getAvatar(activeProfile);
  const apiDot = { valid:"#10b981", invalid:"#ef4444", unknown:"#f59e0b",
                   ok:"#10b981", error:"#ef4444" }[apiKeyStatus] || "#f59e0b";
  const navModules = [
    { icon:"⚡",  label:"Debt",       color:"#ef4444", health:debtHealth,       amount:currTotal,  url:URLS.debt },
    { icon:"💰",  label:"Income",     color:"#10b981", health:incomeHealth,     amount:monthlyIncome, url:URLS.income },
    { icon:"📊",  label:"Spending",   color:"#f97316", health:spendingHealth,   amount:thisMonthSpend, url:URLS.spending },
    { icon:"🏦",  label:"Savings",    color:"#6366f1", health:savingsHealth,    amount:totalSavBal, url:URLS.savings },
    { icon:"📈",  label:"Retirement", color:"#8b5cf6", health:retirementHealth, amount:retTotal,   url:URLS.retirement },
    { icon:"🛡️", label:"Insurance",  color:"#06b6d4", health:0,                amount:null,       url:null, soon:true },
    { icon:"💹",  label:"Investments",color:"#3b82f6", health:investHealth,    amount:invVal>0?invVal:null, url:URLS.investment },
  ];

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight:"100vh", background:t.bg, display:"flex",
        alignItems:"center", justifyContent:"center",
        fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
        <div style={{ color:t.tx2, fontSize:14 }}>Loading dashboard…</div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:t.bg,
      fontFamily:"'DM Sans','Segoe UI',sans-serif", color:t.tx1 }}
      onClick={() => showProfilePanel && setShowProfilePanel(false)}>

      {/* Top Nav Bar */}
      <div style={{ background:t.deepBg, borderBottom:`1px solid ${t.border}`,
        padding:"10px 20px", display:"flex", justifyContent:"space-between", alignItems:"center",
        position:"sticky", top:0, zIndex:200 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:20 }}>🏠</span>
          <span style={{ fontWeight:800, fontSize:15 }}>Financial Freedom</span>
          <span style={{ fontSize:11, color:t.tx3 }}>· Dashboard</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={toggleDark}
            style={{ background:"none", border:"none", cursor:"pointer",
              fontSize:16, color:t.tx2, padding:"2px 6px" }}
            title="Toggle dark mode">
            {darkMode ? "☀️" : "🌙"}
          </button>
          <span style={{ width:8, height:8, borderRadius:"50%", background:apiDot, display:"inline-block" }}
            title={`API Key: ${apiKeyStatus}`}/>
          {activeProfile && (
            <div style={{ position:"relative" }} onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowProfilePanel(p => !p)}
                style={{ width:32, height:32, borderRadius:"50%", background:avColor, border:"none",
                  color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                {avInit}
              </button>
              {showProfilePanel && (
                <div style={{ position:"absolute", right:0, top:40, background:t.panelBg,
                  border:`1px solid ${t.border}`, borderRadius:12, minWidth:200, zIndex:300,
                  padding:8, boxShadow:"0 8px 32px rgba(0,0,0,.5)" }}>
                  <div style={{ fontSize:10, color:t.tx3, fontWeight:600,
                    textTransform:"uppercase", letterSpacing:0.8, padding:"4px 8px 8px" }}>
                    Switch Profile
                  </div>
                  {profiles.map(p => {
                    const av = getAvatar(p);
                    return (
                      <button key={p.id} onClick={() => switchProfile(p.id)}
                        style={{ display:"flex", alignItems:"center", gap:8, width:"100%",
                          background:p.id===activeProfileId?t.surf:"none", border:"none",
                          borderRadius:8, padding:"8px 10px", color:t.tx1, cursor:"pointer",
                          fontSize:12, textAlign:"left" }}>
                        <div style={{ width:24, height:24, borderRadius:"50%", background:av.color,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          color:"#fff", fontSize:10, fontWeight:700, flexShrink:0 }}>
                          {av.initials}
                        </div>
                        <span style={{ flex:1 }}>{p.name||p.id}</span>
                        {p.id===activeProfileId && <span style={{ color:t.tx3 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body: sidebar + main */}
      <div style={{ display:"flex" }}>
        {/* Sidebar */}
        {!isMobile && (
          <div
            style={{ width:navExpanded?200:52, flexShrink:0, background:t.deepBg,
              borderRight:`1px solid ${t.border}`, transition:"width .2s ease",
              overflow:"hidden", display:"flex", flexDirection:"column",
              position:"sticky", top:54, height:"calc(100vh - 54px)", overflowY:"auto" }}
            onMouseEnter={() => setNavHovered(true)}
            onMouseLeave={() => setNavHovered(false)}>
            <button onClick={toggleNav}
              style={{ background:"none", border:"none", cursor:"pointer",
                padding:"12px 14px", color:t.tx3, fontSize:14, textAlign:"left", flexShrink:0 }}
              title={navPinned ? "Unpin sidebar" : "Pin sidebar open"}>
              {navPinned ? "◀" : "▶"}
            </button>
            <div style={{ flex:1, display:"flex", flexDirection:"column", gap:2, padding:"4px 8px" }}>
              {navModules.map(mod => (
                <div key={mod.label}
                  title={mod.soon ? `${mod.label} — Coming soon` : `Open ${mod.label}`}
                  onClick={() => mod.url && window.open(mod.url,"_blank")}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 6px",
                    borderRadius:8, cursor:mod.url?"pointer":"default",
                    opacity:mod.soon?0.4:1, transition:"background .15s", whiteSpace:"nowrap" }}
                  onMouseEnter={e => { if(mod.url) e.currentTarget.style.background=t.surf; }}
                  onMouseLeave={e => { e.currentTarget.style.background="none"; }}>
                  <NavRing health={mod.health} color={mod.color} icon={mod.icon}/>
                  {navExpanded && (
                    <>
                      <span style={{ fontSize:12, color:t.tx1, fontWeight:600, flex:1 }}>
                        {mod.label}
                        {mod.soon && <span style={{ fontSize:9, color:t.tx3, marginLeft:4 }}>soon</span>}
                      </span>
                      {mod.amount !== null && mod.amount !== undefined && !mod.soon && (
                        <span style={{ fontSize:11, color:mod.color, fontFamily:"monospace", fontWeight:700 }}>
                          ${fmt$(mod.amount)}
                        </span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div style={{ flex:1, padding:isMobile?"12px":"20px", minWidth:0, overflowX:"hidden" }}>
          {!activeProfileId ? (
            <div style={{ textAlign:"center", padding:60, color:t.tx2 }}>
              <div style={{ fontSize:32, marginBottom:12 }}>👋</div>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:8, color:t.tx1 }}>
                Welcome to the Dashboard
              </div>
              <div style={{ fontSize:13 }}>Set up a profile in any module to get started.</div>
            </div>
          ) : (
            <>
              {/* Row 1: Freedom Rings + flanking stat tiles */}
              <div style={{ display:"grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr auto 1fr",
                gap:16, marginBottom:16, alignItems:"start" }}>

                {/* Left tiles */}
                {!isMobile && (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    <StatTile label="Net Position"
                      primary={`${netPosition>=0?"+":"-"}$${fmt$(Math.abs(netPosition))}`}
                      secondary="savings + retirement − total debt"
                      color={netPosition>=0?COLOR.success:COLOR.danger}
                      onClick={() => window.open(URLS.debt,"_blank")}
                      alt="Click to view Debt Tracker" t={t}/>
                    <StatTile label="Monthly Income"
                      primary={`$${fmt$(monthlyIncome)}/mo`}
                      secondary={`${incStreams.length} active stream${incStreams.length!==1?"s":""}`}
                      color={COLOR.success}
                      onClick={() => window.open(URLS.income,"_blank")}
                      alt="Click to view Income Tracker" t={t}/>
                  </div>
                )}

                {/* Center: rings + baseline */}
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
                  {freedomScore >= 100
                    ? <WealthRings retirementHealth={retirementHealth} t={t}/>
                    : <FreedomRings score={freedomScore} momentumProg={momentumProg} horizonProg={horizonProg} t={t}/>
                  }
                  <div style={{ background:t.panelBg, border:`1px solid ${t.border}`,
                    borderRadius:12, padding:"12px 16px", width:"100%", boxSizing:"border-box" }}>
                    <div style={{ fontSize:9, color:t.tx3, fontWeight:600,
                      textTransform:"uppercase", letterSpacing:0.8, marginBottom:4 }}>
                      Essential Monthly Expenses
                    </div>
                    {baseline ? (
                      <div>
                        <div style={{ fontSize:18, fontWeight:800, color:COLOR.warning, fontFamily:"monospace" }}>
                          ${fmt$(baseline.amount)}
                          <span style={{ fontSize:10, color:t.tx3, fontWeight:400 }}>/mo</span>
                        </div>
                        <div style={{ fontSize:11, color:t.tx2, marginTop:2 }}>
                          income covers baseline ×{monthlyIncome > 0
                            ? (monthlyIncome/parseFloat(baseline.amount)).toFixed(1) : "—"}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize:11, color:t.tx3 }}>
                        — Run SpendingTracker to calculate
                      </div>
                    )}
                  </div>
                </div>

                {/* Right tiles */}
                {!isMobile && (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    <StatTile label="Total Debt"
                      primary={`$${fmt$(currTotal)}`}
                      secondary={origTotal > 0
                        ? `${fmtPct((origTotal-currTotal)/origTotal*100)} paid off`
                        : "No debt tracked"}
                      color={currTotal < origTotal ? COLOR.success : COLOR.danger}
                      onClick={() => window.open(URLS.debt,"_blank")}
                      alt="Click to view Debt Tracker" t={t}/>
                    <StatTile label="Savings Goals"
                      primary={`${fundedGoals.length} of ${savGoals.length} funded`}
                      secondary={emergencyMo ? `${emergencyMo}mo emergency coverage` : "No savings data"}
                      color={COLOR.primary}
                      onClick={() => window.open(URLS.savings,"_blank")}
                      alt="Click to view Savings Module" t={t}/>
                  </div>
                )}
              </div>

              {/* Mobile stat tiles */}
              {isMobile && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
                  <StatTile label="Net Position"
                    primary={`${netPosition>=0?"+":"-"}$${fmt$(Math.abs(netPosition))}`}
                    color={netPosition>=0?COLOR.success:COLOR.danger}
                    onClick={() => window.open(URLS.debt,"_blank")} alt="" t={t}/>
                  <StatTile label="Income"
                    primary={`$${fmt$(monthlyIncome)}/mo`}
                    color={COLOR.success}
                    onClick={() => window.open(URLS.income,"_blank")} alt="" t={t}/>
                  <StatTile label="Total Debt"
                    primary={`$${fmt$(currTotal)}`}
                    color={COLOR.danger}
                    onClick={() => window.open(URLS.debt,"_blank")} alt="" t={t}/>
                  <StatTile label="Savings"
                    primary={`${fundedGoals.length}/${savGoals.length} goals`}
                    color={COLOR.primary}
                    onClick={() => window.open(URLS.savings,"_blank")} alt="" t={t}/>
                </div>
              )}

              {/* Row 2: Alerts */}
              {alerts.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10, color:t.tx3, fontWeight:700,
                    textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Alerts</div>
                  <div style={{ display:"grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:10 }}>
                    {alerts.map((a,i) => <AlertCard key={i} {...a} t={t}/>)}
                  </div>
                </div>
              )}

              {/* Row 3: Charts */}
              <div style={{ fontSize:10, color:t.tx3, fontWeight:700,
                textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>Analytics</div>
              <div style={{ display:"grid",
                gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr",
                gap:14 }}>

                {/* Chart 1: Over Budget */}
                <div style={{ background:t.panelBg, border:`1px solid ${t.border}`,
                  borderRadius:14, padding:"14px 16px", cursor:"pointer" }}
                  onClick={() => window.open(URLS.spending,"_blank")}
                  title="Click to view SpendingTracker">
                  <div style={{ fontSize:12, fontWeight:700, marginBottom:10 }}>📊 Over Budget</div>
                  <ChartOverBudget transactions={spTransactions} baseline={baseline} t={t}/>
                </div>

                {/* Chart 2: Income Trend */}
                <div style={{ background:t.panelBg, border:`1px solid ${t.border}`,
                  borderRadius:14, padding:"14px 16px", cursor:"pointer" }}
                  onClick={() => window.open(URLS.income,"_blank")}
                  title="Click to view IncomeTracker">
                  <div style={{ fontSize:12, fontWeight:700, marginBottom:10 }}>💰 Income Trend</div>
                  <ChartIncomeTrend streams={incStreams} t={t}/>
                </div>

                {/* Chart 3: DTI Gauge */}
                <div style={{ background:t.panelBg, border:`1px solid ${t.border}`,
                  borderRadius:14, padding:"14px 16px", cursor:"pointer" }}
                  onClick={() => window.open(URLS.debt,"_blank")}
                  title="Click to view Debt Tracker">
                  <div style={{ fontSize:12, fontWeight:700, marginBottom:10 }}>⚖️ Debt-to-Income</div>
                  <ChartDTI cards={dtCards} loans={dtLoans} monthlyIncome={monthlyIncome} t={t}/>
                </div>

                {/* Chart 4: Savings Goals */}
                <div style={{ background:t.panelBg, border:`1px solid ${t.border}`,
                  borderRadius:14, padding:"14px 16px", cursor:"pointer" }}
                  onClick={() => window.open(URLS.savings,"_blank")}
                  title="Click to view Savings Module">
                  <div style={{ fontSize:12, fontWeight:700, marginBottom:10 }}>🏦 Savings Goals</div>
                  <ChartSavingsGoals goals={savGoals} t={t}/>
                </div>

                {/* Chart 5: Retirement Ring */}
                <div style={{ background:t.panelBg, border:`1px solid ${t.border}`,
                  borderRadius:14, padding:"14px 16px", cursor:"pointer" }}
                  onClick={() => window.open(URLS.retirement,"_blank")}
                  title="Click to view Retirement Module">
                  <div style={{ fontSize:12, fontWeight:700, marginBottom:10 }}>📈 Retirement Progress</div>
                  <ChartRetirementRing accounts={retAccounts} profile={retProfile} t={t}/>
                </div>

                {/* Chart 6: Monthly P&L Waterfall */}
                <div style={{ background:t.panelBg, border:`1px solid ${t.border}`,
                  borderRadius:14, padding:"14px 16px", cursor:"pointer" }}
                  onClick={() => window.open(URLS.spending,"_blank")}
                  title="Click to view SpendingTracker">
                  <div style={{ fontSize:12, fontWeight:700, marginBottom:10 }}>🌊 Monthly P&L</div>
                  <ChartWaterfall
                    transactions={spTransactions} incStreams={incStreams}
                    cards={dtCards} loans={dtLoans} t={t}/>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
