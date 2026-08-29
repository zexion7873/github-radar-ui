import "server-only";
import { unstable_cache } from "next/cache";
import {
  resolveDataSourceId,
  queryAll,
  text,
  num,
  sel,
  dateStart,
  urlProp,
  NotionError,
  type NotionPage,
} from "./notion";
import { canonicalBlogSource } from "./blog-source";

export type TrendingRow = {
  id: string;
  repo: string;
  week: string | null;
  starsPerWeek: number | null;
  language: string;
  category: string | null;
  link: string | null;
  description: string;
  comment: string;
  weeksOnChart: number | null;
  maintained: string | null;
  risk: string | null;
  license: string | null;
};

export type LootRow = {
  id: string;
  repo: string;
  intro: string;
  asset: string;
  type: string | null;
  week: string | null;
  link: string | null;
  why: string;
  how: string;
  status: string | null;
  recommendation: number | null;
  verdict: string;
  maintained: string | null;
  license: string | null;
};

export type BlogRow = {
  id: string;
  title: string;
  url: string | null;
  source: string;
  type: string | null; // "official" | "individual"
  author: string;
  published: string | null;
  archived: string | null;
  brief: string;
  summary: string;
  comment: string;
};

export type Result<T> = { ok: true; rows: T[] } | { ok: false; error: string };

type Sort = { property: string; direction: "ascending" | "descending" };

// Notion DISPLAY names, declared once per table so the sort, the read, and the
// schema assertion all reference the SAME string. A column rename then fails loudly
// either way instead of silently blanking a cell — but via two paths: a sort-key
// rename trips a hard Notion 400 at query time (before assertProps runs), while a
// non-sort-key rename trips assertProps' clearer "renamed or removed" message. Both
// surface through load()'s catch.
const TRENDING_PROPS = {
  repo: "Repo",
  week: "Week",
  starsPerWeek: "Stars/wk",
  language: "Language",
  category: "Category",
  link: "Link",
  description: "Description",
  comment: "Comment",
  weeksOnChart: "Weeks on chart",
  maintained: "Maintained",
  risk: "Risk",
  license: "License",
} as const;

export const LOOT_PROPS = {
  repo: "Repo",
  intro: "Intro",
  asset: "Asset",
  type: "Type",
  week: "Week",
  link: "Link",
  why: "Why",
  how: "How",
  status: "Status",
  recommendation: "Recommendation",
  // The one column here the loot-radar routine does not write: the triage pass
  // writes it alongside Status, as `<bucket> — <reason>` (adopt / trial / skip /
  // already-have). Status collapses adopt and already-have into `adopted`, so
  // this is the only record of which one a row actually was.
  verdict: "Verdict",
  maintained: "Maintained",
  license: "License",
} as const;

const BLOG_PROPS = {
  title: "Title",
  url: "URL",
  source: "Source",
  type: "Type",
  author: "Author",
  published: "Published",
  archived: "Archived",
  brief: "Brief",
  summary: "Summary",
  comment: "Comment",
} as const;

// The routines write these tables weekly/daily, so caching reads for a few
// minutes costs nothing in freshness and turns every navigation from a
// 0.3-0.9s Notion round-trip into an instant cache hit. Only successful reads
// are cached — a thrown Notion error propagates out and is never stored.
const REVALIDATE_SECONDS = 600;

// Turn a silent schema drift into a loud, actionable error. Notion returns every
// schema property on every page (empty cells included), so a key absent from the
// first row means the column was renamed/removed — without this the extractors
// would just hand back "" / null and the UI would render plausible blank cards.
function assertProps(page: NotionPage, expected: readonly string[]): void {
  const missing = expected.filter((k) => !(k in page.properties));
  if (missing.length > 0) {
    throw new NotionError(
      `Notion table is missing expected ${
        missing.length > 1 ? "properties" : "property"
      }: ${missing.join(", ")}. A column was likely renamed or removed.`,
    );
  }
}

async function load<T>(
  uuid: string,
  sorts: Sort[],
  expected: readonly string[],
  map: (page: NotionPage) => T,
  tag: string,
): Promise<Result<T>> {
  const read = unstable_cache(
    async () => {
      const dataSourceId = await resolveDataSourceId(uuid);
      const pages = await queryAll(dataSourceId, { sorts });
      if (pages.length > 0) assertProps(pages[0], expected);
      return pages.map(map);
    },
    ["notion-table", uuid],
    { revalidate: REVALIDATE_SECONDS, tags: ["notion", tag] },
  );
  try {
    return { ok: true, rows: await read() };
  } catch (e) {
    console.error("Notion read failed:", e);
    const error =
      e instanceof NotionError ? e.message : "Unexpected error reading Notion";
    return { ok: false, error };
  }
}

// Returns the RAW weekly archive — one row per repo per week, NOT deduped — so
// the detail page ([id]) can draw each repo's full per-week history. Callers that
// want distinct repos (Dashboard, trending list) call latestPerRepo() themselves.
// Do NOT move dedup in here: it would collapse every repo to its latest week and
// silently blank the detail chart, with nothing pointing back to this change.
export function fetchTrending(uuid: string): Promise<Result<TrendingRow>> {
  const P = TRENDING_PROPS;
  return load(
    uuid,
    [
      { property: P.week, direction: "descending" },
      { property: P.starsPerWeek, direction: "descending" },
    ],
    Object.values(P),
    (pg) => {
      const p = pg.properties;
      return {
        id: pg.id,
        repo: text(p, P.repo),
        week: dateStart(p, P.week),
        starsPerWeek: num(p, P.starsPerWeek),
        language: text(p, P.language),
        category: sel(p, P.category),
        link: urlProp(p, P.link),
        description: text(p, P.description),
        comment: text(p, P.comment),
        weeksOnChart: num(p, P.weeksOnChart),
        maintained: sel(p, P.maintained),
        risk: sel(p, P.risk),
        license: sel(p, P.license),
      };
    },
    "notion:trending",
  );
}

// Weekly archives (trending AND loot) are one row per repo per week. Collapse
// to each repo's most recent week so callers see distinct repos, not weekly
// snapshots. Generic over the row shape — the trending list/dashboard and the
// loot board share the identical keep-latest-week rule; the detail pages
// re-read the full archive for their history sections (每週趨勢 / 歷次點評).
export function latestPerRepo<T extends { repo: string; week: string | null }>(
  rows: T[],
): T[] {
  const byRepo = new Map<string, T>();
  for (const r of rows) {
    const prev = byRepo.get(r.repo);
    if (!prev || (r.week ?? "") > (prev.week ?? "")) byRepo.set(r.repo, r);
  }
  return [...byRepo.values()];
}

// This week's live chart: the (already deduped) repos whose latest week IS the
// newest week anywhere in the data. Distinct from the full dedup result, which
// keeps every repo ever archived — a repo that fell off the chart weeks ago
// still has a row there, and ranking THAT set by stars/wk lets a stale one-week
// wonder headline a "本週" section forever. If every week is null, latestWeek is
// "" and the chart is empty (nothing can honestly be called "this week").
export function currentChart(repos: TrendingRow[]): {
  latestWeek: string;
  onChart: TrendingRow[];
} {
  const latestWeek = repos.reduce(
    (max, r) => (r.week && r.week > max ? r.week : max),
    "",
  );
  return { latestWeek, onChart: repos.filter((r) => r.week === latestWeek) };
}

export type WeekPoint = { week: string | null; stars: number | null };

// Each repo's full weekly stars/wk history, ascending by week — the series behind
// the trending list's inline sparkline and ▲▼ delta. Built from the RAW archive
// (every weekly row), NOT latestPerRepo, which keeps only one week per repo. A
// plain object (not a Map) so it serialises across the server→client boundary;
// keyed by repo so the already-deduped list rows look up their own history by name.
export function weeklySeriesByRepo(
  rows: TrendingRow[],
): Record<string, WeekPoint[]> {
  const byRepo: Record<string, WeekPoint[]> = {};
  for (const r of rows) {
    (byRepo[r.repo] ??= []).push({ week: r.week, stars: r.starsPerWeek });
  }
  for (const repo in byRepo) {
    byRepo[repo].sort((a, b) => (a.week ?? "").localeCompare(b.week ?? ""));
  }
  return byRepo;
}

// Relative momentum: the latest week's stars/wk against the mean of its prior
// weeks. >1 = accelerating past its own baseline, <1 = cooling. RELATIVE (not the
// absolute week-over-week ▲ delta the list already shows) so a small repo spiking
// outranks a big steady one — the ROSS-Index spirit of surfacing newcomers over
// established champions. Null when there's no prior week to compare (needs >=2
// weeks) or the baseline is zero.
export function repoMomentum(points: WeekPoint[]): number | null {
  const v = points.map((p) => p.stars).filter((s): s is number => s != null);
  if (v.length < 2) return null;
  const latest = v[v.length - 1];
  const prior = v.slice(0, -1);
  const base = prior.reduce((sum, n) => sum + n, 0) / prior.length;
  return base > 0 ? latest / base : null;
}

// Per-repo momentum map, built from the same series the sparklines use so the
// trending list's 竄升中 sort and badge share one computation. Lives in this
// server-only module; computed in the page and passed to the client list as a prop.
export function momentumByRepo(
  series: Record<string, WeekPoint[]>,
): Record<string, number | null> {
  const m: Record<string, number | null> = {};
  for (const repo in series) m[repo] = repoMomentum(series[repo]);
  return m;
}

// One cache tag per ledger, not one for all of them. A status write busts the tag
// of the table it wrote to; a shared tag made every flip expire every target's
// read, so the next write's allow-list check re-fetched all of them from Notion —
// a cost that grew with each target added.
export function lootCacheTag(uuid: string): string {
  return `notion:loot:${uuid}`;
}

export function fetchLoot(uuid: string): Promise<Result<LootRow>> {
  const P = LOOT_PROPS;
  return load(
    uuid,
    [{ property: P.week, direction: "descending" }],
    Object.values(P),
    (pg) => {
      const p = pg.properties;
      return {
        id: pg.id,
        repo: text(p, P.repo),
        intro: text(p, P.intro),
        asset: text(p, P.asset),
        type: sel(p, P.type),
        week: dateStart(p, P.week),
        link: urlProp(p, P.link),
        why: text(p, P.why),
        how: text(p, P.how),
        status: sel(p, P.status),
        recommendation: num(p, P.recommendation),
        verdict: text(p, P.verdict),
        maintained: sel(p, P.maintained),
        license: sel(p, P.license),
      };
    },
    lootCacheTag(uuid),
  );
}

// Blog Archive is one row per post (no per-repo dedup needed). assertProps catches
// a renamed key on the first read, so the property names below are now enforced
// rather than trusted on faith.
export function fetchBlog(uuid: string): Promise<Result<BlogRow>> {
  const P = BLOG_PROPS;
  return load(
    uuid,
    // Published is the primary order; the blog routine archives best-effort and
    // Notion sinks empty-date rows to the bottom of a date sort, so fall back to
    // Archived (always set on write) — a post with no Published can't bury itself.
    [
      { property: P.published, direction: "descending" },
      { property: P.archived, direction: "descending" },
    ],
    Object.values(P),
    (pg) => {
      const p = pg.properties;
      const url = urlProp(p, P.url);
      return {
        id: pg.id,
        title: text(p, P.title),
        url,
        source: canonicalBlogSource(url, text(p, P.source)),
        type: sel(p, P.type),
        author: text(p, P.author),
        published: dateStart(p, P.published),
        archived: dateStart(p, P.archived),
        brief: text(p, P.brief),
        summary: text(p, P.summary),
        comment: text(p, P.comment),
      };
    },
    "notion:blog",
  );
}
