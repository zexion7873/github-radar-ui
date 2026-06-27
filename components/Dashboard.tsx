import Link from "next/link";
import type { TrendingRow, LootRow, BlogRow, WeekPoint } from "@/lib/data";
import { LOOT_TARGETS, type LootTarget } from "@/lib/config";
import { Badge, cardInteractive, CATEGORY_TONE, formatWeek } from "./ui";
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
  authed,
}: {
  trending: TrendingRow[];
  loot: Record<LootTarget, LootRow[] | null>;
  blog: BlogRow[] | null;
  series: Record<string, WeekPoint[]>;
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

  return (
    <div className="flex flex-col gap-10">
      {/* LEAD — above the fold: the week's hottest repo at front-page weight. The
          one place the dashboard spends a display headline and renders the 點評 as
          a full-ink deck (everywhere else it's a muted-italic aside). */}
      {lead && (
        <section className="relative border-y-2 border-foreground py-5">
          <Link
            href={`/trending/${lead.id}`}
            aria-label={`${lead.repo} 詳情與趨勢`}
            className="absolute inset-0"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
              本週頭條
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
            {lead.weeksOnChart != null && <span>🔁 {lead.weeksOnChart} 週</span>}
            {lead.week && <span>{formatWeek(lead.week)}</span>}
          </div>
          {(lead.comment || lead.description) && (
            <p className="mt-3 max-w-2xl font-serif-text text-lg leading-relaxed text-foreground">
              {lead.comment || lead.description}
            </p>
          )}
          {leadPts.length > 1 && (
            <div className="mt-4">
              <StarsTrend points={leadPts} compact />
            </div>
          )}
        </section>
      )}

      <section>
        <SectionHeader
          title="🔥 熱門 repo"
          href="/trending"
          linkText="看全部 Trending"
        />
        {rest.length === 0 ? (
          <p className="text-sm text-muted">目前沒有更多 trending 資料</p>
        ) : (
          <ol className="divide-y divide-border border-t border-border">
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
