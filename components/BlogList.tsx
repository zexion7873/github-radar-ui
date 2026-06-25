"use client";
import { useMemo, useState } from "react";
import type { BlogRow } from "@/lib/data";
import { Badge, Chip, cardInteractive, formatWeek, FRESH_TONE } from "./ui";

// Blog Archive's Type is a closed enum (official / individual); render each as
// its own section, newest first (rows already arrive Published-desc).
const GROUPS: { type: string; label: string }[] = [
  { type: "official", label: "🏛 官方" },
  { type: "individual", label: "🧑‍💻 個人" },
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 focus:outline-none sm:w-64 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:ring-zinc-700";

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

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-col gap-3 bg-zinc-50/90 px-4 py-3 backdrop-blur dark:bg-black/90">
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
        <p className="text-xs text-zinc-500">
          顯示 {shown.length} / {rows.length}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500">
          {rows.length === 0 ? "還沒有文章" : "沒有符合的文章"}
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {GROUPS.map(({ type, label }) => {
            const group = shown.filter((r) => r.type === type);
            if (group.length === 0) return null;
            return (
              <section key={type}>
                <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {label}
                  <span className="ml-2 text-sm font-normal text-zinc-400">
                    {group.length}
                  </span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.map((r) => {
                    const isNew =
                      !!r.archived &&
                      latestArchived - Date.parse(r.archived) < WEEK_MS;
                    return (
                      <article
                        key={r.id}
                        className={`flex flex-col gap-2 p-4 ${cardInteractive}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={r.url ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {r.title}
                          </a>
                          {isNew && <Badge tone={FRESH_TONE}>🆕 新</Badge>}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                          <Badge tone="blue">{r.source}</Badge>
                          {r.author && <span>{r.author}</span>}
                        </div>

                        {r.summary && (
                          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                            {r.summary}
                          </p>
                        )}
                        {r.comment && (
                          <p className="border-l-2 border-zinc-200 pl-3 text-sm leading-relaxed text-zinc-500 italic dark:border-zinc-700 dark:text-zinc-400">
                            {r.comment}
                          </p>
                        )}
                        {r.published && (
                          <p className="mt-auto text-xs text-zinc-500">
                            {formatWeek(r.published)}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
