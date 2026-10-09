# Security Policy

## Reporting a vulnerability

**Do not open a public issue.** The live site runs whatever `main` holds, so a
working exploit in a public issue is a working exploit against production.

Use [GitHub's private vulnerability reporting](https://github.com/zexion7873/github-radar-ui/security/advisories/new).

This is a one-person project. You will get a first response within a few days,
not within hours. The fix ships as a commit to `main`, which Vercel deploys.

## Supported versions

Only what is deployed from `main`. There are no releases, tags or maintenance
branches.

## What the site does

Worth knowing before you decide whether something is in scope.

- **Reads.** Server-side requests to the Notion API with one internal
  integration token, against the tables listed in `lib/config.ts`. Results are
  cached for 600 seconds. The token is never sent to the browser.
- **One write.** A signed-in owner can set a loot row's `Status`. The Server
  Action re-checks the session, accepts only the four known status values, and
  only patches a page that belongs to the ledger the request names, so a forged
  POST cannot reach any other page the token can see.
- **The gate.** `/loot/*` requires a session. Login compares the password in
  constant time, delays every failure by a fixed amount, and counts failures
  per IP. The session cookie is HTTP-only, `SameSite=Lax`, `Secure` in
  production, and holds an expiry signed with HMAC-SHA256. The signing secret
  stays on the server. With the secret unset, the gate refuses everyone rather
  than letting everyone in.
- **Redirects.** The post-login redirect accepts same-origin paths only.
- **Automation.** The repository's `@claude` workflow runs only for comments,
  reviews and issues written by the repository owner.

### In scope

- Reaching `/loot/*` data, or the status write, without a valid session.
- A status write that lands on a page outside the named ledger, or writes a
  value other than the four statuses.
- An open redirect through the login flow.
- Anything that sends the Notion token, `AUTH_SECRET` or `APP_PASSWORD` to a
  browser or a log a visitor can read.
- Making the `@claude` workflow run for someone other than the owner.

### Out of scope

- The per-IP failure counter lives in one serverless instance's memory, so it
  is a speed bump, not a lockout. The fixed delay and a high-entropy password
  are the real defence. A report that the counter resets across instances is
  already known.
- Content in the public pages. It is what the upstream routines wrote, and
  rendering it is the point.
- Anything that needs an attacker who already controls the Notion workspace,
  the Vercel project or the repository. At that point the site is not the
  problem.
