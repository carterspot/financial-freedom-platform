// InvestmentModule v1.0
import { useState, useEffect } from "react";

// --- Constants ---------------------------------------------------------------
const ACCENT = "#3b82f6";
const COLOR = {
  success: "#10b981",
  danger:  "#ef4444",
  warning: "#f59e0b",
  purple:  "#8b5cf6",
  teal:    "#06b6d4",
};
const ACCOUNT_COLORS = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#ec4899","#06b6d4","#f97316"];
const CHART_COLORS   = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#ec4899","#06b6d4","#f97316"];
const ACCOUNT_TYPES  = [
  { id:"brokerage",  label:"Taxable Brokerage" },
  { id:"individual", label:"Individual Stocks" },
  { id:"etf",        label:"ETF Account" },
  { id:"mutual",     label:"Mutual Fund Account" },
];
const ASSET_TYPES = [
  { id:"stock",       label:"Stock" },
  { id:"etf",         label:"ETF" },
  { id:"mutual_fund", label:"Mutual Fund" },
];

// --- Helpers -----------------------------------------------------------------
const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const fmt$       = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);
const fmtPct     = n => ((n||0) >= 0 ? "+" : "") + (n||0).toFixed(2) + "%";

function calcPosition(pos) {
  const shares   = parseFloat(pos.shares)       || 0;
  const cost     = parseFloat(pos.avgCostBasis)  || 0;
  const price    = parseFloat(pos.currentPrice)  || 0;
  const invested = shares * cost;
  const value    = shares * price;
  const gain     = value - invested;
  const gainPct  = invested > 0 ? (gain / invested) * 100 : 0;
  return { ...pos, currentValue: value, unrealizedGain: gain, unrealizedGainPct: gainPct };
}

function daysSince(isoStr) {
  if (!isoStr) return null;
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / 86400000);
}

function staleLabel(isoStr) {
  const d = daysSince(isoStr);
  if (d === null) return "never updated";
  if (d === 0)    return "updated today";
  if (d === 1)    return "updated yesterday";
  return `updated ${d} days ago`;
}

// --- Storage -----------------------------------------------------------------
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

// --- Theme -------------------------------------------------------------------
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
  const [w, setW] = useState(() => typeof window !== "undefined" ? window.innerWidth : 960);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 640, isTablet: w < 960, isDesktop: w >= 960 };
}

// --- Style helpers -----------------------------------------------------------
function inputStyle(t) {
  return { width:"100%", background:t.surf, border:`1px solid ${t.border}`,
    borderRadius:8, padding:"8px 12px", color:t.tx1, fontSize:13,
    boxSizing:"border-box", outline:"none" };
}
function labelSt(t) {
  return { fontSize:11, color:t.tx2, display:"block", marginBottom:4, fontWeight:600 };
}
function btnPrimary(extra={}) {
  return { background:ACCENT, border:"none", borderRadius:10, padding:"9px 18px",
    color:"#fff", cursor:"pointer", fontWeight:700, fontSize:13, transition:"all .2s", ...extra };
}
function btnGhost(t, extra={}) {
  return { background:t.surf, border:`1px solid ${t.border}`, borderRadius:10, padding:"9px 16px",
    color:t.tx1, cursor:"pointer", fontWeight:600, fontSize:13, transition:"all .15s", ...extra };
}
function tabBtn(active, t) {
  return { background:active?ACCENT:t.surf, color:active?"#fff":t.tx2,
    border:`1px solid ${active?ACCENT:t.border}`, borderRadius:8,
    padding:"7px 16px", cursor:"pointer", fontWeight:600, fontSize:13,
    whiteSpace:"nowrap", transition:"all .15s" };
}
function panelSt(t, extra={}) {
  return { background:t.panelBg, border:`1px solid ${t.border}`, borderRadius:16,
    padding:"16px 20px", ...extra };
}
function overlayContainer(t, maxW=460) {
  return {
    overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,.72)", zIndex:2000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16, overflowY:"auto" },
    box: { background:t.panelBg, borderRadius:20, width:"100%", maxWidth:maxW,
      padding:24, boxShadow:"0 20px 60px rgba(0,0,0,.5)", maxHeight:"90vh", overflowY:"auto" },
  };
}

// --- ConfirmModal ------------------------------------------------------------
function ConfirmModal({ open, onClose, onConfirm, title, message, t }) {
  if (!open) return null;
  const oc = overlayContainer(t, 380);
  return (
    <div style={oc.overlay} onClick={onClose}>
      <div style={oc.box} onClick={e => e.stopPropagation()}>
        <div style={{fontWeight:700, fontSize:16, color:t.tx1, marginBottom:10}}>{title}</div>
        <div style={{fontSize:13, color:t.tx2, marginBottom:20, lineHeight:1.6}}>{message}</div>
        <div style={{display:"flex", gap:10, justifyContent:"flex-end"}}>
          <button onClick={onClose} style={btnGhost(t)}>Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }}
            style={{...btnPrimary(), background:COLOR.danger}}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// --- ApiKeyPanel -------------------------------------------------------------
function ApiKeyPanel({ open, onClose, apiKey, onSave, t }) {
  const [val,  setVal]  = useState(apiKey || "");
  const [show, setShow] = useState(false);
  useEffect(() => { if (open) setVal(apiKey || ""); }, [open, apiKey]);
  if (!open) return null;
  const oc = overlayContainer(t, 420);
  return (
    <div style={oc.overlay} onClick={onClose}>
      <div style={oc.box} onClick={e => e.stopPropagation()}>
        <div style={{fontWeight:700, fontSize:16, color:t.tx1, marginBottom:16}}>API Key</div>
        <div style={{display:"flex", gap:8, marginBottom:6}}>
          <input type={show?"text":"password"} value={val}
            onChange={e => setVal(e.target.value)}
            placeholder="sk-ant-..." style={inputStyle(t)} />
          <button onClick={() => setShow(s => !s)}
            style={btnGhost(t, {padding:"8px 12px", flexShrink:0})}>
            {show?"Hide":"Show"}
          </button>
        </div>
        <div style={{fontSize:11, color:t.tx3, marginBottom:20}}>
          Shared across all Financial Freedom Platform modules.
        </div>
        <div style={{display:"flex", gap:10, justifyContent:"flex-end"}}>
          <button onClick={onClose} style={btnGhost(t)}>Cancel</button>
          <button onClick={() => { onSave(val.trim()); onClose(); }} style={btnPrimary()}>Save</button>
        </div>
      </div>
    </div>
  );
}

// --- ProfilePanel ------------------------------------------------------------
function ProfilePanel({ open, onClose, profiles, activeProfile, onSwitch, t }) {
  if (!open) return null;
  const oc = overlayContainer(t, 360);
  return (
    <div style={oc.overlay} onClick={onClose}>
      <div style={oc.box} onClick={e => e.stopPropagation()}>
        <div style={{fontWeight:700, fontSize:16, color:t.tx1, marginBottom:16}}>Switch Profile</div>
        {profiles.length === 0 ? (
          <div style={{fontSize:13, color:t.tx3, textAlign:"center", padding:"16px 0"}}>
            No profiles found.
          </div>
        ) : (
          profiles.map(p => (
            <div key={p.id} onClick={() => { onSwitch(p.id); onClose(); }}
              style={{display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
                borderRadius:10, cursor:"pointer", marginBottom:6,
                background:p.id===activeProfile?.id ? ACCENT+"18" : t.surf,
                border:`1px solid ${p.id===activeProfile?.id ? ACCENT+"44" : t.border}`}}>
              <div style={{width:32, height:32, borderRadius:8,
                background:p.color||ACCENT, display:"flex", alignItems:"center",
                justifyContent:"center", color:"#fff", fontWeight:700, fontSize:14}}>
                {(p.name||"?")[0].toUpperCase()}
              </div>
              <span style={{fontSize:13, fontWeight:600, color:t.tx1, flex:1}}>{p.name}</span>
              {p.id === activeProfile?.id && (
                <span style={{fontSize:11, color:ACCENT, fontWeight:600}}>Active</span>
              )}
            </div>
          ))
        )}
        <button onClick={onClose} style={{...btnGhost(t), width:"100%", marginTop:8}}>Close</button>
      </div>
    </div>
  );
}

// --- AddAccountModal ---------------------------------------------------------
function AddAccountModal({ open, onClose, onSave, t }) {
  const [name,  setName]  = useState("");
  const [type,  setType]  = useState("brokerage");
  const [color, setColor] = useState(ACCOUNT_COLORS[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) { setName(""); setType("brokerage"); setColor(ACCOUNT_COLORS[0]); setNotes(""); }
  }, [open]);

  if (!open) return null;
  const oc = overlayContainer(t);

  function handleSave() {
    if (!name.trim()) return;
    onSave({ id:"inv_acct_"+generateId(), name:name.trim(), type, color, notes });
    onClose();
  }

  return (
    <div style={oc.overlay} onClick={onClose}>
      <div style={oc.box} onClick={e => e.stopPropagation()}>
        <div style={{fontWeight:700, fontSize:16, color:t.tx1, marginBottom:16}}>Add Account</div>
        <div style={{display:"flex", flexDirection:"column", gap:12}}>
          <div>
            <label style={labelSt(t)}>Account Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Fidelity Brokerage" style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>Account Type</label>
            <select value={type} onChange={e => setType(e.target.value)} style={inputStyle(t)}>
              {ACCOUNT_TYPES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt(t)}>Color</label>
            <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
              {ACCOUNT_COLORS.map(c => (
                <div key={c} onClick={() => setColor(c)}
                  style={{width:28, height:28, borderRadius:8, background:c, cursor:"pointer",
                    boxSizing:"border-box",
                    border:color===c?"3px solid #fff":"3px solid transparent",
                    outline:color===c?`2px solid ${c}`:""}} />
              ))}
            </div>
          </div>
          <div>
            <label style={labelSt(t)}>Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional" style={inputStyle(t)} />
          </div>
        </div>
        <div style={{display:"flex", gap:10, justifyContent:"flex-end", marginTop:20}}>
          <button onClick={onClose} style={btnGhost(t)}>Cancel</button>
          <button onClick={handleSave} style={btnPrimary()} disabled={!name.trim()}>
            Add Account
          </button>
        </div>
      </div>
    </div>
  );
}

// --- AddPositionModal --------------------------------------------------------
function AddPositionModal({ open, onClose, accountId, onSave, t }) {
  const [ticker,       setTicker]       = useState("");
  const [name,         setName]         = useState("");
  const [assetType,    setAssetType]    = useState("stock");
  const [shares,       setShares]       = useState("");
  const [avgCostBasis, setAvgCostBasis] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [notes,        setNotes]        = useState("");

  useEffect(() => {
    if (open) {
      setTicker(""); setName(""); setAssetType("stock");
      setShares(""); setAvgCostBasis(""); setCurrentPrice(""); setNotes("");
    }
  }, [open]);

  if (!open) return null;
  const oc = overlayContainer(t, 500);

  function handleSave() {
    if (!ticker.trim() || !shares || !avgCostBasis) return;
    const price = currentPrice || avgCostBasis;
    const now   = new Date().toISOString();
    onSave({
      id: "inv_pos_"+generateId(),
      accountId,
      ticker:          ticker.trim().toUpperCase(),
      name:            name.trim() || ticker.trim().toUpperCase(),
      assetType,       shares,
      avgCostBasis,    currentPrice: price,
      notes,           lastPriceUpdate: now,
      priceSource:     "manual",
    });
    onClose();
  }

  return (
    <div style={oc.overlay} onClick={onClose}>
      <div style={oc.box} onClick={e => e.stopPropagation()}>
        <div style={{fontWeight:700, fontSize:16, color:t.tx1, marginBottom:16}}>Add Position</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
          <div>
            <label style={labelSt(t)}>Ticker *</label>
            <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL" style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>Asset Type</label>
            <select value={assetType} onChange={e => setAssetType(e.target.value)} style={inputStyle(t)}>
              {ASSET_TYPES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={labelSt(t)}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Apple Inc." style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>Shares *</label>
            <input type="number" value={shares} onChange={e => setShares(e.target.value)}
              placeholder="10" min="0" step="any" style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>Avg Cost Basis ($) *</label>
            <input type="number" value={avgCostBasis} onChange={e => setAvgCostBasis(e.target.value)}
              placeholder="150.00" min="0" step="any" style={inputStyle(t)} />
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={labelSt(t)}>Current Price ($)</label>
            <input type="number" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)}
              placeholder="Leave blank to use cost basis" min="0" step="any" style={inputStyle(t)} />
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={labelSt(t)}>Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional" style={inputStyle(t)} />
          </div>
        </div>
        <div style={{display:"flex", gap:10, justifyContent:"flex-end", marginTop:20}}>
          <button onClick={onClose} style={btnGhost(t)}>Cancel</button>
          <button onClick={handleSave} style={btnPrimary()}
            disabled={!ticker.trim()||!shares||!avgCostBasis}>Add Position</button>
        </div>
      </div>
    </div>
  );
}

// --- EditPositionModal -------------------------------------------------------
function EditPositionModal({ open, onClose, position, onSave, t }) {
  const [ticker,       setTicker]       = useState("");
  const [name,         setName]         = useState("");
  const [assetType,    setAssetType]    = useState("stock");
  const [shares,       setShares]       = useState("");
  const [avgCostBasis, setAvgCostBasis] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [notes,        setNotes]        = useState("");

  useEffect(() => {
    if (open && position) {
      setTicker(position.ticker||"");
      setName(position.name||"");
      setAssetType(position.assetType||"stock");
      setShares(position.shares||"");
      setAvgCostBasis(position.avgCostBasis||"");
      setCurrentPrice(position.currentPrice||"");
      setNotes(position.notes||"");
    }
  }, [open, position]);

  if (!open || !position) return null;
  const oc = overlayContainer(t, 500);

  function handleSave() {
    if (!ticker.trim() || !shares || !avgCostBasis) return;
    onSave({
      ...position,
      ticker:       ticker.trim().toUpperCase(),
      name:         name.trim() || ticker.trim().toUpperCase(),
      assetType,    shares, avgCostBasis,
      currentPrice: currentPrice || avgCostBasis,
      notes,
    });
    onClose();
  }

  return (
    <div style={oc.overlay} onClick={onClose}>
      <div style={oc.box} onClick={e => e.stopPropagation()}>
        <div style={{fontWeight:700, fontSize:16, color:t.tx1, marginBottom:16}}>Edit Position</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
          <div>
            <label style={labelSt(t)}>Ticker *</label>
            <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>Asset Type</label>
            <select value={assetType} onChange={e => setAssetType(e.target.value)} style={inputStyle(t)}>
              {ASSET_TYPES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={labelSt(t)}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>Shares *</label>
            <input type="number" value={shares} onChange={e => setShares(e.target.value)}
              min="0" step="any" style={inputStyle(t)} />
          </div>
          <div>
            <label style={labelSt(t)}>Avg Cost Basis ($) *</label>
            <input type="number" value={avgCostBasis} onChange={e => setAvgCostBasis(e.target.value)}
              min="0" step="any" style={inputStyle(t)} />
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={labelSt(t)}>Current Price ($)</label>
            <input type="number" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)}
              min="0" step="any" style={inputStyle(t)} />
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={labelSt(t)}>Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle(t)} />
          </div>
        </div>
        <div style={{display:"flex", gap:10, justifyContent:"flex-end", marginTop:20}}>
          <button onClick={onClose} style={btnGhost(t)}>Cancel</button>
          <button onClick={handleSave} style={btnPrimary()}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// --- DividendModal -----------------------------------------------------------
function DividendModal({ open, onClose, position, dividends, onAdd, onDelete, t }) {
  const [divTab,      setDivTab]      = useState("log");
  const [date,        setDate]        = useState("");
  const [amount,      setAmount]      = useState("");
  const [notes,       setNotes]       = useState("");
  const [confirmDivDel, setConfirmDivDel] = useState(null);

  useEffect(() => {
    if (open) { setDivTab("log"); setDate(""); setAmount(""); setNotes(""); }
  }, [open]);

  if (!open || !position) return null;
  const oc = overlayContainer(t, 500);

  const posDivs = (dividends||[])
    .filter(d => d.positionId === position.id)
    .sort((a,b) => b.date.localeCompare(a.date));

  const yearStr    = new Date().getFullYear().toString();
  const annualTotal = posDivs
    .filter(d => d.date?.startsWith(yearStr))
    .reduce((s,d) => s + (parseFloat(d.amount)||0), 0);

  function handleAdd() {
    if (!date || !amount) return;
    onAdd({ id:"inv_div_"+generateId(), positionId:position.id,
      date, amount:parseFloat(amount), notes });
    setDate(""); setAmount(""); setNotes("");
  }

  return (
    <>
      <div style={oc.overlay} onClick={onClose}>
        <div style={oc.box} onClick={e => e.stopPropagation()}>
          <div style={{fontWeight:700, fontSize:16, color:t.tx1, marginBottom:4}}>
            💰 Dividends — {position.ticker}
          </div>
          <div style={{fontSize:12, color:t.tx2, marginBottom:14}}>{position.name}</div>

          <div style={{display:"flex", gap:8, marginBottom:16}}>
            <button onClick={() => setDivTab("log")} style={tabBtn(divTab==="log", t)}>
              Log Dividend
            </button>
            <button onClick={() => setDivTab("history")} style={tabBtn(divTab==="history", t)}>
              History ({posDivs.length})
            </button>
          </div>

          {divTab === "log" && (
            <div style={{display:"flex", flexDirection:"column", gap:12}}>
              <div>
                <label style={labelSt(t)}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Amount ($)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="42.50" min="0" step="0.01" style={inputStyle(t)} />
              </div>
              <div>
                <label style={labelSt(t)}>Notes</label>
                <input value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Q1 dividend" style={inputStyle(t)} />
              </div>
              <button onClick={handleAdd} disabled={!date||!amount} style={btnPrimary()}>
                Add Dividend
              </button>
            </div>
          )}

          {divTab === "history" && (
            <div>
              {posDivs.length === 0 ? (
                <div style={{fontSize:13, color:t.tx3, textAlign:"center", padding:"20px 0"}}>
                  No dividends logged yet.
                </div>
              ) : (
                <>
                  <div style={{display:"flex", flexDirection:"column", gap:6}}>
                    {posDivs.map(d => (
                      <div key={d.id} style={{display:"flex", alignItems:"center", gap:10,
                        padding:"8px 12px", background:t.surf, borderRadius:8}}>
                        <div style={{fontSize:12, color:t.tx2, width:84}}>{d.date}</div>
                        <div style={{fontFamily:"monospace", fontWeight:700, color:COLOR.success,
                          fontSize:13, flex:1}}>{fmt$(d.amount)}</div>
                        {d.notes && <div style={{fontSize:12, color:t.tx2, flex:1}}>{d.notes}</div>}
                        <button onClick={() => setConfirmDivDel(d.id)}
                          style={{background:"none", border:"none", cursor:"pointer",
                            fontSize:13, color:t.tx3, padding:"2px 6px"}}>🗑</button>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:12, padding:"8px 12px", background:ACCENT+"11",
                    borderRadius:8, fontSize:13, display:"flex", justifyContent:"space-between"}}>
                    <span style={{color:t.tx2}}>{yearStr} Annual Total</span>
                    <strong style={{fontFamily:"monospace", color:COLOR.success}}>
                      {fmt$(annualTotal)}
                    </strong>
                  </div>
                </>
              )}
            </div>
          )}

          <div style={{display:"flex", justifyContent:"flex-end", marginTop:16}}>
            <button onClick={onClose} style={btnGhost(t)}>Close</button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!confirmDivDel}
        onClose={() => setConfirmDivDel(null)}
        onConfirm={() => { onDelete(confirmDivDel); setConfirmDivDel(null); }}
        title="Delete Dividend"
        message="Remove this dividend entry? This cannot be undone."
        t={t} />
    </>
  );
}

// --- AiPriceUpdateModal ------------------------------------------------------
function AiPriceUpdateModal({ open, onClose, positions, apiKey, onApply, t }) {
  const [status,    setStatus]    = useState("loading");
  const [estimates, setEstimates] = useState([]);
  const [checked,   setChecked]   = useState({});
  const [error,     setError]     = useState(null);

  useEffect(() => {
    if (!open) return;
    setStatus("loading"); setEstimates([]); setChecked({}); setError(null);
    fetchEstimates();
  }, [open]);

  async function fetchEstimates() {
    if (!apiKey) { setError("No API key set. Click 🔑 in the toolbar."); setStatus("error"); return; }
    const tickers = [...new Set(positions.map(p => p.ticker))];
    if (tickers.length === 0) { setError("No positions to update."); setStatus("error"); return; }
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 512,
          system: `You are a financial data assistant. Return ONLY a JSON array of price estimates for the given stock tickers. No explanation, no markdown, just the array.\nFormat: [{"ticker":"AAPL","price":185.50,"note":"as of approx [month year]"}, ...]\nIf you don't know a ticker's price, return {"ticker":"X","price":null,"note":"unknown"}.`,
          messages: [{ role:"user", content:`Provide current price estimates for these tickers:\n${tickers.join(", ")}` }],
        }),
      });
      const data = await res.json();
      const text  = data.content?.[0]?.text || "";
      const match = text.match(/\[[\s\S]*?\]/);
      if (!match) throw new Error("parse");
      const parsed = JSON.parse(match[0]);
      setEstimates(parsed);
      const initChecked = {};
      parsed.forEach(e => { if (e.price !== null) initChecked[e.ticker] = true; });
      setChecked(initChecked);
      setStatus("review");
    } catch(e) {
      setError(e.message === "parse"
        ? "Couldn't parse AI response. Try again."
        : "Request failed. Check your API key and try again.");
      setStatus("error");
    }
  }

  function handleApply() {
    const toApply = estimates.filter(e => e.price !== null && checked[e.ticker]);
    onApply(toApply);
    onClose();
  }

  if (!open) return null;
  const oc = overlayContainer(t, 540);
  const posMap = {};
  positions.forEach(p => { posMap[p.ticker] = p; });

  return (
    <div style={oc.overlay} onClick={onClose}>
      <div style={oc.box} onClick={e => e.stopPropagation()}>
        <div style={{fontWeight:700, fontSize:16, color:t.tx1, marginBottom:4}}>🤖 AI Price Update</div>
        <div style={{fontSize:12, color:t.tx2, marginBottom:12}}>
          Claude estimates prices from training data. Review before applying.
        </div>

        <div style={{background:COLOR.warning+"18", border:`1px solid ${COLOR.warning}44`,
          borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:12,
          color:t.tx2, lineHeight:1.5}}>
          ⚠️ These are AI estimates based on training data. Prices may not reflect current market
          values. Verify before making investment decisions.
        </div>

        {status === "loading" && (
          <div style={{textAlign:"center", padding:"28px 0", fontSize:13, color:t.tx2}}>
            Fetching price estimates from Claude…
          </div>
        )}

        {status === "error" && (
          <div style={{marginBottom:16}}>
            <div style={{background:COLOR.danger+"18", border:`1px solid ${COLOR.danger}33`,
              borderRadius:8, padding:"10px 14px", fontSize:13, color:COLOR.danger, marginBottom:12}}>
              {error}
            </div>
            <div style={{display:"flex", gap:8}}>
              <button onClick={fetchEstimates} style={btnPrimary()}>Retry</button>
              <button onClick={onClose} style={btnGhost(t)}>Close</button>
            </div>
          </div>
        )}

        {status === "review" && (
          <>
            <div style={{overflowX:"auto", marginBottom:16}}>
              <table style={{width:"100%", borderCollapse:"collapse", minWidth:380}}>
                <thead>
                  <tr>
                    {["Ticker","AI Estimate","Current","Apply?"].map(h => (
                      <th key={h} style={{fontSize:10, color:t.tx3, fontWeight:700,
                        padding:"0 8px 8px", textAlign:h==="Apply?"?"center":"left",
                        borderBottom:`1px solid ${t.border}`}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {estimates.map(e => {
                    const cur = posMap[e.ticker];
                    const canApply = e.price !== null;
                    return (
                      <tr key={e.ticker}>
                        <td style={{padding:"10px 8px", fontWeight:700, fontSize:13, color:t.tx1}}>
                          {e.ticker}
                          {e.note && <div style={{fontSize:10, color:t.tx3, fontWeight:400}}>{e.note}</div>}
                        </td>
                        <td style={{padding:"10px 8px", fontFamily:"monospace", fontSize:13,
                          color:canApply ? COLOR.success : t.tx3}}>
                          {canApply ? fmt$(e.price) : "—"}
                        </td>
                        <td style={{padding:"10px 8px", fontFamily:"monospace", fontSize:13, color:t.tx2}}>
                          {cur ? fmt$(parseFloat(cur.currentPrice)||0) : "—"}
                        </td>
                        <td style={{padding:"10px 8px", textAlign:"center"}}>
                          {canApply ? (
                            <input type="checkbox" checked={!!checked[e.ticker]}
                              onChange={ev => setChecked(c => ({...c, [e.ticker]: ev.target.checked}))} />
                          ) : (
                            <span style={{fontSize:11, color:t.tx3}}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{display:"flex", gap:10, justifyContent:"flex-end"}}>
              <button onClick={onClose} style={btnGhost(t)}>Cancel</button>
              <button onClick={handleApply} style={btnPrimary()}
                disabled={!Object.values(checked).some(Boolean)}>
                Apply Selected
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- BackupModal -------------------------------------------------------------
function BackupModal({ open, onClose, accounts, positions, dividends, onImport, t }) {
  const [mode,        setMode]        = useState("export");
  const [importMode,  setImportMode]  = useState("replace");
  const [importText,  setImportText]  = useState("");
  const [importError, setImportError] = useState(null);

  useEffect(() => {
    if (open) { setMode("export"); setImportText(""); setImportError(null); }
  }, [open]);

  if (!open) return null;
  const oc = overlayContainer(t, 500);

  function exportJSON() {
    const blob = new Blob([JSON.stringify({accounts, positions, dividends}, null, 2)],
      {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    a.href = url;
    a.download = `investment-backup-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    const header = "id,accountId,ticker,name,assetType,shares,avgCostBasis,currentPrice,lastPriceUpdate,priceSource,notes";
    const rows = positions.map(p =>
      ["id","accountId","ticker","name","assetType","shares","avgCostBasis",
       "currentPrice","lastPriceUpdate","priceSource","notes"]
        .map(k => `"${String(p[k]||"").replace(/"/g,'""')}"`)
        .join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "investment-positions.csv";
    a.click(); URL.revokeObjectURL(url);
  }

  function handleImport() {
    setImportError(null);
    try {
      const data = JSON.parse(importText);
      if (!data.accounts || !data.positions) throw new Error("Invalid format — missing accounts or positions.");
      onImport(data, importMode);
      onClose();
    } catch(e) {
      setImportError(e.message || "Invalid JSON");
    }
  }

  return (
    <div style={oc.overlay} onClick={onClose}>
      <div style={oc.box} onClick={e => e.stopPropagation()}>
        <div style={{fontWeight:700, fontSize:16, color:t.tx1, marginBottom:16}}>💾 Backup & Restore</div>
        <div style={{display:"flex", gap:8, marginBottom:16}}>
          <button onClick={() => setMode("export")} style={tabBtn(mode==="export", t)}>Export</button>
          <button onClick={() => setMode("import")} style={tabBtn(mode==="import", t)}>Import</button>
        </div>

        {mode === "export" && (
          <div style={{display:"flex", flexDirection:"column", gap:10}}>
            <button onClick={exportJSON} style={btnPrimary({width:"100%"})}>
              📦 Download JSON Backup
            </button>
            <button onClick={exportCSV} style={btnGhost(t, {width:"100%"})}>
              📊 Download CSV (Positions Only)
            </button>
          </div>
        )}

        {mode === "import" && (
          <div style={{display:"flex", flexDirection:"column", gap:12}}>
            <div style={{display:"flex", gap:8}}>
              {["replace","merge"].map(m => (
                <button key={m} onClick={() => setImportMode(m)} style={tabBtn(importMode===m, t)}>
                  {m.charAt(0).toUpperCase()+m.slice(1)}
                </button>
              ))}
            </div>
            <div style={{fontSize:12, color:t.tx3}}>
              {importMode === "replace" ? "Replaces all data." : "Merges by id — skips duplicates."}
            </div>
            <label style={labelSt(t)}>Paste JSON backup</label>
            <textarea value={importText} onChange={e => setImportText(e.target.value)}
              rows={6} placeholder='{"accounts":[...],"positions":[...],"dividends":[...]}'
              style={{...inputStyle(t), resize:"vertical", fontFamily:"monospace", fontSize:11}} />
            {importError && (
              <div style={{fontSize:12, color:COLOR.danger}}>{importError}</div>
            )}
            <button onClick={handleImport} disabled={!importText.trim()} style={btnPrimary()}>
              Import
            </button>
          </div>
        )}

        <div style={{display:"flex", justifyContent:"flex-end", marginTop:16}}>
          <button onClick={onClose} style={btnGhost(t)}>Close</button>
        </div>
      </div>
    </div>
  );
}

// --- AllocationChart ---------------------------------------------------------
function AllocationChart({ positions, t }) {
  const calced = positions
    .map(p => ({ ...p, val: (parseFloat(p.currentPrice)||0) * (parseFloat(p.shares)||0) }))
    .filter(p => p.val > 0)
    .sort((a,b) => b.val - a.val);

  const total = calced.reduce((s,p) => s + p.val, 0);
  if (total === 0 || calced.length === 0) return null;

  const top8    = calced.slice(0, 8);
  const restVal = calced.slice(8).reduce((s,p) => s + p.val, 0);
  const items   = restVal > 0 ? [...top8, { ticker:"Other", val:restVal }] : top8;

  const CX = 120, CY = 120, R = 88, INNER = 52;
  let angle = -Math.PI / 2;

  const slices = items.map((item, i) => {
    const pct   = item.val / total;
    const sweep = pct * 2 * Math.PI;
    const end   = angle + sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const x1  = CX + R      * Math.cos(angle); const y1  = CY + R      * Math.sin(angle);
    const x2  = CX + R      * Math.cos(end);   const y2  = CY + R      * Math.sin(end);
    const xi1 = CX + INNER  * Math.cos(end);   const yi1 = CY + INNER  * Math.sin(end);
    const xi2 = CX + INNER  * Math.cos(angle); const yi2 = CY + INNER  * Math.sin(angle);
    const d = `M${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L${xi1.toFixed(1)} ${yi1.toFixed(1)} A${INNER} ${INNER} 0 ${large} 0 ${xi2.toFixed(1)} ${yi2.toFixed(1)} Z`;
    const s = { d, color:CHART_COLORS[i%CHART_COLORS.length], pct:(pct*100).toFixed(1), ticker:item.ticker };
    angle = end;
    return s;
  });

  const fmtShort = v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : fmt$(v);

  return (
    <div style={{display:"flex", alignItems:"flex-start", gap:20, flexWrap:"wrap"}}>
      <svg width={240} height={240} style={{flexShrink:0}}>
        {slices.map((s,i) => (
          <path key={i} d={s.d} fill={s.color} stroke={t.panelBg} strokeWidth={2} />
        ))}
        <text x={CX} y={CY-7} textAnchor="middle" fill={t.tx3} fontSize={10}>Total Value</text>
        <text x={CX} y={CY+12} textAnchor="middle" fill={t.tx1} fontSize={13} fontWeight="bold">
          {fmtShort(total)}
        </text>
      </svg>
      <div style={{display:"flex", flexDirection:"column", gap:5, paddingTop:8}}>
        {slices.map((s,i) => (
          <div key={i} style={{display:"flex", alignItems:"center", gap:8}}>
            <div style={{width:10, height:10, borderRadius:2, background:s.color, flexShrink:0}} />
            <span style={{fontSize:12, color:t.tx1, fontWeight:600, minWidth:44}}>{s.ticker}</span>
            <span style={{fontSize:12, color:t.tx2, fontFamily:"monospace"}}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- PositionRow -------------------------------------------------------------
function PositionRow({ position, onEdit, onDelete, onDividend, onPriceChange, t }) {
  const [editing,  setEditing]  = useState(false);
  const [priceVal, setPriceVal] = useState("");

  const p     = calcPosition(position);
  const stale = daysSince(position.lastPriceUpdate);
  const isOld = stale === null || stale > 7;

  function startEdit() { setPriceVal(position.currentPrice||""); setEditing(true); }

  function commitEdit() {
    const n = parseFloat(priceVal);
    if (!isNaN(n) && n > 0) onPriceChange(position.id, priceVal);
    setEditing(false);
  }

  function onKeyDown(e) {
    if (e.key === "Enter")  commitEdit();
    if (e.key === "Escape") setEditing(false);
  }

  return (
    <tr style={{borderTop:`1px solid ${t.border}`}}>
      <td style={{padding:"8px 10px", minWidth:120}}>
        <div style={{fontWeight:700, fontSize:13, color:t.tx1}}>{p.ticker}</div>
        <div style={{fontSize:11, color:t.tx2, maxWidth:110,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{p.name}</div>
        <div style={{marginTop:2, display:"flex", gap:4}}>
          <span style={{fontSize:10, background:ACCENT+"22", color:ACCENT,
            borderRadius:4, padding:"1px 5px"}}>
            {ASSET_TYPES.find(a => a.id===position.assetType)?.label || position.assetType}
          </span>
          {position.priceSource === "ai" && (
            <span style={{fontSize:10, background:COLOR.purple+"22", color:COLOR.purple,
              borderRadius:4, padding:"1px 5px"}}>🤖 AI</span>
          )}
        </div>
      </td>
      <td style={{padding:"8px 10px", textAlign:"right",
        fontFamily:"monospace", fontSize:13, color:t.tx1}}>
        {parseFloat(p.shares||0).toLocaleString()}
      </td>
      <td style={{padding:"8px 10px", textAlign:"right",
        fontFamily:"monospace", fontSize:13, color:t.tx2}}>
        {fmt$(parseFloat(p.avgCostBasis))}
      </td>
      <td style={{padding:"8px 10px", textAlign:"right"}}>
        {editing ? (
          <input type="number" value={priceVal} autoFocus
            onChange={e => setPriceVal(e.target.value)}
            onBlur={commitEdit} onKeyDown={onKeyDown}
            style={{width:72, background:t.surf, border:`1px solid ${ACCENT}`,
              borderRadius:6, padding:"3px 6px", color:t.tx1, fontSize:12,
              fontFamily:"monospace", textAlign:"right"}} />
        ) : (
          <span onClick={startEdit} title="Click to edit price"
            style={{fontFamily:"monospace", fontSize:13, color:t.tx1, cursor:"pointer",
              borderBottom:`1px dashed ${t.border2}`, paddingBottom:1}}>
            {fmt$(parseFloat(p.currentPrice))}
          </span>
        )}
      </td>
      <td style={{padding:"8px 10px", textAlign:"right",
        fontFamily:"monospace", fontWeight:700, fontSize:13, color:t.tx1}}>
        {fmt$(p.currentValue)}
      </td>
      <td style={{padding:"8px 10px", textAlign:"right",
        fontFamily:"monospace", fontSize:13,
        color:p.unrealizedGain>=0?COLOR.success:COLOR.danger}}>
        {fmt$(p.unrealizedGain)}
      </td>
      <td style={{padding:"8px 10px", textAlign:"right", minWidth:80}}>
        <div style={{fontFamily:"monospace", fontWeight:700, fontSize:13,
          color:p.unrealizedGainPct>=0?COLOR.success:COLOR.danger}}>
          {fmtPct(p.unrealizedGainPct)}
        </div>
        <div style={{fontSize:10, color:isOld?COLOR.warning:t.tx3, marginTop:2}}>
          {staleLabel(position.lastPriceUpdate)}
        </div>
      </td>
      <td style={{padding:"8px 6px", whiteSpace:"nowrap"}}>
        <button onClick={() => onDividend(position)} title="Dividends"
          style={{background:"none", border:"none", cursor:"pointer", fontSize:14, padding:"2px 4px"}}>
          💰
        </button>
        <button onClick={() => onEdit(position)} title="Edit"
          style={{background:"none", border:"none", cursor:"pointer", fontSize:14, padding:"2px 4px"}}>
          ✏️
        </button>
        <button onClick={() => onDelete(position)} title="Delete"
          style={{background:"none", border:"none", cursor:"pointer", fontSize:14, padding:"2px 4px"}}>
          🗑
        </button>
      </td>
    </tr>
  );
}

// --- AccountCard -------------------------------------------------------------
function AccountCard({ account, positions, onAddPosition, onEditPosition,
  onDeletePosition, onDividend, onPriceChange, t }) {
  const [expanded, setExpanded] = useState(false);

  const acctPos   = positions.filter(p => p.accountId === account.id);
  const calced    = acctPos.map(p => calcPosition(p));
  const totalVal  = calced.reduce((s,p) => s + p.currentValue, 0);
  const totalInv  = acctPos.reduce((s,p) => s + (parseFloat(p.shares)||0)*(parseFloat(p.avgCostBasis)||0), 0);
  const totalGain = totalVal - totalInv;
  const gainPct   = totalInv > 0 ? (totalGain/totalInv)*100 : 0;

  return (
    <div style={panelSt(t,{marginBottom:12,padding:0,overflow:"hidden"})}>
      <div onClick={() => setExpanded(e => !e)}
        style={{display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"14px 18px", cursor:"pointer", flexWrap:"wrap", gap:8}}>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <div style={{width:10, height:10, borderRadius:"50%",
            background:account.color||ACCENT, flexShrink:0}} />
          <div>
            <div style={{fontWeight:700, fontSize:14, color:t.tx1}}>{account.name}</div>
            <div style={{fontSize:11, color:t.tx3}}>
              {ACCOUNT_TYPES.find(a=>a.id===account.type)?.label||account.type} · {acctPos.length} position{acctPos.length!==1?"s":""}
            </div>
          </div>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:16}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:"monospace", fontWeight:800, fontSize:15, color:t.tx1}}>
              {fmt$(totalVal)}
            </div>
            <div style={{fontSize:12, fontFamily:"monospace",
              color:totalGain>=0?COLOR.success:COLOR.danger}}>
              {totalGain>=0?"+":""}{fmt$(totalGain)} ({fmtPct(gainPct)})
            </div>
          </div>
          <span style={{fontSize:18, color:t.tx3, display:"inline-block",
            transition:"transform .2s", transform:expanded?"rotate(90deg)":"rotate(0deg)"}}>›</span>
        </div>
      </div>

      {expanded && (
        <div style={{borderTop:`1px solid ${t.border}`}}>
          {acctPos.length === 0 ? (
            <div style={{padding:"16px 20px", fontSize:13, color:t.tx3, textAlign:"center"}}>
              No positions yet.
            </div>
          ) : (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%", borderCollapse:"collapse", minWidth:640}}>
                <thead>
                  <tr style={{background:t.surf}}>
                    {["Ticker / Name","Shares","Avg Cost","Price ▼","Value","Gain $","Gain %",""].map(h => (
                      <th key={h} style={{fontSize:10, color:t.tx3, fontWeight:600,
                        padding:"7px 10px", textAlign:h==="Ticker / Name"||h===""?"left":"right",
                        borderBottom:`1px solid ${t.border}`}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {acctPos.map(pos => (
                    <PositionRow key={pos.id} position={pos}
                      onEdit={onEditPosition} onDelete={onDeletePosition}
                      onDividend={onDividend} onPriceChange={onPriceChange} t={t} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{padding:"10px 18px", borderTop:`1px solid ${t.border}`}}>
            <button onClick={() => onAddPosition(account.id)}
              style={btnGhost(t, {fontSize:12, padding:"6px 12px"})}>
              + Add Position
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- OverviewTab -------------------------------------------------------------
function OverviewTab({ accounts, positions, dividends, t, bp }) {
  const calced = positions.map(p => calcPosition(p));
  const totalInvested  = calced.reduce((s,p) => s + (parseFloat(p.shares)||0)*(parseFloat(p.avgCostBasis)||0), 0);
  const currentValue   = calced.reduce((s,p) => s + p.currentValue, 0);
  const unrealizedGain = currentValue - totalInvested;

  const yearStr    = new Date().getFullYear().toString();
  const annualDivs = (dividends||[])
    .filter(d => d.date?.startsWith(yearStr))
    .reduce((s,d) => s + (parseFloat(d.amount)||0), 0);

  const byGain    = [...calced].sort((a,b) => b.unrealizedGainPct - a.unrealizedGainPct);
  const gainers   = byGain.filter(p => p.unrealizedGainPct > 0).slice(0, 3);
  const losers    = [...byGain].reverse().filter(p => p.unrealizedGainPct < 0).slice(0, 3);

  const acctSummary = accounts.map(acct => {
    const aPos  = calced.filter(p => p.accountId === acct.id);
    const aVal  = aPos.reduce((s,p) => s + p.currentValue, 0);
    const aInv  = aPos.reduce((s,p) => s + (parseFloat(p.shares)||0)*(parseFloat(p.avgCostBasis)||0), 0);
    return { ...acct, value:aVal, gain:aVal-aInv, count:aPos.length };
  });

  const statCards = [
    { label:"Total Invested",    value:fmt$(totalInvested),  color:ACCENT },
    { label:"Current Value",     value:fmt$(currentValue),   color:COLOR.purple },
    { label:"Unrealized Gain",   value:fmt$(unrealizedGain), color:unrealizedGain>=0?COLOR.success:COLOR.danger },
    { label:"Annual Dividends",  value:fmt$(annualDivs),     color:COLOR.warning },
  ];

  return (
    <div>
      <div style={{display:"grid",
        gridTemplateColumns:bp.isMobile?"1fr 1fr":"repeat(4,1fr)",
        gap:12, marginBottom:20}}>
        {statCards.map(s => (
          <div key={s.label} style={panelSt(t,{textAlign:"center",padding:"16px 12px"})}>
            <div style={{fontSize:10, color:t.tx3, fontWeight:600, marginBottom:4}}>{s.label}</div>
            <div style={{fontFamily:"monospace", fontWeight:800, fontSize:16, color:s.color}}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {positions.length > 0 && (
        <div style={panelSt(t,{marginBottom:20})}>
          <div style={{fontWeight:700, fontSize:14, color:t.tx1, marginBottom:16}}>
            Portfolio Allocation
          </div>
          <AllocationChart positions={positions} t={t} />
        </div>
      )}

      {(gainers.length > 0 || losers.length > 0) && (
        <div style={{display:"grid",
          gridTemplateColumns:bp.isMobile?"1fr":"1fr 1fr",
          gap:12, marginBottom:20}}>
          {[
            { label:"🚀 Top Gainers", items:gainers, color:COLOR.success },
            { label:"📉 Top Losers",  items:losers,  color:COLOR.danger  },
          ].map(({ label, items, color }) => (
            <div key={label} style={panelSt(t,{})}>
              <div style={{fontWeight:700, fontSize:13, color:t.tx1, marginBottom:10}}>{label}</div>
              {items.length === 0 ? (
                <div style={{fontSize:12, color:t.tx3}}>None</div>
              ) : (
                <table style={{width:"100%", borderCollapse:"collapse"}}>
                  <thead>
                    <tr>
                      {["Ticker","Gain %","Gain $"].map(h => (
                        <th key={h} style={{fontSize:10, color:t.tx3, fontWeight:600,
                          padding:"0 6px 6px", textAlign:h==="Ticker"?"left":"right"}}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(p => (
                      <tr key={p.id}>
                        <td style={{padding:"5px 6px", fontSize:13, fontWeight:700, color:t.tx1}}>
                          {p.ticker}
                        </td>
                        <td style={{padding:"5px 6px", fontFamily:"monospace", fontSize:12,
                          color, textAlign:"right"}}>
                          {fmtPct(p.unrealizedGainPct)}
                        </td>
                        <td style={{padding:"5px 6px", fontFamily:"monospace", fontSize:12,
                          color, textAlign:"right"}}>
                          {fmt$(p.unrealizedGain)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={panelSt(t,{})}>
        <div style={{fontWeight:700, fontSize:14, color:t.tx1, marginBottom:12}}>Accounts</div>
        {acctSummary.length === 0 ? (
          <div style={{fontSize:13, color:t.tx3, textAlign:"center", padding:"16px 0"}}>
            No accounts yet. Add your first account in the Positions tab.
          </div>
        ) : (
          acctSummary.map(acc => (
            <div key={acc.id} style={{display:"flex", alignItems:"center",
              justifyContent:"space-between", padding:"10px 12px", background:t.surf,
              borderRadius:10, marginBottom:6, flexWrap:"wrap", gap:8}}>
              <div style={{display:"flex", alignItems:"center", gap:8}}>
                <div style={{width:10, height:10, borderRadius:"50%", background:acc.color||ACCENT}} />
                <div>
                  <span style={{fontSize:13, fontWeight:600, color:t.tx1}}>{acc.name}</span>
                  <span style={{fontSize:11, color:t.tx3, marginLeft:8}}>
                    {acc.count} position{acc.count!==1?"s":""}
                  </span>
                </div>
              </div>
              <div style={{display:"flex", gap:16}}>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10, color:t.tx3}}>Value</div>
                  <div style={{fontFamily:"monospace", fontWeight:700, fontSize:13, color:t.tx1}}>
                    {fmt$(acc.value)}
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10, color:t.tx3}}>Gain</div>
                  <div style={{fontFamily:"monospace", fontWeight:700, fontSize:13,
                    color:acc.gain>=0?COLOR.success:COLOR.danger}}>
                    {fmt$(acc.gain)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- PositionsTab ------------------------------------------------------------
function PositionsTab({ accounts, positions, dividends, onAddAccount, onAddPosition,
  onEditPosition, onDeletePosition, onDividend, onPriceChange,
  onAiPriceUpdate, onBackup, t, bp }) {

  const calced     = positions.map(p => calcPosition(p));
  const totalVal   = calced.reduce((s,p) => s + p.currentValue, 0);
  const totalInv   = calced.reduce((s,p) => s + (parseFloat(p.shares)||0)*(parseFloat(p.avgCostBasis)||0), 0);
  const totalGain  = totalVal - totalInv;
  const totalGainP = totalInv > 0 ? (totalGain/totalInv)*100 : 0;

  return (
    <div>
      <div style={{display:"flex", gap:8, flexWrap:"wrap", marginBottom:16}}>
        <button onClick={onAddAccount} style={btnPrimary()}>+ Add Account</button>
        {positions.length > 0 && (
          <button onClick={onAiPriceUpdate} style={btnGhost(t)}>🤖 Update Prices</button>
        )}
        <button onClick={onBackup} style={btnGhost(t)}>💾 Backup</button>
      </div>

      {positions.length > 0 && (
        <div style={panelSt(t,{marginBottom:16,padding:"12px 16px"})}>
          <div style={{display:"flex", flexWrap:"wrap", gap:16, alignItems:"center"}}>
            <span style={{fontSize:12, color:t.tx2}}>
              {positions.length} positions · {accounts.length} accounts
            </span>
            <span style={{fontSize:12, color:t.tx2}}>
              Invested: <strong style={{fontFamily:"monospace", color:t.tx1}}>{fmt$(totalInv)}</strong>
            </span>
            <span style={{fontSize:12, color:t.tx2}}>
              Value: <strong style={{fontFamily:"monospace", color:t.tx1}}>{fmt$(totalVal)}</strong>
            </span>
            <span style={{fontSize:12, color:t.tx2}}>
              Gain:{" "}
              <strong style={{fontFamily:"monospace", color:totalGain>=0?COLOR.success:COLOR.danger}}>
                {totalGain>=0?"+":""}{fmt$(totalGain)} ({fmtPct(totalGainP)})
              </strong>
            </span>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div style={panelSt(t,{textAlign:"center",padding:"48px 20px"})}>
          <div style={{fontSize:40, marginBottom:12}}>📈</div>
          <div style={{fontWeight:700, fontSize:16, color:t.tx1, marginBottom:8}}>No accounts yet</div>
          <div style={{fontSize:13, color:t.tx2, marginBottom:16}}>
            Add an account to start tracking your investments.
          </div>
          <button onClick={onAddAccount} style={btnPrimary()}>Add First Account</button>
        </div>
      ) : (
        accounts.map(acct => (
          <AccountCard key={acct.id} account={acct} positions={positions}
            onAddPosition={onAddPosition}
            onEditPosition={onEditPosition}
            onDeletePosition={onDeletePosition}
            onDividend={onDividend}
            onPriceChange={onPriceChange}
            t={t} />
        ))
      )}
    </div>
  );
}

// --- AiAnalysisTab -----------------------------------------------------------
function AiAnalysisTab({ positions, dividends, baseline, apiKey, savedResults, onSaveResults, t }) {
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(savedResults||null);
  const [error,   setError]   = useState(null);

  useEffect(() => { if (savedResults) setResult(savedResults); }, [savedResults]);

  const calced     = positions.map(p => calcPosition(p));
  const totalValue = calced.reduce((s,p) => s + p.currentValue, 0);

  async function analyze() {
    if (!apiKey)             { setError("No API key set. Click 🔑 in the toolbar."); return; }
    if (positions.length===0){ setError("Add positions first."); return; }
    setLoading(true); setError(null);

    const posData = calced.map(p => {
      const invested = (parseFloat(p.shares)||0)*(parseFloat(p.avgCostBasis)||0);
      return `${p.ticker} (${p.name}): ${p.shares} shares, cost basis ${fmt$(invested)}, current value ${fmt$(p.currentValue)}, gain ${fmtPct(p.unrealizedGainPct)}`;
    }).join("\n");

    const allocData = calced.map(p => {
      const pct = totalValue > 0 ? (p.currentValue/totalValue*100).toFixed(1) : "0.0";
      return `${p.ticker}: ${pct}%`;
    }).join(", ");

    const yearStr    = new Date().getFullYear().toString();
    const annualDivs = (dividends||[])
      .filter(d => d.date?.startsWith(yearStr))
      .reduce((s,d) => s + (parseFloat(d.amount)||0), 0);

    const baselineCtx = baseline
      ? `\nMonthly spending baseline (from SpendingTracker): ${fmt$(baseline.amount)} — context for liquidity needs outside investments.`
      : "";

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
          system:`You are a personal investment advisor. Analyze the portfolio and give 3-5 specific, actionable recommendations. Focus on: concentration risk, diversification gaps, and whether the portfolio aligns with long-term wealth building. Be direct. Format as a numbered list.`,
          messages:[{
            role:"user",
            content:`Portfolio:\n${posData}\n\nAllocation: ${allocData}\nAnnual dividends: ${fmt$(annualDivs)}${baselineCtx}`,
          }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "No response received.";
      setResult(text);
      onSaveResults(text);
    } catch {
      setError("Analysis failed. Check your API key and try again.");
    }
    setLoading(false);
  }

  function copyResult() { if (result) navigator.clipboard?.writeText(result); }

  return (
    <div>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:16, flexWrap:"wrap", gap:8}}>
        <div style={{fontWeight:700, fontSize:15, color:t.tx1}}>AI Portfolio Analysis</div>
        <div style={{display:"flex", gap:8}}>
          {result && (
            <button onClick={copyResult} style={btnGhost(t,{fontSize:12,padding:"7px 12px"})}>
              📋 Copy
            </button>
          )}
          <button onClick={analyze} disabled={loading}
            style={btnPrimary({opacity:loading?0.7:1})}>
            {loading ? "Analyzing…" : result ? "Re-analyze" : "Analyze My Portfolio"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{background:COLOR.danger+"18", border:`1px solid ${COLOR.danger}33`,
          borderRadius:10, padding:"12px 14px", marginBottom:16, fontSize:13,
          color:COLOR.danger}}>
          {error}
        </div>
      )}

      {!result && !loading && (
        <div style={panelSt(t,{textAlign:"center",padding:"40px 20px"})}>
          <div style={{fontSize:40, marginBottom:12}}>🧠</div>
          <div style={{fontWeight:700, fontSize:15, color:t.tx1, marginBottom:8}}>
            Ready to analyze your portfolio
          </div>
          <div style={{fontSize:13, color:t.tx2, lineHeight:1.6, maxWidth:380, margin:"0 auto"}}>
            Claude will review your positions, allocation, and gains to provide personalized
            recommendations on concentration risk and diversification.
          </div>
          {baseline && (
            <div style={{fontSize:12, color:t.tx3, marginTop:12}}>
              ✓ Spending baseline ({fmt$(baseline.amount)}/mo) included for context.
            </div>
          )}
        </div>
      )}

      {loading && (
        <div style={panelSt(t,{textAlign:"center",padding:"40px 20px"})}>
          <div style={{fontSize:13, color:t.tx2}}>Analyzing your portfolio…</div>
        </div>
      )}

      {result && !loading && (
        <div style={panelSt(t,{})}>
          <div style={{fontSize:14, color:t.tx1, lineHeight:1.8, whiteSpace:"pre-wrap"}}>{result}</div>
        </div>
      )}
    </div>
  );
}

// --- InvestmentModule --------------------------------------------------------
export default function InvestmentModule() {
  const [accounts,      setAccounts]      = useState([]);
  const [positions,     setPositions]     = useState([]);
  const [dividends,     setDividends]     = useState([]);
  const [aiResults,     setAiResults]     = useState(null);
  const [baseline,      setBaseline]      = useState(null);
  const [profiles,      setProfiles]      = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [apiKey,        setApiKey]        = useState("");
  const [darkMode,      setDarkMode]      = useState(() => localStorage.getItem("inv_dark") === "true");
  const [tab,           setTab]           = useState("overview");
  const [loading,       setLoading]       = useState(true);

  const [showAddAccount,  setShowAddAccount]  = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [addPosAcctId,    setAddPosAcctId]    = useState(null);
  const [editPos,         setEditPos]         = useState(null);
  const [showEditPos,     setShowEditPos]     = useState(false);
  const [divPos,          setDivPos]          = useState(null);
  const [showDividend,    setShowDividend]    = useState(false);
  const [showAiPrice,     setShowAiPrice]     = useState(false);
  const [showBackup,      setShowBackup]      = useState(false);
  const [showApiKey,      setShowApiKey]      = useState(false);
  const [showProfiles,    setShowProfiles]    = useState(false);
  const [confirmDel,      setConfirmDel]      = useState(null);

  const t  = useTheme(darkMode);
  const bp = useBreakpoint();

  useEffect(() => { localStorage.setItem("inv_dark", darkMode); }, [darkMode]);

  useEffect(() => {
    async function init() {
      const [key, profs, activeId] = await Promise.all([
        storeGet("cc_apikey", true),
        storeGet("cc_profiles", true),
        storeGet("cc_active_profile", true),
      ]);
      const ps  = profs || [];
      const aid = activeId || ps[0]?.id || null;
      const ap  = ps.find(p => p.id === aid) || null;
      setApiKey(key||""); setProfiles(ps); setActiveProfile(ap);
      if (aid) {
        const [accs, pos, divs, ai, bl] = await Promise.all([
          storeGet(`inv_accounts_${aid}`,  true),
          storeGet(`inv_positions_${aid}`, true),
          storeGet(`inv_dividends_${aid}`, true),
          storeGet(`inv_ai_results_${aid}`,true),
          storeGet(`ffp_baseline_${aid}`,  true),
        ]);
        const loadedPos = pos || [];
        setAccounts(accs||[]); setPositions(loadedPos);
        setDividends(divs||[]); setAiResults(ai||null); setBaseline(bl||null);
        await doRecalc(ap, loadedPos);
      }
      setLoading(false);
    }
    init();
  }, []);

  async function doRecalc(profile, pos) {
    if (!profile) return;
    const totalInvested  = pos.reduce((s,p) => s + (parseFloat(p.avgCostBasis)||0)*(parseFloat(p.shares)||0), 0);
    const currentValue   = pos.reduce((s,p) => s + (parseFloat(p.currentPrice)||0)*(parseFloat(p.shares)||0), 0);
    const unrealizedGain = currentValue - totalInvested;
    await storeSet(`ffp_investments_${profile.id}`, {
      totalInvested, currentValue, unrealizedGain,
      positionCount: pos.length, calculatedOn: new Date().toISOString()
    }, true);
  }

  async function switchProfile(id) {
    const ap = profiles.find(p => p.id === id) || null;
    setActiveProfile(ap);
    await storeSet("cc_active_profile", id, true);
    setAccounts([]); setPositions([]); setDividends([]); setAiResults(null); setBaseline(null);
    if (id) {
      const [accs, pos, divs, ai, bl] = await Promise.all([
        storeGet(`inv_accounts_${id}`,  true),
        storeGet(`inv_positions_${id}`, true),
        storeGet(`inv_dividends_${id}`, true),
        storeGet(`inv_ai_results_${id}`,true),
        storeGet(`ffp_baseline_${id}`,  true),
      ]);
      const loadedPos = pos || [];
      setAccounts(accs||[]); setPositions(loadedPos);
      setDividends(divs||[]); setAiResults(ai||null); setBaseline(bl||null);
      await doRecalc(ap, loadedPos);
    }
  }

  async function savePositions(updated) {
    setPositions(updated);
    if (activeProfile) {
      await storeSet(`inv_positions_${activeProfile.id}`, updated, true);
      await doRecalc(activeProfile, updated);
    }
  }

  async function handleAddAccount(acct) {
    const updated = [...accounts, acct];
    setAccounts(updated);
    if (activeProfile) await storeSet(`inv_accounts_${activeProfile.id}`, updated, true);
  }

  function handleAddPosition(pos) {
    savePositions([...positions, calcPosition(pos)]);
  }

  function handleEditPosition(pos) {
    savePositions(positions.map(p => p.id === pos.id ? calcPosition(pos) : p));
    setShowEditPos(false); setEditPos(null);
  }

  function handleDeletePositionConfirm(pos) {
    setConfirmDel(pos);
  }

  function doDeletePosition() {
    if (!confirmDel) return;
    savePositions(positions.filter(p => p.id !== confirmDel.id));
    setConfirmDel(null);
  }

  function handlePriceChange(posId, newPrice) {
    savePositions(positions.map(p => p.id === posId
      ? calcPosition({ ...p, currentPrice:newPrice,
          lastPriceUpdate: new Date().toISOString(), priceSource:"manual" })
      : p
    ));
  }

  function handleAiPriceApply(updates) {
    const priceMap = {};
    updates.forEach(u => { priceMap[u.ticker] = u.price; });
    const now = new Date().toISOString();
    savePositions(positions.map(p =>
      priceMap[p.ticker] !== undefined
        ? calcPosition({ ...p, currentPrice: String(priceMap[p.ticker]),
            lastPriceUpdate:now, priceSource:"ai" })
        : p
    ));
  }

  async function handleAddDividend(div) {
    const updated = [...dividends, div];
    setDividends(updated);
    if (activeProfile) await storeSet(`inv_dividends_${activeProfile.id}`, updated, true);
  }

  async function handleDeleteDividend(divId) {
    const updated = dividends.filter(d => d.id !== divId);
    setDividends(updated);
    if (activeProfile) await storeSet(`inv_dividends_${activeProfile.id}`, updated, true);
  }

  async function handleSaveAiResults(text) {
    setAiResults(text);
    if (activeProfile) await storeSet(`inv_ai_results_${activeProfile.id}`, text, true);
  }

  async function handleSaveApiKey(key) {
    setApiKey(key);
    await storeSet("cc_apikey", key, true);
  }

  async function handleImport(data, mode) {
    const mergeById = (existing, incoming) => {
      const map = {};
      existing.forEach(x => { map[x.id] = x; });
      incoming.forEach(x => { map[x.id] = x; });
      return Object.values(map);
    };
    const newAccounts  = mode==="replace" ? (data.accounts||[])  : mergeById(accounts,  data.accounts||[]);
    const newPositions = mode==="replace" ? (data.positions||[]) : mergeById(positions, data.positions||[]);
    const newDividends = mode==="replace" ? (data.dividends||[]) : mergeById(dividends, data.dividends||[]);
    setAccounts(newAccounts); setPositions(newPositions); setDividends(newDividends);
    if (activeProfile) {
      await Promise.all([
        storeSet(`inv_accounts_${activeProfile.id}`,  newAccounts,  true),
        storeSet(`inv_positions_${activeProfile.id}`, newPositions, true),
        storeSet(`inv_dividends_${activeProfile.id}`, newDividends, true),
      ]);
      await doRecalc(activeProfile, newPositions);
    }
  }

  if (loading) {
    return (
      <div style={{minHeight:"100vh", background:t.bg, display:"flex", alignItems:"center",
        justifyContent:"center", flexDirection:"column", gap:16}}>
        <div style={{width:40, height:40, border:`3px solid ${ACCENT}`,
          borderTopColor:"transparent", borderRadius:"50%",
          animation:"spin .8s linear infinite"}} />
        <div style={{fontSize:14, color:t.tx2}}>Loading…</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const TABS = [
    { id:"overview",  label:"📊 Overview"    },
    { id:"positions", label:"📋 Positions"   },
    { id:"ai",        label:"🧠 AI Analysis" },
  ];

  return (
    <div style={{minHeight:"100vh", background:t.bg,
      fontFamily:"'DM Sans','Segoe UI',sans-serif", color:t.tx1}}>

      {/* NavBar */}
      <div style={{background:t.deepBg, borderBottom:`1px solid ${t.border}`,
        padding:"11px 20px", display:"flex", justifyContent:"space-between",
        alignItems:"center", position:"sticky", top:0, zIndex:100,
        flexWrap:"wrap", gap:8}}>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <div style={{width:32, height:32, borderRadius:8,
            background:`linear-gradient(135deg,${ACCENT},${COLOR.purple})`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:16}}>
            📈
          </div>
          <span style={{fontWeight:800, fontSize:18, color:t.tx1}}>Investment Tracker</span>
          <span style={{fontSize:10,
            color:hasCloudStorage()?"#10b981":"#f59e0b",
            background:hasCloudStorage()?"#10b98118":"#f59e0b18",
            border:`1px solid ${hasCloudStorage()?"#10b98133":"#f59e0b33"}`,
            borderRadius:6, padding:"2px 8px"}}>
            {hasCloudStorage() ? "☁ Cloud Sync" : "💾 Local"}
          </span>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          {activeProfile && (
            <button onClick={() => setShowProfiles(true)}
              style={btnGhost(t, {fontSize:12, padding:"5px 10px"})}>
              👤 {activeProfile.name}
            </button>
          )}
          <button onClick={() => setDarkMode(d => !d)}
            style={{background:"none", border:"none", cursor:"pointer", fontSize:18, color:t.tx2}}>
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button onClick={() => setShowApiKey(true)} title="Set API Key"
            style={{background:"none", border:"none", cursor:"pointer",
              fontSize:18, color:apiKey ? COLOR.success : t.tx3}}>
            🔑
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:t.deepBg, borderBottom:`1px solid ${t.border}`,
        padding:"0 20px", display:"flex", gap:0, overflowX:"auto"}}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            style={{background:"none", border:"none",
              borderBottom:`2px solid ${tab===tb.id?ACCENT:"transparent"}`,
              color:tab===tb.id ? ACCENT : t.tx2, cursor:"pointer",
              fontWeight:tab===tb.id?700:500, fontSize:13,
              padding:"12px 16px", whiteSpace:"nowrap", transition:"all .15s"}}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{maxWidth:960, margin:"0 auto", padding:"20px 16px"}}>
        {tab === "overview" && (
          <OverviewTab accounts={accounts} positions={positions}
            dividends={dividends} t={t} bp={bp} />
        )}
        {tab === "positions" && (
          <PositionsTab
            accounts={accounts} positions={positions} dividends={dividends}
            onAddAccount={() => setShowAddAccount(true)}
            onAddPosition={id => { setAddPosAcctId(id); setShowAddPosition(true); }}
            onEditPosition={pos => { setEditPos(pos); setShowEditPos(true); }}
            onDeletePosition={handleDeletePositionConfirm}
            onDividend={pos => { setDivPos(pos); setShowDividend(true); }}
            onPriceChange={handlePriceChange}
            onAiPriceUpdate={() => setShowAiPrice(true)}
            onBackup={() => setShowBackup(true)}
            t={t} bp={bp} />
        )}
        {tab === "ai" && (
          <AiAnalysisTab
            positions={positions} dividends={dividends} baseline={baseline}
            apiKey={apiKey} savedResults={aiResults}
            onSaveResults={handleSaveAiResults} t={t} />
        )}
      </div>

      {/* Disclaimer footer */}
      <div style={{borderTop:`1px solid ${t.border}`, padding:"12px 16px",
        textAlign:"center", fontSize:11, color:t.tx3}}>
        For personal tracking only. Prices are manually entered and may not reflect current
        market values. Log in to your brokerage for real-time data and account management.
      </div>

      {/* Modals */}
      <AddAccountModal open={showAddAccount} onClose={() => setShowAddAccount(false)}
        onSave={handleAddAccount} t={t} />

      <AddPositionModal
        open={showAddPosition}
        onClose={() => { setShowAddPosition(false); setAddPosAcctId(null); }}
        accountId={addPosAcctId}
        onSave={handleAddPosition} t={t} />

      <EditPositionModal
        open={showEditPos}
        onClose={() => { setShowEditPos(false); setEditPos(null); }}
        position={editPos} onSave={handleEditPosition} t={t} />

      <DividendModal
        open={showDividend}
        onClose={() => { setShowDividend(false); setDivPos(null); }}
        position={divPos} dividends={dividends}
        onAdd={handleAddDividend} onDelete={handleDeleteDividend} t={t} />

      <AiPriceUpdateModal
        open={showAiPrice} onClose={() => setShowAiPrice(false)}
        positions={positions} apiKey={apiKey} onApply={handleAiPriceApply} t={t} />

      <BackupModal
        open={showBackup} onClose={() => setShowBackup(false)}
        accounts={accounts} positions={positions} dividends={dividends}
        onImport={handleImport} t={t} />

      <ApiKeyPanel
        open={showApiKey} onClose={() => setShowApiKey(false)}
        apiKey={apiKey} onSave={handleSaveApiKey} t={t} />

      <ProfilePanel
        open={showProfiles} onClose={() => setShowProfiles(false)}
        profiles={profiles} activeProfile={activeProfile} onSwitch={switchProfile} t={t} />

      <ConfirmModal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={doDeletePosition}
        title="Delete Position"
        message={confirmDel ? `Remove ${confirmDel.ticker} from your portfolio? This cannot be undone.` : ""}
        t={t} />
    </div>
  );
}
