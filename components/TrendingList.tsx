"use client";
import { useMemo, useState, type ReactNode } from "react";
import type { TrendingRow } from "@/lib/data";
import { Badge, formatWeek } from "./ui";

const CATEGORY_TONE: Record<
  string,
  "blue" | "green" | "amber" | "purple" | "gray"
> = {
  agents: "purple",
  models: "blue",
  infra: "green",
  tooling: "amber",
  apps: "gray",
  other: "gray",
};

export default function TrendingList({ rows }: { rows: TrendingRow[] }) {
  const categories = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.category).filter((c): c is string => !!c)),
      ),
    [rows],
  );
  const [active, setActive] = useState<string | null>(null);
  const shown = active ? rows.filter((r) => r.category === active) : rows;

  return (
    <div>
      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Chip on={active === null} onClick={() => setActive(null)}>
            All
          </Chip>
          {categories.map((c) => (
            <Chip key={c} on={active === c} onClick={() => setActive(c)}>
              {c}
            </Chip>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((r) => (
          <article
            key={r.id}
            className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
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
            {r.week && (
              <p className="mt-auto text-xs text-zinc-400">{formatWeek(r.week)}</p>
            )}
          </article>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="py-12 text-center text-sm text-zinc-400">No rows yet.</p>
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
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        on
          ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}
