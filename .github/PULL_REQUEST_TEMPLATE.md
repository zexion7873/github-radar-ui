## What and why

<!-- What changed, and what it fixes or adds. WHY rather than WHAT: the diff
     already says what. If it fixes an issue, link it. -->

## How you know it works

<!-- Delete the lines that do not apply. -->

- [ ] `npm run lint && npm run build && npm test` passes.
- [ ] I looked at the changed page in a browser: signed out, signed in if it is
      under `/loot`, and at phone width if I touched layout. What I saw:
- [ ] I changed a test, and **showed the old code fails it**: which case, and
      what it printed:
- [ ] The change reads a new Notion column, and that column already exists and
      is backfilled in every table this page reads. (Otherwise the page shows a
      missing-property error the moment this deploys.)

> [!IMPORTANT]
> **Merging is deploying.** Vercel ships `main` to the live site, so a merged
> pull request is in production minutes later.

## Docs this makes stale

<!-- Which docs does this change invalidate? "None" is a fine answer; say it
     out loud rather than leaving this blank. CONTRIBUTING.md lists the ones
     that usually go stale. -->
