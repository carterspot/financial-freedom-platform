# Cloudflare Worker Rollback — PI Documentation
**File:** `docs/project-instruction.md`
**Author:** CTO
**Date:** 2026-04-07

---

## Before You Start

Read `docs/project-instruction.md`. This is a documentation-only change — no module code, no Vite build.

---

## Objective

Replace the existing "Worker reliability" bullet block in `docs/project-instruction.md` with a full rollback procedure section.

---

## Find This Block (around line 71)

```
**Worker reliability:**
- Free tier: 100,000 requests/day — sufficient for under 10 users
- If worker goes down: swap `API_URL` back to `"https://api.anthropic.com/v1/messages"` and deploy from a server context (not browser)
- Monitor at: `dash.cloudflare.com` → Workers → ffp-api-proxy → Analytics
- This is a single point of failure for all AI features — monitor occasionally
```

---

## Replace With

```
**Cloudflare Worker — ffp-api-proxy**
URL: `https://ffp-api-proxy.carterspot.workers.dev/`
All modules use this as `API_URL`. Never call `api.anthropic.com` directly from browser contexts — CORS blocks it everywhere (GitHub Pages, localhost, artifact public URLs).

**Monitoring:** `dash.cloudflare.com` → Workers → ffp-api-proxy → Analytics
Free tier: 100,000 requests/day. Sufficient for under 10 users.

**Failure modes:**
- Worker down → all AI features fail across all modules simultaneously (SPOF)
- Rate limit hit → 429 responses; AI calls fail unless error handling catches the status code

**Rollback procedure (if worker goes down):**
1. In each active module file (`modules/spending.jsx`, `modules/income-tracker.jsx`, `modules/debt-tracker.jsx`, `modules/savings.jsx`, `modules/retirement.jsx`), change:
   `const API_URL = "https://ffp-api-proxy.carterspot.workers.dev/";`
   to:
   `const API_URL = "https://api.anthropic.com/v1/messages";`
2. **This only works from a server context.** Direct browser calls to `api.anthropic.com` are CORS-blocked on GitHub Pages. For a temporary fix, serve the affected module from localhost: `cd preview && npm run dev`.
3. **Permanent fix:** Restore the worker or provision a new one at `dash.cloudflare.com` → Workers → Create. The worker script is a simple CORS proxy (~15 lines) — recreate in under 10 minutes.

**Worker source:** Adds `Access-Control-Allow-Origin` headers and forwards the request body to `api.anthropic.com/v1/messages`. If the worker script is lost, the pattern is: read request body → add CORS headers → forward to Anthropic → return response.
```

---

## Commit

```
git add docs/project-instruction.md
git commit -m "docs: Cloudflare Worker rollback procedure documented in PI"
git push
```

No Vite build needed — docs only.

---

## Report Back

Confirm the section was updated and pushed successfully.
