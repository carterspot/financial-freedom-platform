# Build Prompt — FFP Help Wiki Scaffold
# Issued by: CTO
# Target: Claude Code (Claudius)
# Session type: Single Clone — no parallel sessions, this touches shared CSS and index

---

## READ FIRST — before writing a single file

1. `CLAUDE.md` — session identity and repo conventions
2. `docs/project-instruction.md` — full platform context, module list, storage keys
3. `docs/design-system.md` — FFP color tokens, typography, spacing standards
4. `docs/whats-new.html` — reference for the FFP dark design language in plain HTML
5. `docs/index.html` — reference for nav and footer patterns

Do not write any files until you have read all five. The wiki must feel like it belongs to the same product as the platform. Design parity is non-negotiable.

---

## Objective

Build the complete file scaffold for the FFP Help Wiki at `docs/wiki/`. This includes:

- One shared stylesheet (`wiki.css`)
- One index / landing page (`index.html`)
- 28 article stub files organized into 6 subdirectories
- All files cross-linked correctly
- Zero placeholder Lorem Ipsum — use structured placeholder comments instead (see Article Stub Spec below)

**You are building structure and design. You are NOT writing help content.** Article stubs get correct HTML shells with section headings and `<!-- CONTENT: ... -->` comment markers. The CTO will fill the actual text in a separate pass.

---

## File Structure to Create

```
docs/wiki/
├── wiki.css                          ← shared stylesheet (all pages link to this)
├── index.html                        ← TOC landing page with search
├── getting-started/
│   ├── what-is-ffp.html
│   ├── setup-profile.html
│   ├── add-api-key.html
│   ├── first-week.html
│   └── freedom-score.html
├── modules/
│   ├── dashboard.html
│   ├── debt-tracker.html
│   ├── spending-tracker.html
│   ├── income-tracker.html
│   ├── savings-module.html
│   ├── retirement-module.html
│   ├── investment-module.html
│   └── insurance-tracker.html
├── ai-advisor/
│   ├── how-it-works.html
│   ├── depth-settings.html
│   └── privacy.html
├── data/
│   ├── backup-restore.html
│   ├── switching-devices.html
│   └── delete-data.html
├── troubleshooting/
│   ├── api-key-issues.html
│   ├── csv-import-issues.html
│   ├── data-not-syncing.html
│   └── module-not-loading.html
└── glossary.html
```

Total: 1 CSS file + 1 index + 26 article stubs = 28 files.

---

## wiki.css — Design Spec

The wiki stylesheet must use FFP design tokens exactly. No deviations.

**Core variables (copy these exactly):**
```css
:root {
  --bg:      #020617;
  --panel:   #0f172a;
  --surf:    #1e293b;
  --border:  #1e293b;
  --border2: #334155;
  --tx1:     #f1f5f9;
  --tx2:     #94a3b8;
  --tx3:     #475569;
  --primary: #6366f1;
  --success: #10b981;
  --warning: #f59e0b;
  --danger:  #ef4444;
  --purple:  #8b5cf6;
}
```

**Font stack:**
```css
body { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
```

Include the Google Fonts import for DM Sans in wiki.css:
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
```

**Layout — two-column desktop, single-column mobile:**
- Left sidebar: 240px fixed, sticky, contains section nav and back-to-index link
- Main content: max-width 720px, centered in remaining space
- Full-width background: `var(--bg)`
- Content column padding: 48px 32px
- Mobile breakpoint: 768px — sidebar collapses to top nav strip

**Sidebar nav:**
- Section headers: 9px uppercase, letter-spacing 1.5px, `var(--tx3)`
- Nav links: 13px, `var(--tx2)`, hover `var(--tx1)`, active link `var(--primary)` with left border 2px `var(--primary)`
- Section groups separated by 24px gap
- Sticky top position, full viewport height

**Article typography:**
```
h1: 28px, weight 800, letter-spacing -0.5px, color var(--tx1)    ← article title
h2: 18px, weight 700, color var(--tx1), margin-top 40px
h3: 14px, weight 700, color var(--tx2), margin-top 24px, uppercase, letter-spacing 0.5px
p:  14px, line-height 1.7, color var(--tx2)
```

**Callout block** (use `<blockquote class="callout">` in articles):
```css
.callout {
  background: rgba(99,102,241,0.08);
  border-left: 3px solid var(--primary);
  border-radius: 0 8px 8px 0;
  padding: 12px 16px;
  margin: 20px 0;
  font-size: 13px;
  color: var(--tx2);
}
.callout.warning { border-left-color: var(--warning); background: rgba(245,158,11,0.08); }
.callout.success { border-left-color: var(--success); background: rgba(16,185,129,0.08); }
.callout.danger  { border-left-color: var(--danger);  background: rgba(239,68,68,0.08);  }
```

**See Also block** (bottom of every article):
```css
.see-also {
  border-top: 1px solid var(--border);
  margin-top: 48px;
  padding-top: 20px;
}
.see-also h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--tx3); margin-bottom: 12px; }
.see-also a  { display: inline-block; font-size: 13px; color: var(--primary); margin-right: 16px; text-decoration: none; }
.see-also a:hover { text-decoration: underline; }
```

**Breadcrumb** (top of every article):
```css
.breadcrumb { font-size: 11px; color: var(--tx3); margin-bottom: 24px; }
.breadcrumb a { color: var(--tx3); text-decoration: none; }
.breadcrumb a:hover { color: var(--tx2); }
.breadcrumb span { margin: 0 6px; }
```

**Last updated badge:**
```css
.meta { font-size: 11px; color: var(--tx3); margin-top: 8px; margin-bottom: 40px; font-family: 'JetBrains Mono', monospace; }
```

**Inline code:**
```css
code { font-family: 'JetBrains Mono', monospace; font-size: 12px; background: var(--surf); border: 1px solid var(--border2); border-radius: 4px; padding: 1px 6px; color: var(--primary); }
```

**Top nav bar** (same across all pages):
- Height 52px, background `var(--bg)`, border-bottom `1px solid var(--border)`
- Left: FFP logo mark (gradient div, 28px, border-radius 7px) + "Financial Freedom Platform" + "Help" pill
- Right: "Back to App" link → `https://carterspot.github.io/financial-freedom-platform/dashboard/`
- Sticky, z-index 100

---

## index.html — Landing Page Spec

**Structure:**
1. Top nav bar (shared)
2. Hero: "How can we help?" heading + search input
3. Six category cards in a 2×3 grid
4. Popular articles list (8 items)
5. Footer: "Can't find what you need? Contact us." + link placeholder

**Search input behavior:**
- Client-side JS only — filter `articleIndex` array on keyup, show matching titles as dropdown links
- `articleIndex` is a JS array of `{ title, url, section }` objects — hardcode all 26 articles into it
- No external libraries

**Category cards** (use these exactly):
```
Getting Started    → getting-started/what-is-ffp.html       icon: 🚀  color: var(--primary)
Modules Guide      → modules/dashboard.html                  icon: 📦  color: var(--success)
AI Advisor         → ai-advisor/how-it-works.html            icon: 🧠  color: var(--purple)
Your Data          → data/backup-restore.html                icon: 💾  color: var(--warning)
Troubleshooting    → troubleshooting/api-key-issues.html     icon: 🔧  color: var(--danger)
Glossary           → glossary.html                           icon: 📖  color: var(--tx2)
```

**Popular articles** (hardcode these 8 links):
1. Setting up your profile → getting-started/setup-profile.html
2. Adding your API key → getting-started/add-api-key.html
3. Importing a CSV in SpendingTracker → modules/spending-tracker.html
4. Avalanche vs Snowball — which to choose? → modules/debt-tracker.html
5. Understanding the Freedom Score → getting-started/freedom-score.html
6. Backup and restore your data → data/backup-restore.html
7. API key not working → troubleshooting/api-key-issues.html
8. What is a sinking fund? → glossary.html

---

## Article Stub Spec — apply to all 26 article files

Every article stub must follow this exact HTML structure. No exceptions.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>[ARTICLE TITLE] — FFP Help</title>
  <link rel="stylesheet" href="../wiki.css"/>  <!-- adjust depth as needed -->
</head>
<body>

  <!-- TOP NAV (identical across all pages) -->
  <nav class="wiki-nav">
    <div class="wiki-nav-inner">
      <div class="wiki-nav-left">
        <div class="wiki-logo"></div>
        <span class="wiki-product">Financial Freedom Platform</span>
        <span class="wiki-help-pill">Help</span>
      </div>
      <a href="https://carterspot.github.io/financial-freedom-platform/dashboard/" class="wiki-app-link">← Back to App</a>
    </div>
  </nav>

  <div class="wiki-layout">

    <!-- SIDEBAR (section-specific — see Sidebar Nav Content below) -->
    <aside class="wiki-sidebar">
      <!-- SIDEBAR CONTENT: [SECTION NAME] -->
    </aside>

    <!-- MAIN CONTENT -->
    <main class="wiki-main">

      <div class="breadcrumb">
        <a href="../index.html">Help</a>
        <span>›</span>
        <a href="[SECTION INDEX]">[SECTION NAME]</a>
        <span>›</span>
        [ARTICLE TITLE]
      </div>

      <h1>[ARTICLE TITLE]</h1>
      <div class="meta">Last updated: April 2026</div>

      <!-- CONTENT: Introduction paragraph — 2-3 sentences explaining what this article covers -->

      <h2>[FIRST SECTION HEADING]</h2>
      <!-- CONTENT: [description of what goes here] -->

      <h2>[SECOND SECTION HEADING]</h2>
      <!-- CONTENT: [description of what goes here] -->

      <!-- Add H2 sections as appropriate per article. See Section Outlines below. -->

      <div class="see-also">
        <h4>See Also</h4>
        <!-- CONTENT: 2-3 related article links -->
      </div>

    </main>
  </div>

</body>
</html>
```

**CSS path depth by directory:**
- Files in `docs/wiki/` root → `href="wiki.css"`
- Files in subdirectories → `href="../wiki.css"`

---

## Section Outlines — H2 headings per article stub

Use these exact H2 headings in each stub. Do not invent your own. These are the content map.

### getting-started/what-is-ffp.html
Title: "What is Financial Freedom Platform?"
H2s: "The platform at a glance" / "Your modules" / "The Freedom Score" / "Getting started"

### getting-started/setup-profile.html
Title: "Setting Up Your Profile"
H2s: "Creating your first profile" / "Profile settings" / "Adding family members" / "Recovery PIN"

### getting-started/add-api-key.html
Title: "Adding Your API Key"
H2s: "Why you need an API key" / "Getting your key from Anthropic" / "Where to enter it" / "Testing your key" / "Keeping your key secure"

### getting-started/first-week.html
Title: "Your First Week Checklist"
H2s: "Day 1 — Set up your profile" / "Day 2-3 — Add your debts and income" / "Day 4-5 — Import your first transactions" / "Day 6-7 — Review your Freedom Score"

### getting-started/freedom-score.html
Title: "Understanding the Freedom Score"
H2s: "How the score is calculated" / "The three rings" / "What moves your score" / "Freedom vs Wealth mode"

### modules/dashboard.html
Title: "Dashboard"
H2s: "Overview" / "Freedom Rings" / "Stat tiles" / "Alert cards" / "Charts" / "AI Advisor panel" / "Module health rings (sidebar)"

### modules/debt-tracker.html
Title: "Debt Tracker"
H2s: "Adding your debts" / "Avalanche vs Snowball" / "The payoff planner" / "Strategy Builder" / "What-If scenarios" / "0% APR promo tracking" / "Importing from CSV"

### modules/spending-tracker.html
Title: "Spending Tracker"
H2s: "Importing a bank or credit card CSV" / "Category rules" / "AI batch categorization" / "Reviewing flagged transactions" / "Your spending baseline" / "Trends and history"

### modules/income-tracker.html
Title: "Income Tracker"
H2s: "Adding income streams" / "Frequency and normalization" / "Stability ratings" / "Income types explained"

### modules/savings-module.html
Title: "Savings Module"
H2s: "Funds vs Goals — what's the difference" / "Accumulation goals" / "Sinking funds" / "Emergency fund calculator" / "Monthly contribution tracking" / "AI Advisor"

### modules/retirement-module.html
Title: "Retirement Module"
H2s: "Account types" / "Your retirement profile" / "The projection chart" / "Withdrawal plans" / "Social Security and pension" / "AI readiness analysis"

### modules/investment-module.html
Title: "Investment Module"
H2s: "Adding accounts and positions" / "Tracking cost basis and gains" / "AI price updates" / "Dividend logging" / "Portfolio allocation chart" / "AI analysis"

### modules/insurance-tracker.html
Title: "Insurance Tracker"
H2s: "Setting your PIN" / "Coverage types" / "Adding policies" / "Understanding the Legacy Ring" / "Coverage gap analysis" / "Emergency info for family"

### ai-advisor/how-it-works.html
Title: "How the AI Advisor Works"
H2s: "What data it reads" / "How it generates recommendations" / "Confidence and limitations" / "Re-running your analysis"

### ai-advisor/depth-settings.html
Title: "AI Advisor Depth Settings"
H2s: "Brief vs Standard vs Detailed" / "When to use each level" / "Changing your setting"

### ai-advisor/privacy.html
Title: "AI Advisor Privacy"
H2s: "What leaves your device" / "How your data is used" / "Your API key" / "Opting out of AI features"

### data/backup-restore.html
Title: "Backup and Restore"
H2s: "JSON backup — full data export" / "CSV export" / "Restoring from a backup" / "Replace vs Merge on import" / "Backup schedule recommendation"

### data/switching-devices.html
Title: "Switching Devices or Browsers"
H2s: "Cloud sync — how it works" / "Local Only mode" / "Transferring your data manually" / "Recovery PIN"

### data/delete-data.html
Title: "Deleting Your Data"
H2s: "Deleting a profile" / "Deleting module data" / "Full reset" / "Data we don't store"

### troubleshooting/api-key-issues.html
Title: "API Key Not Working"
H2s: "Check your key format" / "Status indicator colors" / "Rate limiting" / "Key entered in the wrong module" / "Getting a new key"

### troubleshooting/csv-import-issues.html
Title: "CSV Import Issues"
H2s: "Column mapping" / "Sign direction (debits vs credits)" / "Duplicate transactions" / "Encoding and special characters" / "Bank-specific known issues"

### troubleshooting/data-not-syncing.html
Title: "Data Not Syncing Between Devices"
H2s: "Cloud sync requirements" / "Local Only mode explained" / "Force-refreshing storage" / "Manual backup as fallback"

### troubleshooting/module-not-loading.html
Title: "Module Not Loading"
H2s: "Check the platform status" / "Clear your browser cache" / "Try a different browser" / "Contact support"

### glossary.html
Title: "Glossary"
— No H2 structure. Use a definition list pattern instead:

```html
<dl class="glossary-list">
  <dt>Freedom Score</dt>
  <dd><!-- CONTENT: definition --></dd>

  <dt>Avalanche Method</dt>
  <dd><!-- CONTENT: definition --></dd>
  
  <!-- Continue for all terms below -->
</dl>
```

Glossary terms to stub (in alphabetical order):
Accumulation Goal / Avalanche Method / Baseline Monthly Expenses / Cloud Sync / Cost Basis / Debt-to-Income Ratio (DTI) / Emergency Fund / Essential Category / Freedom Score / Freedom Rings / Horizon Ring / Legacy Ring / Momentum Ring / Net Position / Promo APR / Recovery PIN / Sinking Fund / Snowball Method / Stability Rating / Unrealized Gain / Wealth Rings / Withdrawal Rate

Add a `.glossary-list dt` style in `wiki.css`:
```css
.glossary-list dt { font-size: 14px; font-weight: 700; color: var(--tx1); margin-top: 24px; }
.glossary-list dd { font-size: 13px; color: var(--tx2); line-height: 1.7; margin-left: 0; margin-top: 4px; padding-left: 16px; border-left: 2px solid var(--border2); }
```

---

## Sidebar Nav Content

Each article's sidebar must show the full section nav — all articles in that section — with the current article highlighted as active. Build the sidebar as a static HTML nav block per section. Reuse the same block across all articles in the same section.

**Section → article list mapping:**

Getting Started: What is FFP / Setup Profile / Add API Key / First Week / Freedom Score
Modules: Dashboard / Debt Tracker / Spending Tracker / Income Tracker / Savings Module / Retirement Module / Investment Module / Insurance Tracker
AI Advisor: How It Works / Depth Settings / Privacy
Your Data: Backup & Restore / Switching Devices / Deleting Data
Troubleshooting: API Key Issues / CSV Import Issues / Data Not Syncing / Module Not Loading
Glossary: (no sub-nav, single page)

The sidebar also always shows a top-level section list linking to the first article in each section, so users can jump sections from anywhere.

---

## Verification Checklist

Before committing, verify:

- [ ] All 28 files exist at the correct paths
- [ ] CSS path depth is correct per file (root vs subdirectory)
- [ ] Every article has: nav bar, breadcrumb, H1, meta date, correct H2 stubs, see-also block
- [ ] Sidebar nav in each article shows correct section and highlights active article
- [ ] index.html search JS references all 26 article paths correctly
- [ ] All internal links are relative (not absolute) — e.g. `../modules/dashboard.html` not full URLs
- [ ] Back to App link is correct: `https://carterspot.github.io/financial-freedom-platform/dashboard/`
- [ ] No Lorem Ipsum anywhere — only `<!-- CONTENT: ... -->` placeholder comments
- [ ] Mobile layout works at 375px width (sidebar collapses)
- [ ] Open `docs/wiki/index.html` in browser via `cd preview && npm run dev` and confirm search, category cards, and nav bar render correctly

---

## Commit

```
git add docs/wiki/
git commit -m "docs: Help Wiki scaffold — 28 files, wiki.css, index with search, article stubs"
git push
```

---

## Report Format

Reply with:
1. Confirmation all 28 files created
2. Any structural decisions you made that deviated from this spec and why
3. CSS pixel count (approximate lines) so CTO can gauge file size
4. One sentence on any cross-linking edge cases encountered
5. Confirmation search JS works in local preview
