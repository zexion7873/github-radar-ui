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
    const heading = line.match(/^#{1,6}\s+(.*)$/);
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
