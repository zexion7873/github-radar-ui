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
// schema assertion all reference the SAME string. A column rename then fails
// loudly and consistently (see assertProps) instead of: sort renames → hard 400,
// read renames → silent blank cell.
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
      };
    },
    "notion:trending",
  );
}

// Trending Archive is one row per repo per week. Collapse to each repo's most
// recent week so callers see distinct repos, not weekly snapshots.
export function latestPerRepo(rows: TrendingRow[]): TrendingRow[] {
  const byRepo = new Map<string, TrendingRow>();
  for (const r of rows) {
    const prev = byRepo.get(r.repo);
    if (!prev || (r.week ?? "") > (prev.week ?? "")) byRepo.set(r.repo, r);
  }
  return [...byRepo.values()];
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
      };
    },
    "notion:loot",
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
      return {
        id: pg.id,
        title: text(p, P.title),
        url: urlProp(p, P.url),
        source: text(p, P.source),
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
