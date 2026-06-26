"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LootRow } from "@/lib/data";
import { LOOT_STATUSES } from "@/lib/config";
import {
  Badge,
  Chip,
  cardInteractive,
  formatWeek,
  STATUS_LABEL,
  STATUS_TONE,
} from "./ui";
import LootStatusControl from "./LootStatusControl";
import LootRating from "./LootRating";

const STATUS_ORDER: readonly string[] = LOOT_STATUSES;

export default function LootBoard({ rows }: { rows: LootRow[] }) {
  const router = useRouter();
  // Loot is editable from any device/tab; last-write-wins on Notion means a
  // backgrounded tab can hold stale optimistic state. Refresh on return to
  // reconcile with the server (the order-freeze below survives — no remount).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

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

  // Freeze each card's position from the first render's recommendation order, so
  // rating a card — which revalidates and would otherwise re-sort the group —
  // doesn't make it jump and cost the user their place mid-triage. The lazy
  // useState initialiser snapshots once on mount; cards added later append, and a
  // full reload re-snapshots against the latest ratings.
  const [order] = useState(() => {
    const ranked = [...rows].sort(
      (a, b) => (b.recommendation ?? -1) - (a.recommendation ?? -1),
    );
    return new Map(ranked.map((r, i) => [r.id, i]));
  });

  const noResults = filtered.length === 0;
  const hasFilter = !!query || !!type || !!status;

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-[var(--header-h)] z-10 -mx-4 flex flex-col gap-3 bg-zinc-50/90 px-4 py-3 backdrop-blur dark:bg-black/90">
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

        <div className="flex flex-wrap gap-2" role="group" aria-label="狀態篩選">
          <Chip on={status === null} onClick={() => setStatus(null)}>
            全部
          </Chip>
          {STATUS_ORDER.map((s) => (
            <Chip key={s} on={status === s} onClick={() => setStatus(s)}>
              {STATUS_LABEL[s] ?? s}
            </Chip>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          顯示 {filtered.length} / {rows.length}
        </p>
      </div>

      {noResults ? (
        <p className="py-12 text-center text-sm text-zinc-500">
          {hasFilter ? "沒有符合條件的 loot" : "還沒有 loot，等抓取任務跑完"}
        </p>
      ) : (
        keys.map((key) => (
          <section key={key}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              <Badge tone={STATUS_TONE[key] ?? "gray"}>
                {STATUS_LABEL[key] ?? key}
              </Badge>
              <span className="text-sm font-normal text-zinc-400">
                {groups.get(key)!.length}
              </span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {groups
                .get(key)!
                .slice()
                .sort(
                  (a, b) =>
                    (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity),
                )
                .map((r) => (
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
                    {r.type && <Badge>{r.type}</Badge>}
                  </div>
                  {r.intro && (
                    <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {r.intro}
                    </p>
                  )}
                  {r.asset && (
                    <p className="line-clamp-3 text-sm">
                      <span className="font-medium text-zinc-500 dark:text-zinc-400">偷什麼 </span>
                      {r.asset}
                    </p>
                  )}
                  {r.why && (
                    <p className="line-clamp-3 text-sm">
                      <span className="font-medium text-zinc-500 dark:text-zinc-400">為何 </span>
                      {r.why}
                    </p>
                  )}
                  {r.how && (
                    <p className="line-clamp-3 text-sm">
                      <span className="font-medium text-zinc-500 dark:text-zinc-400">怎麼搬 </span>
                      {r.how}
                    </p>
                  )}
                  {r.week && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatWeek(r.week)}
                    </p>
                  )}
                  <div className="mt-auto flex flex-col gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <LootRating pageId={r.id} value={r.recommendation} />
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
