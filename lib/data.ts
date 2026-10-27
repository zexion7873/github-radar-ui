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
  totalStars: number | null;
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

// Notion display names, shared by the sort, the read and assertProps, so a
// renamed column fails loudly instead of rendering blank cells.
const TRENDING_PROPS = {
  repo: "Repo",
  week: "Week",
  starsPerWeek: "Stars/wk",
  totalStars: "Total stars",
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
  // Written by the triage pass, not the routine. The only record of adopt vs
  // already-have: Status collapses both into `adopted`.
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

// A fresh Notion write stays invisible for this long; a thrown read is never cached.
const REVALIDATE_SECONDS = 600;

// Notion returns every property on every page, so a key missing from row 1 is a
// renamed column; without this check the UI renders plausible blank cards.
export function assertProps(page: NotionPage, expected: readonly string[]): void {
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

// The raw archive, one row per repo per week. Deduping here would blank every
// detail page's history chart; callers run latestPerRepo() themselves.
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
        totalStars: num(p, P.totalStars),
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

// Keeps each repo's newest week. A count over a weekly archive (trending or
// loot) that skips this counts a repo once per week.
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

// Repos whose latest week is the newest week in the data. Ranking every deduped
// repo instead lets one that fell off the chart headline 本週 forever.
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

// Built from the raw archive, not latestPerRepo (one week per repo). Grouped in a
// Map so a Repo named `constructor` cannot hit an inherited member and throw;
// returned as a plain object because it crosses the server→client boundary.
export function weeklySeriesByRepo(
  rows: TrendingRow[],
): Record<string, WeekPoint[]> {
  const byRepo = new Map<string, WeekPoint[]>();
  for (const r of rows) {
    const pts = byRepo.get(r.repo) ?? [];
    pts.push({ week: r.week, stars: r.starsPerWeek });
    byRepo.set(r.repo, pts);
  }
  for (const pts of byRepo.values()) {
    pts.sort((a, b) => (a.week ?? "").localeCompare(b.week ?? ""));
  }
  return Object.fromEntries(byRepo);
}

// Latest stars/wk over the mean of the prior weeks that have one; docs/signals.md
// defines the 竄升中 thresholds against this ratio.
export function repoMomentum(points: WeekPoint[]): number | null {
  const latest = points.at(-1)?.stars;
  if (latest == null) return null;
  const prior = points
    .slice(0, -1)
    .map((p) => p.stars)
    .filter((s): s is number => s != null);
  if (prior.length === 0) return null;
  const base = prior.reduce((sum, n) => sum + n, 0) / prior.length;
  return base > 0 ? latest / base : null;
}

// One computation for both the 竄升中 sort and the badge, so they cannot disagree.
export function momentumByRepo(
  series: Record<string, WeekPoint[]>,
): Record<string, number | null> {
  // fromEntries, not assignment: `m["__proto__"] = x` would hit the prototype setter.
  return Object.fromEntries(
    Object.entries(series).map(([repo, pts]) => [repo, repoMomentum(pts)]),
  );
}

// Per ledger, not shared: a shared tag makes each Status write expire every
// target's read.
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

// One row per post, so no latestPerRepo().
export function fetchBlog(uuid: string): Promise<Result<BlogRow>> {
  const P = BLOG_PROPS;
  return load(
    uuid,
    // Published can be empty, and Notion sinks empty dates to the bottom; Archived
    // is always set, so it keeps an undated post from burying itself.
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

// Only rows at least one radar-rag sync old (the previous chart week, posts
// archived 8+ days ago): newer ones may not be indexed and answer "no sources".
export function askExamples(
  trending: TrendingRow[],
  blog: BlogRow[],
  now: Date,
): string[] {
  const out: string[] = [];
  const weeks = [...new Set(trending.map((r) => r.week).filter((w) => w != null))]
    .sort()
    .reverse();
  // A repo's name is what radar-rag's retrieval matches; its Category is metadata
  // the search and the model never see, so "最近 X 類…" questions answer badly.
  const [top, second] = trending
    .filter((r) => r.week === weeks[1])
    .sort((a, b) => (b.starsPerWeek ?? 0) - (a.starsPerWeek ?? 0));
  if (top) out.push(`「${top.repo}」是做什麼的？為什麼會紅？`);
  if (second) out.push(`「${second.repo}」適合拿來做什麼？`);
  const cutoff = new Date(now.getTime() - 8 * 86_400_000).toISOString().slice(0, 10);
  const post = blog.find((b) => b.title && b.archived && b.archived <= cutoff);
  if (post) out.push(`「${post.title}」這篇在講什麼？`);
  return out;
}
