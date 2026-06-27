"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { TrendingRow, WeekPoint } from "@/lib/data";
import StarsTrend from "./StarsTrend";
import {
  Badge,
  Chip,
  ChipScroller,
  formatWeek,
  CATEGORY_TONE,
  FRESH_TONE,
  MAINTAINED_BADGE,
  RISK_BADGE,
} from "./ui";

type Sort = "recent" | "stars" | "momentum";

// A repo whose latest week runs >=50% above its own prior-week average is
// "heating up" and earns the 🚀 badge. Tuned to flag a genuine spike, not noise.
const MOMENTUM_HOT = 1.5;

export default function TrendingList({
  rows,
  series,
  momentum,
}: {
  rows: TrendingRow[];
  series: Record<string, WeekPoint[]>;
  momentum: Record<string, number | null>;
}) {
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
    } else if (sort === "momentum") {
      // Heating-up first; repos with no momentum (only one week) sink to the end.
      r = [...r].sort(
        (a, b) =>
          (momentum[b.repo] ?? -Infinity) - (momentum[a.repo] ?? -Infinity),
      );
    }
    return r;
  }, [rows, active, query, sort, momentum]);

  // Latest week across all repos — drives the ✨ badge so it means the SAME
  // thing as the dashboard's "本週新上榜" stat (newcomer in the most recent week),
  // not just "any repo with ≤1 week on chart" regardless of when.
  const latestWeek = useMemo(
    () => rows.reduce((m, r) => (r.week && r.week > m ? r.week : m), ""),
    [rows],
  );

  return (
    <div>
      <div className="sticky top-[var(--header-h)] z-20 -mx-4 mb-4 flex flex-col gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋 repo 或描述…"
            className="w-full rounded-none border border-border bg-surface px-3 py-1.5 text-sm placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none sm:w-64"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-none border border-border bg-surface px-3 py-1.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
          >
            <option value="recent">最新優先</option>
            <option value="stars">★/週 最高</option>
            <option value="momentum">🚀 竄升中</option>
          </select>
        </div>

        {categories.length > 0 && (
          <ChipScroller label="分類篩選">
            <Chip on={active === null} onClick={() => setActive(null)}>
              全部
            </Chip>
            {categories.map((c) => (
              <Chip key={c} on={active === c} onClick={() => setActive(c)}>
                {c}
              </Chip>
            ))}
          </ChipScroller>
        )}
        <p className="text-xs text-muted">
          顯示 {shown.length} / {rows.length}
        </p>
      </div>

      {/* Ranked ledger — the rank gutter turns the flat grid into a leaderboard.
          Single column (not a card grid) so the gutter's border-r reads as one
          continuous rule down the page, the way a league table does. Rank is the
          row's position in `shown`, so flipping the sort live-renumbers; it means
          "place in the current view", not an absolute score. */}
      {shown.length > 0 && (
        <ol className="list-none divide-y divide-border border-y border-border">
          {shown.map((r, i) => {
            // Week-over-week change in ★/wk, from this repo's full series. Up wears
            // the positive green, down/flat the muted ink — never --danger, which
            // is reserved for a write failure. Null when there's no prior week.
            const pts = series[r.repo] ?? [];
            const last = pts[pts.length - 1]?.stars;
            const prev = pts[pts.length - 2]?.stars;
            const delta =
              last != null && prev != null ? last - prev : null;
            const mo = momentum[r.repo] ?? null;
            return (
              <li
                key={r.id}
                className="group relative grid grid-cols-[2.75rem_1fr] transition-colors duration-[var(--dur-ink)] ease-[var(--ease-ink)] hover:bg-surface sm:grid-cols-[3.5rem_1fr_auto]"
              >
                {/* Whole-row link to the detail/trend page; the repo link below sits
                    above it (z-10) so a tap on the name still opens the repo directly. */}
                <Link
                  href={`/trending/${r.id}`}
                  aria-label={`${r.repo} 詳情與趨勢`}
                  className="absolute inset-0"
                />
                {/* Rank gutter: the page's signature element. Mono tabular figures so
                    the column stays vertically aligned; darkens to ink on row hover,
                    on-doctrine (depth from ink, not a shadow lift). */}
                <div className="flex justify-center border-r border-border pt-4 font-mono text-sm tabular-nums text-muted transition-colors group-hover:border-ink-2 group-hover:text-foreground">
                  <span className="text-muted/50">#</span>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="flex flex-col gap-2 px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={r.link ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative z-10 font-medium break-all text-foreground hover:text-accent"
                    >
                      {r.repo}
                    </a>
                    {/* Right rail of badges. 🚀 (relative-momentum spike) is
                        orthogonal to ✨/🏆 and can stack with either. ✨ only for
                        newcomers in the latest week; 🏆 for returnees; a newcomer
                        whose latest week isn't the newest shows neither — rare after
                        latestPerRepo, and intentional. NOTE: the ✨/🏆 rule is a
                        UI-local re-derivation of the skill's flag (github-trending
                        SKILL.md step 8 = "no prior archived row"); change them
                        together. */}
                    <div className="flex shrink-0 items-center gap-1.5">
                      {mo != null && mo >= MOMENTUM_HOT && (
                        <Badge tone="accent">🚀 竄升中</Badge>
                      )}
                      {r.week === latestWeek && (r.weeksOnChart ?? 1) <= 1 ? (
                        <Badge tone={FRESH_TONE}>✨ 新上榜</Badge>
                      ) : r.weeksOnChart != null && r.weeksOnChart > 1 ? (
                        <Badge tone="muted">🏆 {r.weeksOnChart} 週</Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {r.starsPerWeek != null && (
                      <span>★ <span className="font-mono tabular-nums">{r.starsPerWeek.toLocaleString()}</span></span>
                    )}
                    {delta != null && delta !== 0 && (
                      <span className={delta > 0 ? "text-pos" : "text-danger"}>
                        {delta > 0 ? "▲" : "▼"}{" "}
                        <span className="font-mono tabular-nums">
                          {Math.abs(delta).toLocaleString()}
                        </span>
                      </span>
                    )}
                    {r.language && <span>{r.language}</span>}
                    {r.category && (
                      <Badge tone={CATEGORY_TONE[r.category] ?? "muted"}>
                        {r.category}
                      </Badge>
                    )}
                    {r.maintained && MAINTAINED_BADGE[r.maintained] && (
                      <Badge>{MAINTAINED_BADGE[r.maintained]}</Badge>
                    )}
                    {r.risk && RISK_BADGE[r.risk] && (
                      <Badge>{RISK_BADGE[r.risk]}</Badge>
                    )}
                  </div>

                  {r.description && (
                    <p className="line-clamp-3 text-sm leading-relaxed text-foreground">
                      {r.description}
                    </p>
                  )}
                  {r.comment && (
                    <p className="line-clamp-3 border-l-2 border-border pl-3 text-sm leading-relaxed text-muted font-serif-text italic">
                      {r.comment}
                    </p>
                  )}
                  {r.week && (
                    <p className="mt-auto text-xs text-muted">{formatWeek(r.week)}</p>
                  )}
                </div>
                {/* Sparkline rail (sm+): the trajectory at a glance beside the row.
                    Hidden on mobile, where the rank + figures already carry it. */}
                <div className="hidden items-start py-4 pr-4 sm:flex">
                  {pts.length > 1 && <StarsTrend points={pts} compact />}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {shown.length === 0 && (
        <p className="py-12 text-center text-sm text-muted">
          {query
            ? `沒有符合「${query}」的結果`
            : active
              ? "這個分類目前沒有資料"
              : "還沒有 trending 資料，等下次同步"}
        </p>
      )}
    </div>
  );
}
