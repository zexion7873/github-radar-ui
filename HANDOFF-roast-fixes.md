# HANDOFF — roast-review fixes

Self-contained work plan for whoever picks this up. You do **not** need the chat
session that produced it — every finding cites an exact `file:line` you can open
cold.

## Where this came from

A 21-agent adversarial review (4 review dimensions, each finding re-verified by an
independent skeptic agent) surfaced **15 confirmed issues** in this repo and rejected
2 false positives. The two rejected ones — a "spoofable `x-forwarded-for`" login
rate-limit (moot: Vercel overwrites XFF at the edge) and a "`server-only` imported
into a client component" (safe: it's `import type`, erased at compile time) — are
**not** in scope; they were checked and dismissed.

## Two decisions already locked (do not re-litigate)

- **Security docs vs. code**: `proxy.ts` deliberately gates only `/loot/:path*`
  (commit `dc7e59b` intentionally opened dashboard/blog/trending to the public).
  README.md / HANDOFF.md still claim the gate covers the whole site.
  → **Fix the docs to match the code. Do NOT widen the gate.**
- **Scope**: all 15 findings, this pass, batched by priority below.

No behavior change is intended except items **2** (error sanitization), **4** (a11y
attributes), and **8** (optional Dashboard split — purely structural).

## Progress (session of 2026-07-01)

Filed as GitHub issues (high/medium): #32 (security docs), #33 (DataError leak),
#34 (a11y select/search names), #35 (HANDOFF read-only), #36 (signals.md stale),
#37 (no tests).

Already fixed in this session (build + lint green):
- **DONE** — `.env.example` now lists all four DBs incl. Blog Archive (item 5).
- **DONE** — `assertProps` comment corrected re: sort-key vs non-sort-key failure
  paths (item 7).
- **DONE** — dead `multi()` extractor removed from `lib/notion.ts` (item 7).
- **DONE** — `aria-label` added to the three `<input type="search">` controls; the
  bare `<select>` half of item 4 is still open (tracked in #34).
- **WONTFIX** — `"new"` → `LOOT_STATUSES[0]` (item 7). A grep shows `"new"` appears
  in **4 files / 10 sites** (Dashboard, LootBoard ×7, `app/page.tsx`, loot detail),
  not the 4 the review flagged. Converting only some creates inconsistency;
  converting all is a cross-file refactor, not a nit. And `"new"` is Notion's real
  select-option name (self-documenting), while the true rename risk lands on
  `ui.tsx`'s `STATUS_LABEL` / `STATUS_TONE` / `STATUS_SPINE` map keys — which
  constant-izing these filters can't protect. Net: readability down, protection nil.

## Getting started

```bash
npm install
npm run build      # baseline: typecheck + lint should already pass
```

Then work Tier 1 → Tier 2 top to bottom. Each numbered item is a self-contained
commit (Conventional Commits: `fix:` / `docs:` / `refactor:` / `test:`).

---

## Tier 1 — Security & correctness (do first, own commits)

### 1. Fix security-posture claims (HIGH) — `docs:`
- `README.md:66-67` — replace "The in-app password gate covers every route, so no
  Vercel Deployment Protection is needed" with an accurate statement: the gate
  covers `/loot/*` only; dashboard/blog/trending are intentionally public (mirror
  the reasoning already in `proxy.ts`'s own comment, lines 16-19).
- `HANDOFF.md:18` — drop "every route except `/login`"; state the actual
  `/loot/:path*` matcher scope.

### 2. Stop leaking raw Notion errors to public pages (MEDIUM) — `fix:`
Root cause: `components/ui.tsx` `DataError` (206-233) renders `{error}` verbatim,
and that string is Notion's raw API response body (thrown in `lib/notion.ts:48-51`,
can embed data-source UUIDs). `app/error.tsx:3-4` already guards against exactly
this — but only for the React error boundary, not this `Result<T>` / `DataError`
path used by every public page.
- `components/ui.tsx` — keep the `error.includes("NOTION_TOKEN")` branch as-is
  (generic setup copy). In the **fallback** branch, stop rendering `{error}`;
  show a fixed generic message, e.g.
  「讀取失敗，請稍後再試；若持續發生，檢查伺服器紀錄或 Notion 分享設定。」
- `lib/data.ts` `load()` catch (152-156) — add `console.error(...)` logging the
  real error server-side before returning `{ok:false, error}`, so detail is moved
  off the page, not lost.

### 3. Add test infrastructure + first regression tests (MEDIUM) — `test:`
Repo currently has **zero** tests and no runner.
- Add `vitest` devDependency; add `"test": "vitest run"` to `package.json` scripts.
- New `vitest.config.ts`: set `resolve.conditions: ["react-server"]` — this is the
  condition Next itself uses to resolve `server-only` to its no-op `empty.js`
  instead of the throwing `index.js` (confirmed in
  `node_modules/server-only/package.json`'s `exports` map). Without it, importing
  `lib/data.ts` / `lib/notion.ts` in a test throws. Also alias `@` → project root
  to match `tsconfig.json`'s `paths`.
- Tests for existing pure functions (no source changes needed):
  - `lib/auth.test.ts` — `safeEqual` (length-mismatch → false; equal/unequal);
    `isAuthed` fail-safe when `AUTH_SECRET` unset.
  - `lib/notion.test.ts` — `text()` CJK half↔full-width punctuation normalization
    (the Han-neighbor lookaround in `normalizeCJKPunct`: Han-flanked `,;:!?` →
    full-width; Latin/digit-flanked untouched).
  - `lib/data.test.ts` — `latestPerRepo` / `latestLootPerRepo` (keep-latest-week
    dedup), `weeklySeriesByRepo` (ascending sort), `repoMomentum` (null when <2
    points; ratio math; zero-baseline guard returns null).

### 4. Accessible names for filter/search controls (MEDIUM, one pattern × 5 sites) — `fix:`
Neighboring `ChipScroller` already models the convention (`role="group"
aria-label={label}`). Apply the same idea to the bare controls:
- `<select>`: `LootBoard.tsx:117`, `TrendingList.tsx:83`.
- `<input type="search">`: `BlogList.tsx:132`, `LootBoard.tsx:109`,
  `TrendingList.tsx:76`.
- Reuse the Chinese labels already passed to the adjacent `ChipScroller`
  (e.g. 「狀態篩選」, 「分類篩選」) as the naming model.

---

## Tier 2 — Cleanup (after Tier 1, no behavior change)

### 5. Doc/code drift — mechanical text, bundle into one `docs:` commit
- `HANDOFF.md:18` — remove "**read-only**" (contradicts its own Phase 2 section at
  line 43 describing the shipped write-back).
- `docs/signals.md:97` — remove "不含 dashboard" (Dashboard's 🚀 本週竄升 section
  already renders Momentum; Maintained/Risk/License stay correctly absent).
- `.env.example:3` — "三個" → "四個", add Blog Archive to the list, matching
  `README.md:36-37`.

### 6. Dedupe duplicated pure logic — three small `refactor:` changes
- `lib/data.ts` — merge `latestPerRepo` (197-204) and `latestLootPerRepo` (256-263)
  into one generic `latestPerRepo<T extends {repo: string; week: string | null}>()`;
  update both call sites (`app/page.tsx`, `app/trending/page.tsx`,
  `app/loot/[target]/page.tsx`).
- New `weekDelta(pts: WeekPoint[])` helper in `components/ui.tsx` (next to
  `formatWeek`) — replaces the duplicated 4-line delta calc + ▲/▼ badge markup in
  `Dashboard.tsx:302-305` and `TrendingList.tsx:122-126`.
- New `CategoryBadge({ category })` in `components/ui.tsx` — replaces the identical
  `<Badge tone={CATEGORY_TONE[...] ?? "muted"}>` JSX repeated in Dashboard.tsx
  (twice) and TrendingList.tsx.

### 7. Small correctness/staleness nits — `fix:`
- Replace the 4 hardcoded `"new"` fallbacks (`Dashboard.tsx:49`, `LootBoard.tsx:63`,
  `:69`, `:97`) with `LOOT_STATUSES[0]` (already imported in LootBoard.tsx).
- Fix the `lib/data.ts:65-68` comment: it claims `assertProps` is the universal,
  consistent failure mechanism, but sort-key columns fail via a raw Notion 400
  *before* `assertProps` runs — reword to note the friendly message only covers
  non-sort-key columns.
- Delete the dead `multi()` extractor in `lib/notion.ts:146-147` (zero call sites,
  confirmed by repo-wide grep).

### 8. Dashboard.tsx god-component split (OPTIONAL, largest/riskiest — own commit, last)
Split the 433-line `Dashboard` function's five inline sections (CategoryMixBar,
HotSection, SurgingSection, BlogSection, LootFooterSummary) into their own
components, following the pattern already used for the file's own `SectionHeader` /
`LootSummaryCard` helpers. Keep it a standalone `refactor:` commit so it's easy to
review / revert independently.

---

## Verification

- `npm run build` (typecheck + lint together, per `HANDOFF.md`'s recipe)
- `npm run lint`
- `npm test` (new vitest suite — also proves `server-only` modules import cleanly
  under the `react-server` condition)
- Manual, via `npm run dev`:
  - Load `/`, `/blog`, `/trending` — confirm they still render normally.
  - Force a Notion read failure (break `NOTION_TOKEN`, or point a `TABLES` uuid at
    garbage) — confirm public pages now show the generic message, and the real
    error appears in the **server log**, not the page.
  - Tab through the select/search controls (or inspect the a11y tree) — confirm the
    new `aria-label`s are exposed.

## Gotchas (from AGENTS.md — read before touching data)

- This UI is a **pure Notion reader**. It never calls GitHub/ecosyste.ms.
- `lib/data.ts` is `server-only` — never import its *values* into a `"use client"`
  component (build poison). `import type` is fine.
- `unstable_cache` holds reads 600s — wipe `.next` (not just restart dev) to verify
  a data change on dev.
- `assertProps` throws if a `*_PROPS` key is missing from row 1 — a new Notion
  column must exist upstream before the UI can read it.
