# GitHub Radar

A single-user, mobile-friendly dashboard over the GitHub and AI-blog Claude Code
routines in [`ai-assistant`](../ai-assistant). It reads their Notion archive tables
directly, renders them as a browsable, filterable web UI, and writes a loot item's
triage state back to Notion in place:

| Page | Source table | Shows |
|---|---|---|
| `/` | Trending + Loot + Blog | **Dashboard** — top-5 hot repos + latest blog posts (each with a blurb) + one summary card per loot ledger |
| `/trending` | Trending Archive | Weekly trending AI repos, filterable by category, with 🆕 / 🔁 weeks-on-chart |
| `/blog` | Blog Archive | AI/agent blog posts grouped 官方 / 個人, each with a one-paragraph summary + 點評, newest first |
| `/loot/claude` | Loot Ledger (Claude Code) | Loot grouped by status (new / adopted / skipped), with editable status and a read-only rating |
| `/loot/copilot` | Loot Ledger (Copilot) | Same, for the Copilot target |

Loot **status is editable from the UI** and persists straight back to Notion
(`PATCH /v1/pages/{id}`); the rating is read-only display. Reads use
`POST /v1/data_sources/{id}/query`. Both run server-side only — the Notion token
never reaches the browser.

## Stack

- Next.js 16 (App Router) + Tailwind CSS 4, deployed on Vercel
- Talks to Notion via the REST API with a server-side internal integration token,
  never the browser
- Self-hosted password gate: a request gate in [`proxy.ts`](proxy.ts) plus a
  `/login` server action — the Vercel free tier can't password-protect production,
  so auth lives in the app

## Setup

1. **Create a Notion integration.** Go to
   <https://www.notion.so/profile/integrations> → New integration → Internal.
   Because the UI writes loot state back, give it **Read content** *and*
   **Update content** capability. Copy the secret (starts with `ntn_`).
2. **Share the four databases into it.** Open each in Notion → `•••` →
   Connections → add the integration: Trending Archive, Blog Archive, Loot Ledger
   (Claude Code), Loot Ledger (Copilot). Unshared tables return 404.
3. **Set the three env vars.** Copy `.env.example` to `.env.local` and fill in all
   three:
   ```
   NOTION_TOKEN=ntn_xxx   # the integration secret from step 1
   APP_PASSWORD=...        # the password you type to log in
   AUTH_SECRET=...         # high-entropy random cookie secret
   ```
   Generate `AUTH_SECRET` with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   > **All three are required.** If `AUTH_SECRET` is unset the gate fails *safe*:
   > every route redirects to `/login` and login can never succeed, so the app is
   > unreachable. That is deliberate — an unset secret must not mean "open".
4. **Run it.**
   ```bash
   npm run dev
   ```
   Open <http://localhost:3000> and log in with `APP_PASSWORD`.

The four data-source UUIDs (and the pinned `2025-09-03` Notion API version) live in
[`lib/config.ts`](lib/config.ts).

## Deploy

Push to a Git remote, import the repo at <https://vercel.com/new>, set all three
environment variables (`NOTION_TOKEN`, `APP_PASSWORD`, `AUTH_SECRET`), and deploy.
The in-app password gate covers every route, so no Vercel Deployment Protection is
needed.
