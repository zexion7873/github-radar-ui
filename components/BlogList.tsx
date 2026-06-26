"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { BlogRow } from "@/lib/data";
import { Badge, Chip, cardInteractive, formatWeek, FRESH_TONE } from "./ui";

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

const inputClass =
  "w-full rounded-none border border-border bg-surface px-3 py-1.5 text-sm placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none sm:w-64";

export default function BlogList({ rows }: { rows: BlogRow[] }) {
  const sources = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.source).filter((s): s is string => !!s))),
    [rows],
  );
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<string | null>(null);

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

  function card(r: BlogRow) {
    const isNew =
      !!r.archived && latestArchived - Date.parse(r.archived) < WEEK_MS;
    // List shows the short brief, not the full-paragraph summary (matches the
    // dashboard). Summary stays a fallback only when a post has no brief.
    const body = r.brief || r.summary;
    return (
      <article
        key={r.id}
        className={`relative flex flex-col gap-2 p-4 ${cardInteractive}`}
      >
        {/* Whole-card link to the post detail (full summary + comment); the title
            link below sits above it (z-10) so a tap on it still opens the source. */}
        <Link
          href={`/blog/${r.id}`}
          aria-label={`${r.title} 詳情`}
          className="absolute inset-0"
        />
        <div className="flex items-start justify-between gap-2">
          <a
            href={r.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 font-medium break-words text-foreground hover:text-accent"
          >
            {r.title}
          </a>
          {isNew && <Badge tone={FRESH_TONE}>🆕 新</Badge>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <Badge tone="muted">{r.source}</Badge>
          {r.author && <span>{r.author}</span>}
        </div>

        {body && (
          <p className="line-clamp-4 text-sm leading-relaxed text-foreground">
            {body}
          </p>
        )}
        {r.comment && (
          <p className="line-clamp-3 border-l-2 border-border pl-3 text-sm leading-relaxed text-muted italic font-serif-text">
            {r.comment}
          </p>
        )}
        {r.published && (
          <p className="mt-auto text-xs text-muted">
            {formatWeek(r.published)}
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋標題或摘要…"
            className={inputClass}
          />
        </div>
        {sources.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="來源篩選">
            <Chip on={source === null} onClick={() => setSource(null)}>
              全部
            </Chip>
            {sources.map((s) => (
              <Chip key={s} on={source === s} onClick={() => setSource(s)}>
                {s}
              </Chip>
            ))}
          </div>
        )}
        <p className="text-xs text-muted">
          顯示 {shown.length} / {rows.length}
        </p>
      </div>

      {sections.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          {rows.length === 0 ? "還沒有文章" : "沒有符合的文章"}
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {sections.map(({ label, items }) => (
            <section key={label}>
              <h2 className="mb-3 text-xl font-serif tracking-tight text-foreground">
                {label}
                <span className="ml-2 text-sm font-normal text-muted">
                  {items.length}
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(card)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
