// radar-rag's POST /ask response, rendered by the /ask page. The shape is a
// cross-repo contract: radar-rag's AGENTS.md records it on the other side.
export type AskRow = {
  id: string;
  source: string;
  repo?: string;
  title?: string;
  url?: string;
  week?: string;
  score?: number;
  citedText?: string[];
};

export type AskResponse = {
  answer: string;
  citations: AskRow[];
  sources: AskRow[];
  usage: { model: string; inputTokens: number; outputTokens: number };
};

// The response crosses a service boundary, so its shape is checked before render:
// a radar-rag change that breaks it shows an error instead of a blank page.
export function isAskResponse(v: unknown): v is AskResponse {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  const rows = (x: unknown) =>
    Array.isArray(x) &&
    x.every(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        typeof (row as AskRow).id === "string" &&
        typeof (row as AskRow).source === "string",
    );
  const u = r.usage as Record<string, unknown> | null | undefined;
  return (
    typeof r.answer === "string" &&
    rows(r.citations) &&
    rows(r.sources) &&
    typeof u === "object" &&
    u !== null &&
    typeof u.model === "string"
  );
}

export type Inline = { kind: "text" | "strong" | "code"; text: string };
export type Block =
  | { kind: "p" | "h3"; inline: Inline[] }
  | { kind: "ul"; items: Inline[][] };

// Model output is parsed into plain data and rendered as React text, never as
// HTML: only **bold** and `code` runs become elements.
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  for (const part of text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)) {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      out.push({ kind: "strong", text: part.slice(2, -2) });
    } else if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      out.push({ kind: "code", text: part.slice(1, -1) });
    } else if (part) {
      out.push({ kind: "text", text: part });
    }
  }
  return out;
}

export function parseAnswer(text: string): Block[] {
  const blocks: Block[] = [];
  let list: Inline[][] | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^(?:[-*]|\d+\.)\s+(.*)$/);
    if (bullet) {
      if (!list) {
        list = [];
        blocks.push({ kind: "ul", items: list });
      }
      list.push(parseInline(bullet[1]));
      continue;
    }
    list = null;
    if (!line) continue;
    // The model writes subheads either as markdown headings or as a line that is
    // nothing but one bold run (optionally ending in a colon); both are subheads.
    const heading = line.match(/^#{1,6}\s+(.*)$/) ?? line.match(/^\*\*([^*]+)\*\*\s*[:：]?$/);
    blocks.push({
      kind: heading ? "h3" : "p",
      inline: parseInline(heading ? heading[1] : line),
    });
  }
  return blocks;
}

const PAGE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// A cited row links to this site's own detail page when its id is a Notion page
// id; anything else falls back to the row's original URL, or to no link at all.
export function rowHref(
  row: AskRow,
): { href: string; internal: boolean } | null {
  if (PAGE_ID.test(row.id ?? "")) {
    return {
      href: `/${row.source === "blog" ? "blog" : "trending"}/${row.id}`,
      internal: true,
    };
  }
  if (isHttp(row.url)) return { href: row.url, internal: false };
  return null;
}

export function isHttp(url: unknown): url is string {
  return typeof url === "string" && /^https?:\/\//.test(url);
}

export function rowLabel(row: AskRow): string {
  return row.repo || row.title || row.url || row.id;
}

// radar-rag repeats every citation in `sources`; the fold lists only the rows the
// answer did not cite, so nothing shows twice.
export function uncitedSources(data: AskResponse): AskRow[] {
  const cited = new Set(data.citations.map((r) => r.id));
  return data.sources.filter((r) => !cited.has(r.id));
}

// A cited passage often opens with the row's own name, which the title above it
// already shows.
export function stripLeadingLabel(quote: string, label: string): string {
  const q = quote.trimStart();
  return label && q.startsWith(label) ? q.slice(label.length).trimStart() : quote;
}

// radar-rag cites sentence by sentence, so one citation can carry several short
// passages that need not be adjacent in the row. They render as one quote, joined
// by an ellipsis so it never reads as a continuous excerpt.
export function joinPassages(passages: string[], label: string): string {
  return passages
    .map((q) => stripLeadingLabel(q, label).trim())
    .filter(Boolean)
    .join(" … ");
}

// Bold names in the answer that match a cited or retrieved row's label link to
// that row, keyed case-insensitively. A name the model rephrased stays plain bold.
export function nameLinks(data: AskResponse): Map<string, { href: string; internal: boolean }> {
  const links = new Map<string, { href: string; internal: boolean }>();
  for (const row of [...data.citations, ...data.sources]) {
    const target = rowHref(row);
    const key = rowLabel(row).trim().toLowerCase();
    if (target && key && !links.has(key)) links.set(key, target);
  }
  return links;
}

// radar-rag's status codes, in the same words its own page used.
export function askErrorMessage(status: number): string {
  switch (status) {
    case 429:
      return "問得太快了，請稍候再試（每人每分鐘 5 題、每天 20 題）。 · Too many questions; wait a moment.";
    case 403:
      return "機器人驗證沒有通過，請再試一次。 · The bot check failed; try again.";
    case 502:
    case 503:
      return "模型暫時無法回答，請稍後再試。 · The model is unavailable right now.";
    default:
      return `出了點問題（${status}），請再試一次。 · Something went wrong (${status}).`;
  }
}
