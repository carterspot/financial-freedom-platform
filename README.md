# Financial Freedom Platform

> An AI-powered personal finance platform for debt elimination, spending control, savings growth, and retirement readiness.

Built as a collection of standalone Claude artifacts (React) that share a common design system, storage strategy, and AI integration. Each module is independently useful today and will be unified into a single dashboard over time.

---

## Modules

| Module | Status | Description |
|---|---|---|
| 💳 CardTracker | ✅ Complete | Credit card debt tracker and payoff planner |
| 🏦 DebtTracker | 🔲 Planned | Cards + loans unified debt elimination planner |
| 💰 Income | 🔲 Planned | Income streams, stability tracking, cash flow |
| 📊 Spending | 🔲 Planned | Budget categories, actuals, trends |
| 🏦 Savings | 🔲 Planned | Emergency fund and savings goal tracker |
| 📈 Retirement | 🔲 Planned | 401k, IRA, projections, contribution optimizer |
| 🧠 AI Advisor | 🔲 Planned | Holistic cross-module financial planning |

---

## CardTracker — Feature Overview

- Multi-profile support with Recovery PIN (cross-device data recovery without a cloud account)
- Credit card CRUD with color coding, utilization tracking, and due date calendar
- Avalanche and snowball payoff schedule simulations with charts
- AI Analysis, What-If chat, and Strategy Builder (powered by Anthropic API)
- Payment progress tracker with monthly log
- Export (JSON + CSV) and Import (JSON + CSV) — full backup and restore
- Cloud storage sync (`window.storage`) with automatic localStorage fallback
- Dark / light mode

---

## Tech Stack

- **Framework:** React (single-file `.jsx` artifacts, no build step)
- **Styling:** Inline styles with shared `useTheme()` hook — no CSS files, no Tailwind
- **Charts:** SVG — no external chart libraries
- **Storage:** `window.storage` (Claude artifact cloud) with `localStorage` fallback
- **AI:** Anthropic Messages API (`claude-sonnet-4-20250514`), non-streaming
- **Dependencies:** Zero — no npm, no CDN libraries beyond React

---

## Project Structure

```
financial-freedom-platform/
├── README.md
├── docs/
│   ├── project-instruction.md   # Full Claude project context and architecture
│   └── design-system.md         # Theme, colors, component conventions
├── modules/
│   ├── card-tracker.jsx          # ✅ Complete
│   ├── debt-tracker.jsx          # 🔲 Placeholder
│   ├── income.jsx                # 🔲 Placeholder
│   ├── spending.jsx              # 🔲 Placeholder
│   ├── savings.jsx               # 🔲 Placeholder
│   └── retirement.jsx            # 🔲 Placeholder
└── shared/
    └── design-system.md
```

---

## Storage Key Convention

Each module uses a unique prefix to avoid collisions:

| Module | Prefix | Example key |
|---|---|---|
| CardTracker | `cc_` | `cc_cards_pin_smithfamily` |
| DebtTracker | `dt_` | `dt_loans_pin_smithfamily` |
| Income | `inc_` | `inc_streams_pin_smithfamily` |
| Spending | `sp_` | `sp_budget_pin_smithfamily` |
| Savings | `sav_` | `sav_goals_pin_smithfamily` |
| Retirement | `ret_` | `ret_accounts_pin_smithfamily` |
| Cross-module | `ffp_` | `ffp_advisor_context` |

---

## Profile & Identity

All modules share the same profile system. A profile has an optional **Recovery PIN** — a memorable word or phrase chosen by the user that becomes the stable storage key. This allows full data recovery on any device without requiring a cloud account.

```json
{
  "id": "pin_smithfamily",
  "name": "Carter",
  "pin": "smithfamily",
  "avatarColor": "#6366f1",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

---

## AI Integration

All AI calls use the Anthropic Messages API directly from the artifact. The API key is stored once in shared cloud storage and automatically available to all users of the artifact URL.

```javascript
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL   = "claude-sonnet-4-20250514";
```

**Important:** All AI calls are non-streaming (`await res.json()`). Streaming is unreliable in the Claude artifact sandbox and causes freezing.

---

## Development Notes

See [`docs/project-instruction.md`](docs/project-instruction.md) for the full Claude project context including schemas, critical JSX rules, design decisions, and session log.

See [`docs/design-system.md`](docs/design-system.md) for the complete shared design system.

---

## Roadmap

- [ ] CardTracker — minor UI polish and mobile review
- [ ] DebtTracker — loan form, amortization engine, unified strategy planner
- [ ] Income Module — stream tracking, stability rating, cash flow output
- [ ] Spending Module — category budgets, actuals, available cash calculation
- [ ] Savings Module — emergency fund goal, named savings goals
- [ ] Retirement Module — projections, contribution optimizer
- [ ] AI Advisor — holistic cross-module planning (capstone)
- [ ] Platform unification — single dashboard linking all modules
