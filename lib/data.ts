import "server-only";
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
};

export type Result<T> = { ok: true; rows: T[] } | { ok: false; error: string };

type Sort = { property: string; direction: "ascending" | "descending" };

async function load<T>(
  uuid: string,
  sorts: Sort[],
  map: (page: NotionPage) => T,
): Promise<Result<T>> {
  try {
    const dataSourceId = await resolveDataSourceId(uuid);
    const pages = await queryAll(dataSourceId, { sorts });
    return { ok: true, rows: pages.map(map) };
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
  );
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
    };
  });
}
