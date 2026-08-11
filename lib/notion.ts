import "server-only";
import { NOTION_VERSION } from "./config";

const BASE = "https://api.notion.com/v1";

// `status` carries the HTTP code so a caller can tell "this id isn't a data
// source" (404) apart from "the token is dead" (401) — see resolveDataSourceId.
// Absent on errors we raise ourselves rather than receive from Notion.
export class NotionError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

type RichText = { plain_text: string };
export type NProp = {
  title?: RichText[];
  rich_text?: RichText[];
  number?: number | null;
  select?: { name: string } | null;
  multi_select?: { name: string }[];
  date?: { start: string | null } | null;
  url?: string | null;
};
export type NotionPage = { id: string; properties: Record<string, NProp> };

function token(): string {
  const t = process.env.NOTION_TOKEN;
  if (!t) throw new NotionError("NOTION_TOKEN is not set");
  return t;
}

async function notionFetch<T>(
  path: string,
  init?: RequestInit,
  attempt = 0,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (res.status === 429 && attempt < 3) {
    const retry = Number(res.headers.get("Retry-After") ?? 1);
    await new Promise((r) => setTimeout(r, retry * 1000));
    return notionFetch<T>(path, init, attempt + 1);
  }

  const json: unknown = await res.json();
  if (!res.ok) {
    const message = (json as { message?: string }).message;
    throw new NotionError(
      message ?? `Notion API error ${res.status}`,
      res.status,
    );
  }
  return json as T;
}

// A `collection://<uuid>` handle may already be a data_source_id, or a database id
// that holds one. Try it as a data source; only a definite 404 means "wrong kind of
// id" and earns the fallback. A bare catch here made an expired token or a rate
// limit surface as whatever the SECOND call returned, so the error named the
// database endpoint while the real cause was the credentials.
// Not memoised: the caller (lib/data.ts) already wraps the whole read in a 600s
// unstable_cache, so the extra GET only runs on a cache miss — a module-level map
// here would just add a never-invalidating staleness layer underneath it.
export async function resolveDataSourceId(uuid: string): Promise<string> {
  try {
    await notionFetch<unknown>(`/data_sources/${uuid}`, { method: "GET" });
    return uuid;
  } catch (error) {
    if (!(error instanceof NotionError) || error.status !== 404) throw error;
    const db = await notionFetch<{ data_sources?: { id: string }[] }>(
      `/databases/${uuid}`,
      { method: "GET" },
    );
    const id = db.data_sources?.[0]?.id;
    if (!id) throw new NotionError(`No data source found for ${uuid}`);
    return id;
  }
}

type QueryResponse = {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
};

// Writes a select property on a page. `value` MUST match an existing option name
// exactly — a typo spawns a duplicate option in Notion. Uncached (notionFetch is
// always `no-store`), so the write hits Notion directly.
export async function updateSelect(
  pageId: string,
  prop: string,
  value: string,
): Promise<void> {
  await notionFetch(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: { [prop]: { select: { name: value } } } }),
  });
}

export async function queryAll(
  dataSourceId: string,
  body: Record<string, unknown>,
): Promise<NotionPage[]> {
  const rows: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const page = await notionFetch<QueryResponse>(
      `/data_sources/${dataSourceId}/query`,
      {
        method: "POST",
        body: JSON.stringify({ ...body, page_size: 100, start_cursor: cursor }),
      },
    );
    rows.push(...page.results);
    cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return rows;
}

// The routines write Traditional-Chinese prose but the model flip-flops between
// half- and full-width punctuation: it emits half-width , ; : ! ? when the mark
// hugs an ASCII token (model names, version strings, ratios) and full-width in
// pure-Chinese spans, so one summary reads inconsistently. Normalize at read
// time: a half-width , ; : ! ? becomes its full-width form ONLY when a Han
// character sits immediately on either side. Code, URLs, decimals and
// thousands-separators are digit/Latin-flanked, so they're untouched; parens and
// periods are skipped entirely — （中文） vs (english) is context-dependent.
const HAN = /[㐀-䶿一-鿿]/;
const HALF_TO_FULL: Record<string, string> = {
  ",": "，",
  ";": "；",
  ":": "：",
  "!": "！",
  "?": "？",
};
function normalizeCJKPunct(s: string): string {
  return s.replace(/[,;:!?]/g, (m, i) =>
    HAN.test(s[i - 1] ?? "") || HAN.test(s[i + 1] ?? "") ? HALF_TO_FULL[m] : m,
  );
}

// Property extractors — each guards the empty-cell shape its type returns.
const runs = (rt?: RichText[]) => (rt ?? []).map((t) => t.plain_text).join("");
export const text = (p: Record<string, NProp>, k: string): string =>
  normalizeCJKPunct(runs(p[k]?.title ?? p[k]?.rich_text));
export const num = (p: Record<string, NProp>, k: string): number | null =>
  p[k]?.number ?? null;
export const sel = (p: Record<string, NProp>, k: string): string | null =>
  p[k]?.select?.name ?? null;
export const dateStart = (p: Record<string, NProp>, k: string): string | null =>
  p[k]?.date?.start ?? null;
export const urlProp = (p: Record<string, NProp>, k: string): string | null =>
  p[k]?.url ?? null;
