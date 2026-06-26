"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { TrendingRow } from "@/lib/data";
import {
  Badge,
  Chip,
  ChipScroller,
  cardInteractive,
  formatWeek,
  CATEGORY_TONE,
  FRESH_TONE,
} from "./ui";

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

  // Latest week across all repos — drives the 🆕 badge so it means the SAME
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((r) => (
          <article
            key={r.id}
            className={`relative flex flex-col gap-2 p-4 ${cardInteractive}`}
          >
            {/* Whole-card link to the detail/trend page; the repo link below sits
                above it (z-10) so a tap on the name still opens the repo directly. */}
            <Link
              href={`/trending/${r.id}`}
              aria-label={`${r.repo} 詳情與趨勢`}
              className="absolute inset-0"
            />
            <div className="flex items-start justify-between gap-2">
              <a
                href={r.link ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="relative z-10 font-medium break-all text-foreground hover:text-accent"
              >
                {r.repo}
              </a>
              {/* 🆕 only for newcomers in the latest week; 🔁 for returnees; a
                  newcomer whose latest week isn't the newest shows neither —
                  rare after latestPerRepo, and intentional. NOTE: this is a
                  UI-local re-derivation of the skill's flag (github-trending
                  SKILL.md step 8 = "no prior archived row"); the two rules can
                  drift — change them together. */}
              {r.week === latestWeek && (r.weeksOnChart ?? 1) <= 1 ? (
                <Badge tone={FRESH_TONE}>🆕 新上榜</Badge>
              ) : r.weeksOnChart != null && r.weeksOnChart > 1 ? (
                <Badge tone="muted">🔁 {r.weeksOnChart} 週</Badge>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
              {r.starsPerWeek != null && (
                <span>★ <span className="font-mono tabular-nums">{r.starsPerWeek.toLocaleString()}</span></span>
              )}
              {r.language && <span>{r.language}</span>}
              {r.category && (
                <Badge tone={CATEGORY_TONE[r.category] ?? "muted"}>
                  {r.category}
                </Badge>
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
          </article>
        ))}
      </div>

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
