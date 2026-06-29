import Link from "next/link";
import type { TrendingRow, LootRow, BlogRow, WeekPoint } from "@/lib/data";
import { LOOT_TARGETS, type LootTarget } from "@/lib/config";
import {
  Badge,
  cardInteractive,
  CATEGORY_TONE,
  CATEGORY_HUE,
  MOMENTUM_HOT,
  formatWeek,
} from "./ui";
import StarsTrend from "./StarsTrend";

function SectionHeader({
  title,
  href,
  linkText,
}: {
  title: string;
  href?: string;
  linkText?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-serif text-xl tracking-tight text-foreground">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="text-xs font-medium text-accent hover:underline"
        >
          {linkText} →
        </Link>
      )}
    </div>
  );
}

function LootSummaryCard({
  target,
  rows,
  authed,
}: {
  target: LootTarget;
  rows: LootRow[] | null;
  authed: boolean;
}) {
  const pending = rows?.filter((r) => (r.status ?? "new") === "new") ?? [];
  return (
    <Link
      href={`/loot/${target}`}
      className={`flex flex-col gap-2 p-4 ${cardInteractive}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{LOOT_TARGETS[target].label}</span>
        <Badge tone={pending.length > 0 ? "accent" : "muted"}>
          {rows == null ? "—" : `${pending.length} 待處理`}
        </Badge>
      </div>
      {/* The pending count above is public; the repo names are gated — logged-out
          visitors get a login prompt instead of the shortlist. */}
      {authed ? (
        <>
          {pending.slice(0, 3).map((r) => (
            <p key={r.id} className="truncate text-sm text-muted">
              {r.repo}
            </p>
          ))}
          {rows != null && pending.length === 0 && (
            <p className="text-sm text-muted">沒有待處理</p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">🔒 登入查看明細</p>
      )}
    </Link>
  );
}

export default function Dashboard({
  trending,
  loot,
  blog,
  series,
  momentum,
  categoryMix,
  authed,
}: {
  trending: TrendingRow[];
  loot: Record<LootTarget, LootRow[] | null>;
  blog: BlogRow[] | null;
  series: Record<string, WeekPoint[]>;
  momentum: Record<string, number | null>;
  categoryMix: { category: string; count: number }[];
  authed: boolean;
}) {
  const topTrending = [...trending]
    .sort((a, b) => (b.starsPerWeek ?? 0) - (a.starsPerWeek ?? 0))
    .slice(0, 5);
  // The hottest repo is the front-page LEAD; the rest run as numbered briefs.
  const lead = topTrending[0] ?? null;
  const rest = topTrending.slice(1);
  const leadPts = lead ? series[lead.repo] ?? [] : [];
  // Already Published-desc from fetchBlog; just take the freshest few.
  const topBlog = (blog ?? []).slice(0, 3);

  // 本週竄升 — repos genuinely heating up: momentum >= MOMENTUM_HOT, the SAME bar as
  // the 🚀 badge, so "shown here" and "hot enough to flag" are one definition. Ranked
  // by that relative spike, NOT by absolute stars/wk like the 熱門 list, so the front
  // page shows both lenses: big-and-steady vs small-and-surging. Top five.
  const surging = [...trending]
    .filter((r) => (momentum[r.repo] ?? 0) >= MOMENTUM_HOT)
    .sort((a, b) => (momentum[b.repo] ?? 0) - (momentum[a.repo] ?? 0))
    .slice(0, 5);

  const mixTotal = categoryMix.reduce((sum, m) => sum + m.count, 0);

  // An unmapped category falls back to bg-cat-other and would collide with a real
  // `other` segment. Mirror assertProps' "make silent drift loud" — but warn,
  // don't throw (a bar colour isn't worth crashing the page), and only in dev, so
  // the next dev sees it in the server log and adds a --cat-* token. The Notion
  // Category list lives in the routine, so an unmapped value is only knowable here
  // at read time, never statically.
  if (process.env.NODE_ENV !== "production") {
    const unmapped = categoryMix
      .map((m) => m.category)
      .filter((c) => !(c in CATEGORY_HUE));
    if (unmapped.length > 0) {
      console.warn(
        `[Dashboard] 本週分類 has no --cat-* hue for: ${unmapped.join(", ")} — falling back to bg-cat-other. Add a token in globals.css + CATEGORY_HUE.`,
      );
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {/* 本週分類 — the mix behind the stat cards above, as one stacked bar. The
          ONE surface that spends category hues (CATEGORY_HUE); a 1px gap reveals
          the border ink between segments, and a swatch legend names each. */}
      {mixTotal > 0 && (
        <section>
          <div className="mb-2 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
            本週分類 · {mixTotal} 在榜
          </div>
          <div
            className="flex h-7 w-full gap-px overflow-hidden border border-border bg-border"
            role="img"
            aria-label={`本週分類分佈：${categoryMix
              .map((m) => `${m.category} ${m.count}`)
              .join("、")}`}
          >
            {categoryMix.map((m) => (
              <div
                key={m.category}
                className={CATEGORY_HUE[m.category] ?? "bg-cat-other"}
                style={{ width: `${(m.count / mixTotal) * 100}%` }}
                title={`${m.category}：${m.count}`}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {categoryMix.map((m) => (
              <span
                key={m.category}
                className="flex items-center gap-1.5 font-mono text-[11px] text-muted"
              >
                <span
                  className={`inline-block h-2.5 w-2.5 ${CATEGORY_HUE[m.category] ?? "bg-cat-other"}`}
                  aria-hidden="true"
                />
                {m.category} · {m.count}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 🔥 熱門 repo — a newspaper section front: the masthead banner, then the
          week's hottest repo as the hero #01 (display headline + full-ink 點評 deck +
          full chart), then #02… as briefs. One banner over the whole absolute-★
          leaderboard; the relative-momentum 本週竄升 list follows below. */}
      <section>
        <SectionHeader
          title="🔥 熱門 repo"
          href="/trending"
          linkText="看全部 Trending"
        />
        {lead && (
          <div className="relative border-b-2 border-foreground pb-5">
            <Link
              href={`/trending/${lead.id}`}
              aria-label={`${lead.repo} 詳情與趨勢`}
              className="absolute inset-0"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase tabular-nums">
                01 · 本週頭條
              </span>
              {lead.starsPerWeek != null && (
                <Badge tone="accent">★ {lead.starsPerWeek.toLocaleString()} / 週</Badge>
              )}
            </div>
            <a
              href={lead.link ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 mt-2 block font-serif text-3xl leading-tight break-all text-foreground transition-colors hover:text-accent sm:text-4xl"
            >
              {lead.repo}
            </a>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-wide text-muted uppercase">
              {lead.language && <span>{lead.language}</span>}
              {lead.category && (
                <Badge tone={CATEGORY_TONE[lead.category] ?? "muted"}>
                  {lead.category}
                </Badge>
              )}
              {lead.weeksOnChart != null && <span>🏆 {lead.weeksOnChart} 週</span>}
              {lead.week && <span>{formatWeek(lead.week)}</span>}
            </div>
            {(lead.comment || lead.description) && (
              <p className="mt-3 max-w-2xl font-serif-text text-lg leading-relaxed text-foreground">
                {lead.comment || lead.description}
              </p>
            )}
            {leadPts.length > 1 && (
              <div className="mt-4">
                <StarsTrend points={leadPts} />
              </div>
            )}
          </div>
        )}
        {rest.length === 0 ? (
          <p className="text-sm text-muted">目前沒有更多 trending 資料</p>
        ) : (
          <ol className="divide-y divide-border pt-1">
            {rest.map((r, i) => (
              <li
                key={r.id}
                className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-2 py-3"
              >
                <Link
                  href={`/trending/${r.id}`}
                  aria-label={`${r.repo} 詳情與趨勢`}
                  className="absolute inset-0"
                />
                {/* Briefs continue the LEAD's numbering — the LEAD is 01. */}
                <span className="pt-0.5 font-mono text-xs tabular-nums text-muted">
                  {String(i + 2).padStart(2, "0")}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={r.link ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative z-10 min-w-0 truncate font-medium text-foreground hover:text-accent"
                    >
                      {r.repo}
                    </a>
                    {r.starsPerWeek != null && (
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                        ★ {r.starsPerWeek.toLocaleString()}
                      </span>
                    )}
                  </div>
                  {r.comment ? (
                    <p className="line-clamp-2 font-serif-text text-sm leading-relaxed text-muted italic">
                      {r.comment}
                    </p>
                  ) : r.description ? (
                    <p className="line-clamp-2 text-sm leading-relaxed text-muted">
                      {r.description}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 🚀 本週竄升 — the relative-momentum lens: who is accelerating fastest vs their
          own prior-week mean, distinct from the absolute-stars 熱門 list above, so the
          front page shows both lenses. Membership is momentum >= MOMENTUM_HOT (the same
          bar as the 🚀 badge), so every ×N.N here is genuinely hot — always accent. */}
      <section>
        <SectionHeader
          title="🚀 本週竄升"
          href="/trending"
          linkText="看全部 Trending"
        />
        <p className="-mt-2 mb-3 text-xs text-muted">
          相對自身前幾週均值的加速度，不是絕對成長
        </p>
        {surging.length === 0 ? (
          <p className="text-sm text-muted">本週沒有明顯竄升的 repo</p>
        ) : (
          <ol className="divide-y divide-border border-t border-border">
            {surging.map((r, i) => {
              const pts = series[r.repo] ?? [];
              const last = pts[pts.length - 1]?.stars;
              const prev = pts[pts.length - 2]?.stars;
              const delta = last != null && prev != null ? last - prev : null;
              const mo = momentum[r.repo];
              return (
                <li
                  key={r.id}
                  className="relative grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 py-3"
                >
                  <Link
                    href={`/trending/${r.id}`}
                    aria-label={`${r.repo} 詳情與趨勢`}
                    className="absolute inset-0"
                  />
                  <span className="pt-0.5 font-mono text-xs tabular-nums text-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <a
                        href={r.link ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative z-10 min-w-0 truncate font-medium text-foreground hover:text-accent"
                      >
                        {r.repo}
                      </a>
                      {mo != null && (
                        <Badge tone="accent">×{mo.toFixed(1)}</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      {r.starsPerWeek != null && (
                        <span>
                          ★{" "}
                          <span className="font-mono tabular-nums">
                            {r.starsPerWeek.toLocaleString()}
                          </span>
                        </span>
                      )}
                      {delta != null && delta !== 0 && (
                        <span className={delta > 0 ? "text-pos" : "text-danger"}>
                          {delta > 0 ? "▲" : "▼"}{" "}
                          <span className="font-mono tabular-nums">
                            {Math.abs(delta).toLocaleString()}
                          </span>
                        </span>
                      )}
                      {r.category && (
                        <Badge tone={CATEGORY_TONE[r.category] ?? "muted"}>
                          {r.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {pts.length > 1 && (
                    <div className="hidden sm:block">
                      <StarsTrend points={pts} compact />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section>
        <SectionHeader
          title="📚 最新文章"
          href="/blog"
          linkText="看全部 Blog"
        />
        {topBlog.length === 0 ? (
          <p className="text-sm text-muted">目前沒有文章</p>
        ) : (
          <ol className="divide-y divide-border border-t border-border">
            {topBlog.map((b, i) => (
              <li
                key={b.id}
                className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-2 py-3"
              >
                <Link
                  href={`/blog/${b.id}`}
                  aria-label={`${b.title} 詳情`}
                  className="absolute inset-0"
                />
                <span className="pt-0.5 font-mono text-xs tabular-nums text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={b.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative z-10 min-w-0 truncate font-serif text-base text-foreground hover:text-accent"
                    >
                      {b.title}
                    </a>
                    {b.source && <Badge tone="muted">{b.source}</Badge>}
                  </div>
                  {(b.brief || b.summary) && (
                    <p className="line-clamp-2 font-serif-text text-sm leading-relaxed text-muted">
                      {b.brief || b.summary}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Stop-press footer wire: the loot queue, set off by a heavy top rule. */}
      <section className="border-t-2 border-foreground pt-6">
        <SectionHeader title="📦 待處理 Loot" />
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(LOOT_TARGETS) as LootTarget[]).map((target) => (
            <LootSummaryCard
              key={target}
              target={target}
              rows={loot[target]}
              authed={authed}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
