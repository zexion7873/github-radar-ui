<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Working on this repo

This UI is a **pure Notion reader** — it renders the archive tables the
[`ai-assistant`](../ai-assistant) routines write; it never calls GitHub / ecosyste.ms
itself. New per-repo fields are added write-time in those routines (a new Notion
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
- Next 16 specifics (incl. `middleware.ts` → `proxy.ts`) are distilled in
  [`NEXT16-BREAKING-CHANGES.md`](NEXT16-BREAKING-CHANGES.md).

## Commits

Set the git **author** to Claude on commits Claude wrote —
`git commit --author="Claude <noreply@anthropic.com>"`; the human stays the
committer. GitHub's repo Contributors sidebar credits the commit **author**, not
`Co-Authored-By` co-authors (those only count toward the Insights graph + the
account's profile), so authoring as Claude is what surfaces @claude in the
contributor list. This replaces the `Co-Authored-By: Claude` trailer for this
repo — don't use both.
