# Field Audit — full chain (ai-assistant skills → Notion → github-radar-ui)

Date: 2026-06-26. Method: Notion MCP `notion-fetch` for ground-truth schema, live
REST row pulls (`/data_sources/{id}/query`, the same endpoint the app uses) for
data population, plus a code read of every reader/writer site.

## Pipeline

```
Claude Cloud Routine ──► ai-assistant/.claude/skills/<name>/SKILL.md (writes Notion)
                          ──► Notion data source ──► github-radar-ui (reads + renders)
```

The cross-layer contract is the Notion property **display name** as a hard-coded
string. There is no shared schema file; `assertProps()` in `lib/data.ts` turns a
renamed/removed column into a loud error instead of silent blank cards.

## Ground-truth schema (verified via MCP, 2026-06-26)

| Table | Notion display names | UI expectation | Verdict |
|---|---|---|---|
| Trending Archive | Repo, Stars/wk, Description, Link, Language, Comment, Category(select), Week(date), Weeks on chart | TRENDING_PROPS | exact match |
| Loot Ledger (Claude) | Repo, Intro, Asset, How, Why, Type(select), Status(select), Recommendation(number), Week(date), Link | LOOT_PROPS | exact match |
| Loot Ledger (Copilot) | identical to Claude | LOOT_PROPS | exact match |
| Blog Archive | Title, Type(select), Summary, Author, Brief, Comment, Source, Archived(date), Published(date), URL | BLOG_PROPS | exact match |

`Recommendation` (number) **exists** in both Loot tables — the `ai-assistant/AGENTS.md`
schema summary had simply omitted it (now fixed).

Music Chart Archive (`collection://fe29f21b-…`) is written weekly by `music-radar`
but is **out of scope** for this UI (`config.ts TABLES` has 4 entries, no music) and
was intentionally left unwired.

## P0 candidates — debunked against live data

The doc/skill text described two failure paths. Live rows show neither fires today:

| Candidate (from SKILL.md) | Live data | Verdict |
|---|---|---|
| Trending `Stars/wk` may hold an all-time TOTAL on a fallback week | 21 rows, range 370–16102, 0 null, 0 descriptions mention total/累計 | not observed → downgraded to a doc note |
| Blog `Published` may be empty (best-effort archive) | 23 rows, 0 empty Published, 0 empty Archived, 0 bad Type | not observed → defensive sort added as cheap insurance |

`Recommendation` seeding: all 27 Loot rows carry a 1–5 score (Claude `{3:3,4:6,5:10}`,
Copilot `{4:4,5:4}`). `loot-radar/SKILL.md` step 7 + step 10 already write it on CREATE
and leave it untouched on UPDATE so a dashboard re-tune survives. No skill change needed.

## Changes applied

UI (`github-radar-ui`):
- `lib/data.ts` — export `LOOT_PROPS`; add a secondary `Archived desc` sort to
  `fetchBlog` so an empty `Published` can't sink a fresh post.
- `app/loot/actions.ts` — write-back now references `LOOT_PROPS.status` /
  `LOOT_PROPS.recommendation` instead of hard-coded `"Status"` / `"Recommendation"`
  literals, closing the asymmetry where a rename throws on read but failed silently
  on write.
- `app/blog/[id]/page.tsx` — render `Brief` as a lead line above the summary; it was
  written on every row but invisible on the detail page.
- `components/TrendingList.tsx` — comment noting the 🆕/🔁 badge is a UI-local
  re-derivation of the skill's step-8 rule (the two can drift).

Docs (`ai-assistant`):
- `AGENTS.md` — Loot Ledger schema now lists `Recommendation`.

## Deliberately NOT changed

- SKILL.md `(TEXT)` annotations → `(rich_text)`: rejected. `(TEXT)` matches the
  `<sqlite-table>` type the Notion MCP returns and that the skill writes through;
  `rich_text` is the REST property type the skill never touches directly. Changing it
  trades one correct view for a more confusing one.
- Music UI wiring: out of scope for this package.

## Known limits

- Row-population checks used a one-off REST pull; `notion-query-data-sources` (SQL) is
  gated behind a Business+AI plan, so this can't be re-run via the MCP. Re-pull with the
  app token if you want fresh numbers.
- The two debunked P0s are conditional on skill behavior that simply hasn't fired in the
  observed weeks — worth a re-check if a future run's trending source only exposes totals.
