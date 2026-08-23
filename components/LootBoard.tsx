"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LootRow } from "@/lib/data";
import { LOOT_STATUSES, parseVerdict, type LootTarget } from "@/lib/config";
import {
  Badge,
  Chip,
  ChipScroller,
  formatWeek,
  STATUS_LABEL,
  STATUS_TONE,
  STATUS_SPINE,
  MAINTAINED_BADGE,
  VERDICT_BADGE,
  licenseTone,
} from "./ui";
import LootStatusControl from "./LootStatusControl";
import LootRating from "./LootRating";

const STATUS_ORDER: readonly string[] = LOOT_STATUSES;

export default function LootBoard({
  rows,
  target,
}: {
  rows: LootRow[];
  target: LootTarget;
}) {
  const router = useRouter();
  // Loot is editable from any device/tab; last-write-wins on Notion means a
  // backgrounded tab can hold stale optimistic state. Refresh on return to
  // reconcile with the server (the order-freeze below survives — no remount).
  // Throttled to once a minute: reconciliation is worth one refresh, but every
  // tab flick refetching a Notion-backed RSC tree under a 600s cache is not.
  const lastRefresh = useRef(0);
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh.current < 60_000) return;
      lastRefresh.current = now;
      router.refresh();
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
          x.asset.toLowerCase().includes(q) ||
          x.verdict.toLowerCase().includes(q),
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

  // Throughput at a glance: how much of the queue is still pending and what share
  // of the whole target has been adopted. Derived from the full `rows`, so the
  // numbers don't swing with the active filter.
  const pending = rows.filter((r) => (r.status ?? "new") === "new").length;
  const adoptRate =
    rows.length > 0
      ? Math.round(
          (rows.filter((r) => r.status === "adopted").length / rows.length) * 100,
        )
      : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-[var(--header-h)] z-20 -mx-4 flex flex-col gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="搜尋 repo、介紹、資產或判決"
            placeholder="搜尋 repo / 介紹 / 資產 / 判決…"
            className="w-full rounded-none border border-border bg-surface px-3 py-1.5 text-sm placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none sm:w-64"
          />
          {types.length > 0 && (
            <select
              value={type ?? ""}
              onChange={(e) => setType(e.target.value || null)}
              aria-label="類型篩選"
              className="rounded-none border border-border bg-surface px-3 py-1.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
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

        <ChipScroller label="狀態篩選">
          <Chip on={status === null} onClick={() => setStatus(null)}>
            全部
          </Chip>
          {STATUS_ORDER.map((s) => (
            <Chip key={s} on={status === s} onClick={() => setStatus(s)}>
              {STATUS_LABEL[s] ?? s}
            </Chip>
          ))}
        </ChipScroller>
        <p className="font-mono text-[11px] tracking-wide text-muted">
          顯示 {filtered.length} / {rows.length} · 待處理 {pending} · 採用率 {adoptRate}%
        </p>
      </div>

      {noResults ? (
        <p className="py-12 text-center text-sm text-muted">
          {hasFilter ? "沒有符合條件的 loot" : "還沒有 loot，等抓取任務跑完"}
        </p>
      ) : (
        keys.map((key) => {
          const items = groups
            .get(key)!
            .slice()
            .sort(
              (a, b) =>
                (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity),
            );
          // 待處理 lane opens by default — it's the work; deferred/adopted/skipped
          // collapse to keep the queue, not the archive/watchlist, in front of you.
          return (
            <details key={key} open={key === "new"} className="group/lane">
              <summary className="flex cursor-pointer list-none items-center gap-2 border-b-2 border-foreground pb-1.5 [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className="font-mono text-xs text-muted transition-transform group-open/lane:rotate-90"
                >
                  ›
                </span>
                <Badge tone={STATUS_TONE[key] ?? "muted"}>
                  {STATUS_LABEL[key] ?? key}
                </Badge>
                <span className="font-mono text-xs text-muted">{items.length}</span>
              </summary>
              <ol className="mt-2 list-none divide-y divide-border border-b border-border">
                {items.map((r) => {
                  const verdict = parseVerdict(r.verdict);
                  return (
                    <li
                      key={r.id}
                      className={`relative border-l-[3px] ${STATUS_SPINE[key] ?? "border-l-border"}`}
                    >
                      <div className="flex flex-col gap-2 p-4">
                        {/* The detail link covers the content box only; the controls
                            below sit OUTSIDE this relative box so the absolute link
                            can't swallow taps on the rating stars / status buttons.
                            The repo link rides above it (z-10) so its tap still opens
                            the repo directly — same two-anchor trick as TrendingList. */}
                        <div className="relative flex flex-col gap-1.5">
                          <Link
                            href={`/loot/${target}/${r.id}`}
                            aria-label={`${r.repo} 明細`}
                            className="absolute inset-0"
                          />
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2">
                              {/* Square unread mark (zero-radius doctrine — an ink
                                  tick, not a round dot) on pending rows only. */}
                              {key === "new" && (
                                <span
                                  aria-hidden
                                  className="h-1.5 w-1.5 shrink-0 bg-accent"
                                />
                              )}
                              <a
                                href={r.link ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative z-10 truncate font-mono text-sm font-medium text-foreground hover:text-accent"
                              >
                                {r.repo}
                              </a>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              {r.type && <Badge>{r.type}</Badge>}
                              {verdict.bucket &&
                                VERDICT_BADGE[verdict.bucket] && (
                                  <Badge>{VERDICT_BADGE[verdict.bucket]}</Badge>
                                )}
                              {r.maintained && MAINTAINED_BADGE[r.maintained] && (
                                <Badge>{MAINTAINED_BADGE[r.maintained]}</Badge>
                              )}
                              {r.license && (
                                <Badge className={licenseTone(r.license)}>
                                  {r.license}
                                </Badge>
                              )}
                              {r.week && (
                                <span className="font-mono text-[11px] text-muted">
                                  {formatWeek(r.week)}
                                </span>
                              )}
                            </span>
                          </div>
                          {r.intro && (
                            <p className="line-clamp-2 text-sm text-muted">{r.intro}</p>
                          )}
                          {r.why && (
                            <p className="line-clamp-2 text-sm">{r.why}</p>
                          )}
                          {verdict.reason && (
                            <p className="line-clamp-2 text-sm">
                              <span className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
                                判決{" "}
                              </span>
                              {verdict.reason}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-3 border-t border-border pt-3">
                          <LootRating value={r.recommendation} />
                          <LootStatusControl
                            pageId={r.id}
                            status={r.status ?? "new"}
                            target={target}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </details>
          );
        })
      )}
    </div>
  );
}
