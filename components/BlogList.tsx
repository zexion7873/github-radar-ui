"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { BlogRow } from "@/lib/data";
import {
  Badge,
  Chip,
  ChipScroller,
  formatWeek,
  FRESH_TONE,
} from "./ui";

// Blog Archive's Type is a closed enum (official / individual); render each as
// its own section, newest first (rows already arrive Published-desc). Anything
// outside the enum (or a blank Type) falls into the catch-all section below so it
// never silently vanishes from the page.
const GROUPS: { type: string; label: string }[] = [
  { type: "official", label: "🏛 官方" },
  { type: "individual", label: "👤 個人" },
];
const KNOWN_TYPES = new Set(GROUPS.map((g) => g.type));

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// The archive grows daily and every row ships to the client for search, so
// rendering all of it put ~300 cards in the DOM to read the newest few. Reveal a
// batch per section instead; `shown` stays the full match set, so search and the
// counter still see every row.
const BATCH = 25;

const inputClass =
  "w-full rounded-none border border-border bg-surface px-3 py-1.5 text-sm placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none sm:w-64";

// Chips beyond the top few hide behind a 更多 toggle — the full source list grew
// into a four-row wall on desktop and an endless scroll strip on mobile.
const TOP_SOURCES = 8;

export default function BlogList({ rows }: { rows: BlogRow[] }) {
  // Most-published first, so the sources worth one tap are the ones shown.
  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows)
      if (r.source) counts.set(r.source, (counts.get(r.source) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([s]) => s);
  }, [rows]);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [allSources, setAllSources] = useState(false);
  // Reset the reveal on every filter change — carrying a grown limit into a new
  // result set would dump hundreds of cards back into the DOM on a stray keystroke.
  const [limit, setLimit] = useState(BATCH);
  const search = (q: string) => {
    setQuery(q);
    setLimit(BATCH);
  };
  const pickSource = (s: string | null) => {
    setSource(s);
    setLimit(BATCH);
  };

  // "New" is relative to the latest archived date in the data, not the wall
  // clock — keeps the badge derived from row data (not the current time) and
  // stays stable regardless of the active filter.
  const latestArchived = useMemo(
    () =>
      rows.reduce((max, r) => {
        const t = r.archived ? Date.parse(r.archived) : 0;
        return t > max ? t : max;
      }, 0),
    [rows],
  );

  const shown = useMemo(() => {
    let r = rows;
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (x) =>
          x.title.toLowerCase().includes(q) ||
          x.summary.toLowerCase().includes(q) ||
          x.brief.toLowerCase().includes(q) ||
          x.comment.toLowerCase().includes(q),
      );
    }
    if (source) r = r.filter((x) => x.source === source);
    return r;
  }, [rows, query, source]);

  // Two enum sections plus a catch-all for unmatched/blank Type, so the rendered
  // cards always account for every row in `shown` (the count below never lies).
  const sections = [
    ...GROUPS.map((g) => ({ label: g.label, items: shown.filter((r) => r.type === g.type) })),
    {
      label: "🗂 其他",
      items: shown.filter((r) => !KNOWN_TYPES.has(r.type ?? "")),
    },
  ].filter((s) => s.items.length > 0);
  const remaining = sections.reduce(
    (n, s) => n + Math.max(0, s.items.length - limit),
    0,
  );

  function card(r: BlogRow) {
    const isNew =
      !!r.archived && latestArchived - Date.parse(r.archived) < WEEK_MS;
    // List shows the short brief, not the full-paragraph summary (matches the
    // dashboard). Summary stays a fallback only when a post has no brief.
    const body = r.brief || r.summary;
    return (
      <article
        key={r.id}
        className="group relative grid gap-x-8 gap-y-2 py-5 sm:grid-cols-[1fr_15rem]"
      >
        {/* Whole-row link to the post detail (full summary + comment); the title
            link below sits above it (z-10) so a tap on it still opens the source. */}
        <Link
          href={`/blog/${r.id}`}
          aria-label={`${r.title} 詳情`}
          className="absolute inset-0"
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <a
              href={r.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 font-serif text-lg leading-snug break-words text-foreground transition-colors hover:text-accent"
            >
              {r.title}
            </a>
            {isNew && <Badge tone={FRESH_TONE}>✨ 新</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] tracking-wide text-muted uppercase">
            <Badge tone="muted">{r.source}</Badge>
            {r.author && <span>{r.author}</span>}
            {r.published && <span>{formatWeek(r.published)}</span>}
          </div>
          {body && (
            <p className="line-clamp-3 font-serif-text text-[0.9375rem] leading-relaxed text-foreground">
              {body}
            </p>
          )}
        </div>
        {/* The curator's 點評 as a margin annotation pinned beside the entry — the
            page's signature motif. A hairline gutter on sm+; stacks below with an
            accent tick on mobile (single column). Sits under the row link overlay. */}
        {r.comment && (
          <p className="line-clamp-4 border-l-2 border-accent/40 pl-4 font-serif-text text-sm leading-relaxed text-muted italic sm:border-l sm:border-border">
            {r.comment}
          </p>
        )}
      </article>
    );
  }

  return (
    <div>
      <div className="sticky top-[var(--header-h)] z-20 -mx-4 mb-4 flex flex-col gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => search(e.target.value)}
            aria-label="搜尋標題或摘要"
            placeholder="搜尋標題或摘要…"
            className={inputClass}
          />
        </div>
        {sources.length > 0 &&
          (() => {
            // The active source stays visible even from the hidden tail, so a
            // picked filter can never disappear behind the toggle.
            const top = sources.slice(0, TOP_SOURCES);
            const visible = allSources
              ? sources
              : source && !top.includes(source)
                ? [...top, source]
                : top;
            const chips = (
              <>
                <Chip on={source === null} onClick={() => pickSource(null)}>
                  全部
                </Chip>
                {visible.map((s) => (
                  <Chip key={s} on={source === s} onClick={() => pickSource(s)}>
                    {s}
                  </Chip>
                ))}
                {sources.length > TOP_SOURCES && (
                  <Chip
                    on={allSources}
                    onClick={() => setAllSources((v) => !v)}
                  >
                    {allSources
                      ? "收合"
                      : `+${sources.length - visible.length} 更多`}
                  </Chip>
                )}
              </>
            );
            // Collapsed: one scrollable line (ChipScroller). Expanded: wrap on
            // every breakpoint — a single-line scroll would defeat the point.
            return allSources ? (
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="來源篩選"
              >
                {chips}
              </div>
            ) : (
              <ChipScroller label="來源篩選">{chips}</ChipScroller>
            );
          })()}
        <p className="text-xs text-muted">
          顯示 {shown.length} / {rows.length}
        </p>
      </div>

      {sections.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          {rows.length === 0 ? "還沒有文章" : "沒有符合的文章"}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-10">
            {sections.map(({ label, items }) => (
              <section key={label}>
                <h2 className="mb-1 flex items-baseline gap-2 border-b-2 border-foreground pb-1 font-serif text-2xl tracking-tight text-foreground">
                  {label}
                  <span className="font-mono text-xs font-normal tracking-wide text-muted">
                    {items.length}
                  </span>
                </h2>
                {/* Each section head keeps its FULL match count above, so a
                    truncated section still announces how much sits behind it. */}
                <div className="divide-y divide-border">
                  {items.slice(0, limit).map(card)}
                </div>
              </section>
            ))}
          </div>
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + BATCH)}
              className="mt-10 w-full rounded-none border border-border py-3 font-mono text-[11px] tracking-[0.08em] text-muted uppercase transition-colors hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none active:scale-[0.99]"
            >
              顯示更多（還有 {remaining} 篇）
            </button>
          )}
        </>
      )}
    </div>
  );
}
