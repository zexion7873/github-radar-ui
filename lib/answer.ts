// radar-rag's POST /ask response, a cross-repo contract its AGENTS.md also
// records. Its Java records send an absent field as null, never omitted.
export type AskRow = {
  id: string;
  source: string;
  repo?: string | null;
  title?: string | null;
  url?: string | null;
  week?: string | null;
  score?: number | null;
  citedText?: string[] | null;
};

export type AskResponse = {
  answer: string;
  citations: AskRow[];
  sources: AskRow[];
  usage: {
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
  };
};

const optional = (v: unknown, type: "string" | "number") =>
  v == null || typeof v === type;

// The response crosses a service boundary, so its shape is checked before render:
// a radar-rag change that breaks it shows an error instead of a blank page.
function isRow(row: unknown): row is AskRow {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.source === "string" &&
    ["repo", "title", "url", "week"].every((k) => optional(r[k], "string")) &&
    optional(r.score, "number") &&
    (r.citedText == null ||
      (Array.isArray(r.citedText) &&
        r.citedText.every((t) => typeof t === "string")))
  );
}

function isRows(x: unknown): x is AskRow[] {
  return Array.isArray(x) && x.every(isRow);
}

export function isAskResponse(v: unknown): v is AskResponse {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  const u = r.usage as Record<string, unknown> | null | undefined;
  return (
    typeof r.answer === "string" &&
    isRows(r.citations) &&
    isRows(r.sources) &&
    typeof u === "object" &&
    u !== null &&
    typeof u.model === "string" &&
    optional(u.inputTokens, "number") &&
    optional(u.outputTokens, "number")
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

// Holds back a marker whose closing half has not streamed in yet, so the reader
// never sees a stray ** or ` that turns into formatting a moment later.
function holdOpenMarkers(line: string): string {
  if ((line.split("**").length - 1) % 2) line = line.slice(0, line.lastIndexOf("**"));
  if ((line.split("`").length - 1) % 2) line = line.slice(0, line.lastIndexOf("`"));
  return line.replace(/(?<!\*)\*$/, "");
}

// The line still streaming must not change shape under the reader: a bare bullet
// waits for its text, and a lone bold run stays a paragraph until its newline.
export function previewAnswer(text: string): Block[] {
  const cut = text.lastIndexOf("\n") + 1;
  let tail = holdOpenMarkers(text.slice(cut)).trim();
  if (/^(?:[-*]|\d+\.?|#{1,6})$/.test(tail)) tail = "";
  const blocks = parseAnswer(text.slice(0, cut) + tail);
  const last = blocks.at(-1);
  if (tail && last?.kind === "h3" && !tail.startsWith("#")) {
    blocks[blocks.length - 1] = { kind: "p", inline: parseInline(tail) };
  }
  return blocks;
}

export type SseEvent = { event: string; data: string };

// Splits the complete server-sent-event frames off the front of buf; the
// unfinished frame comes back as rest, to be prefixed to the next chunk.
export function takeSseEvents(buf: string): { events: SseEvent[]; rest: string } {
  const frames = buf.replace(/\r\n/g, "\n").split("\n\n");
  const rest = frames.pop() ?? "";
  const events: SseEvent[] = [];
  for (const frame of frames) {
    let event = "message";
    const data: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith(":")) continue;
      const i = line.indexOf(":");
      const field = i === -1 ? line : line.slice(0, i);
      const value = i === -1 ? "" : line.slice(i + 1).replace(/^ /, "");
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
    if (data.length) events.push({ event, data: data.join("\n") });
  }
  return { events, rest };
}

export type StreamResult =
  | { ok: true; data: AskResponse }
  | { ok: false; status: number | null };

function parseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function field(v: unknown, key: string): unknown {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>)[key] : undefined;
}

// `done` is the only success. An `error` event returns its status; a malformed
// event or an early end returns null. Either way the caller retracts the draft.
export async function readAskStream(
  body: ReadableStream<BufferSource>,
  on: { sources: (rows: AskRow[]) => void; delta: (text: string) => void },
): Promise<StreamResult> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let sources: AskRow[] | undefined;
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return { ok: false, status: null };
    const { events, rest } = takeSseEvents(buf + value);
    buf = rest;
    for (const e of events) {
      const data = parseJson(e.data);
      if (e.event === "sources") {
        if (!isRows(data)) return { ok: false, status: null };
        sources = data;
        on.sources(data);
      } else if (e.event === "delta") {
        const text = field(data, "text");
        if (typeof text !== "string") return { ok: false, status: null };
        on.delta(text);
      } else if (e.event === "done") {
        const full = { ...(data as object), sources };
        return isAskResponse(full) ? { ok: true, data: full } : { ok: false, status: null };
      } else if (e.event === "error") {
        const status = field(data, "status");
        return { ok: false, status: typeof status === "number" ? status : 502 };
      }
    }
  }
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

// A citation's passages need not be adjacent in the row; the ellipsis keeps the
// joined quote from reading as one continuous excerpt.
export function joinPassages(passages: string[], label: string): string {
  return passages
    .map((q) => stripLeadingLabel(q, label).trim())
    .filter(Boolean)
    .join(" … ");
}

// Bold names in the answer that match a cited or retrieved row's label link to
// that row, keyed case-insensitively. A name the model rephrased stays plain bold.
export function nameLinks(
  data: Pick<AskResponse, "citations" | "sources">,
): Map<string, { href: string; internal: boolean }> {
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
