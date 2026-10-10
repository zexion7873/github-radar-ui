<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Working on this repo

This UI's **server** talks to **Notion only**. It renders the archive tables the
[`ai-assistant`](../ai-assistant) routines write, and never calls GitHub / ecosyste.ms
itself. The one exception runs in the browser: `/ask`'s client code calls radar-rag's
public `POST /ask` directly. It holds no secret (the Turnstile site key is public), no
other page depends on it, and a radar-rag outage only breaks `/ask`. Its request and
response shape, plus the 403 / 429 / 502 / 503 codes, are a cross-repo contract that
radar-rag's AGENTS.md also records. Its one write is the loot `Status` select (a password-gated Server Action), which
must `updateTag` that ledger's cache tag or the next read serves the old status for up
to 600s. New per-repo fields are added write-time in those routines (a new Notion
column), then read here. The signal set is documented in [`docs/signals.md`](docs/signals.md).

Gotchas that will bite you:

- **Reading a new Notion column?** It must already exist in the table. `assertProps`
  (`lib/data.ts`) throws if a key in `*_PROPS` is missing from row 1 — the routine must
  create + backfill the column before the UI can read it.
- **Verifying a Notion change on dev?** `unstable_cache` holds reads for 600s. Wipe
  `.next` (not just restart dev) or you'll test against stale data and think it failed.
- **`lib/data.ts` is `server-only`.** Never import its values into a `"use client"`
  component (build poison) — compute server-side and pass as a prop, the way `series` /
  `momentum` reach `TrendingList`.
- **Changing `/trending/[id]` or `/blog/[id]`?** radar-rag cites sources by Notion page id
  (the dashed UUID in `row.id`), and both `/ask` here and radar-rag's own page link those
  citations to these two routes. So both must stay public,
  and `/trending/[id]` must keep resolving ANY week's row id to the repo's full history.
  Renaming, re-keying or gating either route breaks those links. Coordinate with radar-rag
  before deploying; its AGENTS.md records the same contract.
- Next 16 specifics (incl. `middleware.ts` → `proxy.ts`) are distilled in
  [`NEXT16-BREAKING-CHANGES.md`](NEXT16-BREAKING-CHANGES.md).
