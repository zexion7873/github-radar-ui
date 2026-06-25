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
  summary: string;
  comment: string;
};

export type Result<T> = { ok: true; rows: T[] } | { ok: false; error: string };

type Sort = { property: string; direction: "ascending" | "descending" };

// The routines write these tables weekly/daily, so caching reads for a few
// minutes costs nothing in freshness and turns every navigation from a
// 0.3-0.9s Notion round-trip into an instant cache hit. Only successful reads
// are cached — a thrown Notion error propagates out and is never stored.
const REVALIDATE_SECONDS = 600;

async function load<T>(
  uuid: string,
  sorts: Sort[],
  map: (page: NotionPage) => T,
  tag: string,
): Promise<Result<T>> {
  const read = unstable_cache(
    async () => {
      const dataSourceId = await resolveDataSourceId(uuid);
      const pages = await queryAll(dataSourceId, { sorts });
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

export function fetchTrending(uuid: string): Promise<Result<TrendingRow>> {
  return load(
    uuid,
    [
      { property: "Week", direction: "descending" },
      { property: "Stars/wk", direction: "descending" },
    ],
    (pg) => {
      const p = pg.properties;
      return {
        id: pg.id,
        repo: text(p, "Repo"),
        week: dateStart(p, "Week"),
        starsPerWeek: num(p, "Stars/wk"),
        language: text(p, "Language"),
        category: sel(p, "Category"),
        link: urlProp(p, "Link"),
        description: text(p, "Description"),
        weeksOnChart: num(p, "Weeks on chart"),
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
  return load(uuid, [{ property: "Week", direction: "descending" }], (pg) => {
    const p = pg.properties;
    return {
      id: pg.id,
      repo: text(p, "Repo"),
      intro: text(p, "Intro"),
      asset: text(p, "Asset"),
      type: sel(p, "Type"),
      week: dateStart(p, "Week"),
      link: urlProp(p, "Link"),
      why: text(p, "Why"),
      how: text(p, "How"),
      status: sel(p, "Status"),
      recommendation: num(p, "Recommendation"),
    };
  }, "notion:loot");
}

// Blog Archive is one row per post (no per-repo dedup needed). Property keys are
// the Notion display names — confirm against a live query before trusting them.
export function fetchBlog(uuid: string): Promise<Result<BlogRow>> {
  return load(uuid, [{ property: "Published", direction: "descending" }], (pg) => {
    const p = pg.properties;
    return {
      id: pg.id,
      title: text(p, "Title"),
      url: urlProp(p, "URL"),
      source: text(p, "Source"),
      type: sel(p, "Type"),
      author: text(p, "Author"),
      published: dateStart(p, "Published"),
      archived: dateStart(p, "Archived"),
      summary: text(p, "Summary"),
      comment: text(p, "Comment"),
    };
  }, "notion:blog");
}
