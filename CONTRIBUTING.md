# Contributing

**Read [AGENTS.md](AGENTS.md) before you write anything.** It is short on
purpose. The three traps below are the ones that waste an afternoon if you meet
them by surprise; AGENTS.md and
[NEXT16-BREAKING-CHANGES.md](NEXT16-BREAKING-CHANGES.md) have the rest.

## Three things that will cost you an afternoon

**This is not the Next.js you know.** It runs Next.js 16, where APIs,
conventions and file names changed: `middleware.ts` is now `proxy.ts`, for one.
Code written from memory of an older version compiles less often than you would
hope. Read the guide in `node_modules/next/dist/docs/` for whatever you touch.

**Your Notion edit is not stale data; it is the cache.** Reads go through
`unstable_cache` for 600 seconds. Restarting `npm run dev` does not clear it;
deleting the whole `.next` directory does. Test a data change any other way and
you will conclude it failed when it did not.

**A new column must exist in Notion before the code reads it.** `assertProps`
in `lib/data.ts` rejects a table whose first row lacks a key from that page's
`*_PROPS` map, and the page shows that error instead of its list. Columns are
added and backfilled upstream first, and only then read here.

One more that only bites late: `lib/data.ts` is `server-only`. Importing its
values into a `"use client"` component breaks the build. Compute on the server
and pass the result down as a prop.

## Working on it

```bash
npm run dev                                 # http://localhost:3000
npm run lint && npm run build && npm test   # exactly what CI runs
```

The build and the tests need no environment variables and no Notion access, so
you can run all three on a fresh clone. Running the pages with real data needs
the three variables in [the README](README.md#-run-it-yourself) and tables with
the same schema.

"Verified" means: lint, build and tests pass, and **you have looked at the
changed page in a browser**, both signed out and, for anything under `/loot`,
signed in, and at phone width if you touched layout. A green test is one more
kind of evidence, not a replacement for looking.

## Pull requests

Do not open a pull request you could not explain line by line if asked. That
rule, and the two beside it, are in the
[Code of Conduct](CODE_OF_CONDUCT.md#send-work-you-understand).

Conventional Commits (`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` /
`test:` / `perf:`), in English, saying WHY rather than WHAT. One logical change
per commit.

If your change alters behaviour, interfaces, or project state, the docs it makes
stale are part of the diff: README, AGENTS.md, `docs/signals.md` if a signal's
rule or display changed, and `app/opengraph-image.png` if the site's look or
description did.
