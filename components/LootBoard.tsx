"use client";
import { useMemo, useState, type ReactNode } from "react";
import type { LootRow } from "@/lib/data";
import { Badge, cardInteractive, formatWeek } from "./ui";
import LootStatusControl from "./LootStatusControl";

const STATUS_ORDER = ["new", "adopted", "skipped"];
const STATUS_TONE: Record<string, "blue" | "green" | "gray"> = {
  new: "blue",
  adopted: "green",
  skipped: "gray",
};

export default function LootBoard({ rows }: { rows: LootRow[] }) {
  const types = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.type).filter((t): t is string => !!t))),
    [rows],
  );
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let r = rows;
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (x) =>
          x.repo.toLowerCase().includes(q) ||
          x.intro.toLowerCase().includes(q) ||
          x.asset.toLowerCase().includes(q),
      );
    }
    if (type) r = r.filter((x) => x.type === type);
    if (status) r = r.filter((x) => (x.status ?? "new") === status);
    return r;
  }, [rows, query, type, status]);

  const groups = new Map<string, LootRow[]>();
  for (const r of filtered) {
    const key = r.status ?? "new";
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }
  const keys = [
    ...STATUS_ORDER.filter((k) => groups.has(k)),
    ...[...groups.keys()].filter((k) => !STATUS_ORDER.includes(k)),
  ];

  const noResults = filtered.length === 0;
  const hasFilter = !!query || !!type || !!status;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋 repo / 介紹 / 資產…"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 focus:outline-none sm:w-64 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:ring-zinc-700"
          />
          {types.length > 0 && (
            <select
              value={type ?? ""}
              onChange={(e) => setType(e.target.value || null)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:focus:ring-zinc-700"
            >
              <option value="">全部類型</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip on={status === null} onClick={() => setStatus(null)}>
            全部
          </Chip>
          {STATUS_ORDER.map((s) => (
            <Chip key={s} on={status === s} onClick={() => setStatus(s)}>
              {s}
            </Chip>
          ))}
        </div>
      </div>

      {noResults ? (
        <p className="py-12 text-center text-sm text-zinc-400">
          {hasFilter ? "沒有符合條件的 loot" : "No loot yet."}
        </p>
      ) : (
        keys.map((key) => (
          <section key={key}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-500">
              <Badge tone={STATUS_TONE[key] ?? "gray"}>{key}</Badge>
              <span>{groups.get(key)!.length}</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.get(key)!.map((r) => (
                <article
                  key={r.id}
                  className={`flex flex-col gap-1.5 p-4 ${cardInteractive}`}
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
                    {r.type && <Badge tone="purple">{r.type}</Badge>}
                  </div>
                  {r.intro && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {r.intro}
                    </p>
                  )}
                  {r.asset && (
                    <p className="text-sm">
                      <span className="text-zinc-400">偷什麼 </span>
                      {r.asset}
                    </p>
                  )}
                  {r.why && (
                    <p className="text-sm">
                      <span className="text-zinc-400">為何 </span>
                      {r.why}
                    </p>
                  )}
                  {r.how && (
                    <p className="text-sm">
                      <span className="text-zinc-400">怎麼搬 </span>
                      {r.how}
                    </p>
                  )}
                  {r.week && (
                    <p className="mt-1 text-xs text-zinc-400">
                      {formatWeek(r.week)}
                    </p>
                  )}
                  <div className="mt-auto border-t border-zinc-100 pt-2 dark:border-zinc-800">
                    <LootStatusControl pageId={r.id} status={r.status ?? "new"} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
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
