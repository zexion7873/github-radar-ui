# GitHub Radar

A single-user, mobile-friendly dashboard over the three GitHub-focused Claude Code
routines in [`ai-assistant`](../ai-assistant). It reads their Notion archive tables
directly and renders them as a browsable, filterable web UI:

| Page | Source table | Shows |
|---|---|---|
| `/` | Trending Archive | Weekly trending AI repos, filterable by category, with 🆕 / 🔁 weeks-on-chart |
| `/loot/claude` | Loot Ledger (Claude Code) | Loot grouped by status (new / adopted / skipped) |
| `/loot/copilot` | Loot Ledger (Copilot) | Same, for the Copilot target |

This is **phase 1: read-only.** Writing a loot item's status back to Notion from the
UI is deferred to phase 2.

## Stack

- Next.js 16 (App Router) + Tailwind CSS 4, deployed on Vercel
- Reads Notion via the REST API with a server-side internal integration token
  (`POST /v1/data_sources/{id}/query`), never the browser
- No auth code — access is gated by Vercel's built-in password protection

## Setup

1. **Create a Notion integration.** Go to
   <https://www.notion.so/profile/integrations> → New integration → Internal →
   capability **Read content**. Copy the secret (starts with `ntn_`).
2. **Share the three databases into it.** Open each in Notion → `•••` →
   Connections → add the integration: Trending Archive, Loot Ledger (Claude Code),
   Loot Ledger (Copilot). Unshared tables return 404.
3. **Add the token.** Paste it into `.env.local`:
   ```
   NOTION_TOKEN=ntn_xxx
   ```
4. **Run it.**
   ```bash
   npm run dev
   ```
   Open <http://localhost:3000>.

The three data-source UUIDs are in [`lib/config.ts`](lib/config.ts).

## Deploy

Push to a Git remote, import the repo at <https://vercel.com/new>, set the
`NOTION_TOKEN` environment variable, and deploy. Then enable **Vercel password
protection** (Project → Settings → Deployment Protection) so only you can read it.
