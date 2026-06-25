"use client";
import { useMemo, useState, type ReactNode } from "react";
import type { TrendingRow } from "@/lib/data";
import { Badge, cardInteractive, formatWeek, CATEGORY_TONE } from "./ui";

type Sort = "recent" | "stars";

export default function TrendingList({ rows }: { rows: TrendingRow[] }) {
  const categories = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.category).filter((c): c is string => !!c)),
      ),
    [rows],
  );
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  const shown = useMemo(() => {
    let r = active ? rows.filter((x) => x.category === active) : rows;
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (x) =>
          x.repo.toLowerCase().includes(q) ||
          x.description.toLowerCase().includes(q),
      );
    }
    // "recent" keeps the server order (Week desc, then Stars/wk desc).
    if (sort === "stars") {
      r = [...r].sort((a, b) => (b.starsPerWeek ?? 0) - (a.starsPerWeek ?? 0));
    }
    return r;
  }, [rows, active, query, sort]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋 repo 或描述…"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 focus:outline-none sm:w-64 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:ring-zinc-700"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:focus:ring-zinc-700"
          >
            <option value="recent">最新優先</option>
            <option value="stars">⭐/週 最高</option>
          </select>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Chip on={active === null} onClick={() => setActive(null)}>
              全部
            </Chip>
            {categories.map((c) => (
              <Chip key={c} on={active === c} onClick={() => setActive(c)}>
                {c}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <p className="mb-3 text-xs text-zinc-500">
        顯示 {shown.length} / {rows.length}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((r) => (
          <article
            key={r.id}
            className={`flex flex-col gap-2 p-4 ${cardInteractive}`}
          >
            <div className="flex items-start justify-between gap-2">
              <a
                href={r.link ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium break-all text-blue-600 hover:underline dark:text-blue-400"
              >
                {r.repo}
              </a>
              {r.weeksOnChart != null && (
                <Badge tone={r.weeksOnChart > 1 ? "green" : "amber"}>
                  {r.weeksOnChart > 1 ? `🔁 ${r.weeksOnChart}w` : "🆕 new"}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
              {r.starsPerWeek != null && (
                <span>⭐ {r.starsPerWeek.toLocaleString()}</span>
              )}
              {r.language && <Badge>{r.language}</Badge>}
              {r.category && (
                <Badge tone={CATEGORY_TONE[r.category] ?? "gray"}>
                  {r.category}
                </Badge>
              )}
            </div>

            {r.description && (
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {r.description}
              </p>
            )}
            {r.comment && (
              <p className="border-l-2 border-zinc-200 pl-3 text-sm leading-relaxed text-zinc-500 italic dark:border-zinc-700 dark:text-zinc-400">
                {r.comment}
              </p>
            )}
            {r.week && (
              <p className="mt-auto text-xs text-zinc-400">{formatWeek(r.week)}</p>
            )}
          </article>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="py-12 text-center text-sm text-zinc-400">
          {query
            ? `沒有符合「${query}」的結果`
            : active
              ? "這個分類目前沒有資料"
              : "No rows yet."}
        </p>
      )}
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-95 dark:focus-visible:ring-zinc-500 ${
        on
          ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}
