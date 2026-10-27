import "server-only";
import { NOTION_VERSION } from "./config";

const BASE = "https://api.notion.com/v1";
// Without these, a stalled or throttling Notion holds every page render open
// until the platform kills the function.
const TIMEOUT_MS = 10_000;
const MAX_RETRY_AFTER_S = 5;

// `status` tells a wrong kind of id (404) from a dead token (401); absent on
// errors raised here rather than by Notion.
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
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token()}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError")
      throw new NotionError(`Notion did not answer within ${TIMEOUT_MS / 1000} s`);
    throw error;
  }

  if (res.status === 429 && attempt < 3) {
    const hinted = Number(res.headers.get("Retry-After") ?? 1);
    const retry = Math.min(Number.isFinite(hinted) ? hinted : 1, MAX_RETRY_AFTER_S);
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

// The uuid is a data source id or a database holding one. Only a 404 earns the
// database fallback; catching more reports a dead token as a database error.
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

// `value` must match an existing option exactly: a typo creates a new option.
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

// The routines' model mixes half- and full-width punctuation. , ; : ! ? turn
// full-width only beside a Han character; parens and periods stay, as context decides.
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
