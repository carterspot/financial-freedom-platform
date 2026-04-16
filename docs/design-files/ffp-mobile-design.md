# FFP Mobile Dashboard — Design Spec v1
**Status:** Design approved, pending testing pass before build prompt
**Date:** April 2026

---

## Layout Structure (top to bottom)

```
┌─────────────────────────────┐
│ Status bar                  │
│ Top nav                     │
├─────────────────────────────┤
│ Freedom/Wealth Rings        │
│ Swipeable alerts strip      │
│ 2×2 stat tiles              │
├─────────────────────────────┤
│ Home · Spend · [AI] · Debt · ⋯ │
└─────────────────────────────┘
```

---

## Top Nav

**Left:** 🏠 Financial Freedom (title)
**Right:** API status dot (6px, #10b981 valid / #ef4444 invalid / #f59e0b unknown) + profile pill (avatar initials + name)

**Removed from nav:** Light/dark toggle (→ Settings under ⋯)

---

## Freedom / Wealth Rings

**Size:** 200×200px SVG, centered
**Rings (Freedom phase):**
- Outer r=90: Score ring, color #6366f1
- Middle r=68: Momentum ring, color #10b981
- Inner r=46: Horizon ring, color #f59e0b
- Track color: #1e293b

**Score display:** Number only, centered in rings, 42px monospace, ring color
**Arc label:** "FREEDOM SCORE" or "WEALTH SCORE"
- Position: between 9 o'clock and 12 o'clock (upper-left quadrant)
- Path: `M 4,100 A 96,96 0 0,1 100,4` (sweep=1, clockwise through upper-left)
- Font: 8px, weight 700, letter-spacing 4, color #4a6080
- startOffset: 18%

**Phase switch at score 100:**
- Freedom Rings → Wealth Rings
- Colors: Growth #10b981 (outer), Legacy #06b6d4 (middle), Horizon #8b5cf6 (inner)
- Label changes to "WEALTH SCORE"
- Score turns gold (#f59e0b) at 200 (self-insurance milestone)

**Lap mechanic (Wealth phase):**
- Completed lap: faded ghost ring at opacity 0.28
- Dark separator between ghost and live arc: #020617 stroke at width 3
- Live arc: full opacity, width 5-6px
- Lap badge below score: "Lap 2 · 50%"

---

## Swipeable Alerts Strip

**Position:** Below rings, above tiles
**Behavior:** One alert visible at a time, swipe left/right or tap to cycle
**Dot indicators:** Row of 4-5 dots below alert card, active dot #6366f1
**Count label:** "1 of 4" top right of section

**Alert severity colors:**
- red (r): #ef4444 border-left, rgba(239,68,68,.07) bg
- amber (a): #f59e0b border-left, rgba(245,158,11,.07) bg
- success (s): #10b981 border-left, rgba(16,185,129,.07) bg
- info (i): #3b82f6 border-left, rgba(59,130,246,.07) bg

---

## 2×2 Stat Tiles

**Grid:** 2 columns, 8px gap
**Tiles:**
1. Net Position — color #10b981 — sparkline (trending up)
2. Income — color #10b981 — sparkline (month-to-month)
3. Total Debt — color #ef4444 — sparkline (descending = green, debt going down is good)
4. Baseline — color #f59e0b — ×1.7 multiplier + mini progress bar (no sparkline)

**Tile anatomy:**
- Label: 9px uppercase, #475569, letter-spacing .8px
- Value: 15px monospace 800 weight
- Sub: 9px #64748b
- Sparkline: 42×28px SVG, top-right of tile
- Background: #0f172a, border 1px #1e293b, border-radius 10px

**Removed:** Savings tile (moved to ⋯ menu)

---

## Bottom Navigation

**Items (5):** Home · Spending · [AI Advisor — center, raised] · Debt · ⋯

**Regular items:**
- Icon: 20px emoji
- Label: 9px
- Color: #475569 inactive, #6366f1 active
- flex: 1 each

**AI Advisor center button:**
- Container: margin-top -22px (raised above nav bar)
- Button: 54×54px circle, background linear-gradient(135deg, #6366f1, #8b5cf6)
- Border: 3px solid #0a0f1e (matches nav bg, creates cutout effect)
- Box shadow: 0 4px 24px rgba(99,102,241,.45)
- Icon: 3 concentric arcs (SVG, r=13/9/5, white, decreasing opacity 0.9/0.7/0.5) with "AI" text and "+" as dot over i
- Label: "Advisor", 9px, #6366f1, 700 weight

**⋯ More menu contains:**
- Savings
- Retirement
- Investments
- Insurance
- Settings (includes light/dark toggle, API key management, profile management)

---

## Responsive Breakpoint

`< 640px` → this mobile layout
`≥ 640px` → desktop layout (sidebar nav, drawer advisor panel, 3-col chart grid)

---

## Colors Reference

```javascript
const COLOR = {
  primary:  "#6366f1",  // indigo
  success:  "#10b981",  // emerald
  warning:  "#f59e0b",  // amber
  danger:   "#ef4444",  // red
  purple:   "#8b5cf6",
  cyan:     "#06b6d4",
  orange:   "#f97316",
};
const THEME_DARK = {
  bg:     "#020617",
  panelBg:"#0f172a",
  surf:   "#1e293b",
  deepBg: "#0a0f1e",
  border: "#1e293b",
  border2:"#334155",
  tx1:    "#f1f5f9",
  tx2:    "#94a3b8",
  tx3:    "#475569",
};
```

---

## Status

- [ ] IP check on ring concept before public launch
- [ ] Build prompt to be written after dashboard testing pass
- [ ] Mobile designs for individual module trackers TBD
