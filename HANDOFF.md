# HANDOFF — github-radar-ui

A single-user, mobile-friendly dashboard over the three GitHub-focused Claude Code
routines in the sibling repo `../ai-assistant`. It reads their Notion archive tables
and renders them as a browsable web UI.

## Status

**Phase 1 (read-only) is DONE, deployed, and verified end-to-end on device.**

- Live: <https://github-radar-ui.vercel.app> (Vercel Hobby / free)
- Repo: github.com/zexion7873/github-radar-ui (private), branch `main`
- Stack: Next.js 16 (App Router) + Tailwind 4. Node-runtime everywhere.

What works:
- `/` — Trending Archive, category-filterable cards, 🆕/🔁 from `Weeks on chart`.
- `/loot/claude`, `/loot/copilot` — loot grouped by `Status` (new / adopted / skipped), **read-only**.
- App-level password gate (`proxy.ts`): every route except `/login` needs the `gh_radar`
  cookie to equal `AUTH_SECRET`. (Vercel free can't password-protect production, so the gate
  lives in the app.)
- Notion reads cached 10 min via `unstable_cache` (tag `"notion"`); warm TTFB ~6ms.

## Architecture (read path)

`lib/config.ts` — the four Notion data-source UUIDs (`TABLES`), `LOOT_TARGETS`, and
`NOTION_VERSION = "2025-09-03"` (the version that introduced data sources).

`lib/notion.ts` — server-only Notion REST client with its OWN internal integration token
(`process.env.NOTION_TOKEN`, NOT the Claude connector). `resolveDataSourceId(uuid)` turns a
`collection://` uuid into a queryable `data_source_id` (tries `/data_sources/{uuid}`, falls
back to `/databases/{uuid}` → `data_sources[0].id`). `queryAll()` POSTs to
`/data_sources/{id}/query` with cursor pagination. Plus typed property extractors
(`text`, `num`, `sel`, `multi`, `dateStart`, `urlProp`).

`lib/data.ts` — `fetchTrending(uuid)` / `fetchLoot(uuid)` return `Result<T>` (never throw;
`{ok:false,error}` renders a notice card). The read is wrapped in `unstable_cache(..., ["notion-table", uuid], {revalidate: 600, tags: ["notion"]})`. **Errors are not cached.**

`components/LootBoard.tsx` (server) renders the loot cards. `components/TrendingList.tsx`
(client) does the category filter. `app/loot/[target]/page.tsx` maps `claude`/`copilot` → uuid.

## Phase 2 — DONE (commit 9d7b766): loot Status write-back

Each loot card now has new / adopted / skipped buttons; a tap writes `Status` back to Notion via a
Server Action and the UI reflects it on reload, replacing the old "flip Status by hand in Notion".

**Deviation from the sketch below:** Task 2 sketched `revalidateTag("notion")`, but in Next 16 the
single-arg form is deprecated and `revalidateTag(tag, "max")` is stale-while-revalidate (a reload can
still show the old Status). The shipped action uses **`updateTag("notion")`** — verified against Next
source as the correct read-your-writes call for the `unstable_cache`-tagged data.

Shipped: `lib/notion.ts` (`updateSelect`), `app/loot/actions.ts` (`setLootStatus`, self-verifies the
session cookie + whitelists status), `components/LootStatusControl.tsx` (client toggle, `useOptimistic`
+ failure notice), `components/LootBoard.tsx` (embeds the control). Original plan kept below for reference.

### Tasks

1. **Notion write helper** in `lib/notion.ts`:
   ```ts
   export async function updateSelect(pageId: string, prop: string, value: string) {
     return notionFetch(`/pages/${pageId}`, {
       method: "PATCH",
       body: JSON.stringify({ properties: { [prop]: { select: { name: value } } } }),
     });
   }
   ```
   - Endpoint: `PATCH https://api.notion.com/v1/pages/{pageId}` (same auth/version headers as reads).
   - `pageId` is `LootRow.id` (already on every row).
   - `value` must match an existing option name EXACTLY: `new` | `adopted` | `skipped`
     (writing a typo'd name can spawn a duplicate option). Sketch `notionFetch` to accept a
     non-cached call (the current one is fine; only `lib/data.ts` adds caching).

2. **Server Action** `setLootStatus(pageId, status)` (e.g. `app/loot/actions.ts`, `"use server"`):
   - **SECURITY — verify the session inside the action.** `proxy.ts` does NOT cover Server
     Actions (they POST to their own route; Next docs are explicit). Read the cookie and compare:
     ```ts
     import { cookies } from "next/headers";
     const ok = (await cookies()).get("gh_radar")?.value === process.env.AUTH_SECRET;
     if (!ok || !process.env.AUTH_SECRET) throw new Error("unauthorized");
     ```
   - Then `await updateSelect(pageId, "Status", status)`.
   - Then `revalidateTag("notion")` (from `next/cache`) so the cached reads refresh and the new
     Status shows on reload.

3. **Client toggle UI**: a small client component for the card's buttons using React
   `useOptimistic` so the tap flips instantly while the action + revalidate resolve. `LootBoard`
   currently renders everything server-side; extract the per-card status control into a client
   component that calls the action.

### Companion fix — in the OTHER repo (`../ai-assistant`) — DONE (commit 0b7e87a)

`../ai-assistant/.claude/skills/loot-radar/SKILL.md` **step 10** wrote `Status = new` on a
same-week re-run UPDATE, which would clobber a hand-set (or UI-set) `adopted`/`skipped`. **Fixed:
`Status` is now written only on CREATE, never on UPDATE** (step 10 + the schema note both updated).

## Env vars

`.env.local` (gitignored) and Vercel project env both need:
- `NOTION_TOKEN` — internal integration token (`ntn_…`), server-side only.
- `APP_PASSWORD` — the login password.
- `AUTH_SECRET` — high-entropy cookie secret (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

`.env.example` documents them. Never commit `.env.local`.

## Verify a change

```bash
npm run build                     # typecheck + lint
PORT=3939 npm start               # prod server
# log in via the browser, or test the gate with a cookie:
curl -b "gh_radar=$AUTH_SECRET" -s -o /dev/null -w "%{http_code}\n" localhost:3939/loot/claude
```
After a write-back: confirm the Notion row's `Status` actually changed AND the card reflects it
on reload (revalidateTag worked). Vercel auto-redeploys on push to `main`.
