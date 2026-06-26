import Link from "next/link";
import type { TrendingRow, LootRow, BlogRow } from "@/lib/data";
import { LOOT_TARGETS, type LootTarget } from "@/lib/config";
import { Badge, cardInteractive, CATEGORY_TONE, formatWeek } from "./ui";

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
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
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
}: {
  target: LootTarget;
  rows: LootRow[] | null;
}) {
  const pending = rows?.filter((r) => (r.status ?? "new") === "new") ?? [];
  return (
    <Link
      href={`/loot/${target}`}
      className={`flex flex-col gap-2 p-4 ${cardInteractive}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{LOOT_TARGETS[target].label}</span>
        <Badge tone={pending.length > 0 ? "blue" : "gray"}>
          {rows == null ? "—" : `${pending.length} 待處理`}
        </Badge>
      </div>
      {pending.slice(0, 3).map((r) => (
        <p
          key={r.id}
          className="truncate text-sm text-zinc-600 dark:text-zinc-400"
        >
          {r.repo}
        </p>
      ))}
      {rows != null && pending.length === 0 && (
        <p className="text-sm text-zinc-400">沒有待處理</p>
      )}
    </Link>
  );
}

export default function Dashboard({
  trending,
  loot,
  blog,
}: {
  trending: TrendingRow[];
  loot: Record<LootTarget, LootRow[] | null>;
  blog: BlogRow[] | null;
}) {
  const topTrending = [...trending]
    .sort((a, b) => (b.starsPerWeek ?? 0) - (a.starsPerWeek ?? 0))
    .slice(0, 5);
  // Already Published-desc from fetchBlog; just take the freshest few.
  const topBlog = (blog ?? []).slice(0, 3);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionHeader
          title="🔥 熱門 repo"
          href="/trending"
          linkText="看全部 Trending"
        />
        {topTrending.length === 0 ? (
          <p className="text-sm text-zinc-400">目前沒有 trending 資料</p>
        ) : (
          <div className="flex flex-col gap-2">
            {topTrending.map((r) => (
              <article
                key={r.id}
                className={`relative flex flex-col gap-1 p-3 ${cardInteractive}`}
              >
                <Link
                  href={`/trending/${r.id}`}
                  aria-label={`${r.repo} 詳情與趨勢`}
                  className="absolute inset-0"
                />
                <div className="flex items-center justify-between gap-3">
                  <a
                    href={r.link ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative z-10 truncate font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {r.repo}
                  </a>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                    {r.starsPerWeek != null && (
                      <span>⭐ {r.starsPerWeek.toLocaleString()}</span>
                    )}
                    {r.category && (
                      <Badge tone={CATEGORY_TONE[r.category] ?? "gray"}>
                        {r.category}
                      </Badge>
                    )}
                  </span>
                </div>
                {r.description && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {r.description}
                  </p>
                )}
                {r.comment && (
                  <p className="line-clamp-3 border-l-2 border-zinc-200 pl-2 text-xs leading-relaxed text-zinc-500 italic dark:border-zinc-700 dark:text-zinc-400">
                    {r.comment}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="📚 最新文章"
          href="/blog"
          linkText="看全部 Blog"
        />
        {topBlog.length === 0 ? (
          <p className="text-sm text-zinc-400">目前沒有文章</p>
        ) : (
          <div className="flex flex-col gap-2">
            {topBlog.map((b) => (
              <article
                key={b.id}
                className={`relative flex flex-col gap-1 p-3 ${cardInteractive}`}
              >
                <Link
                  href={`/blog/${b.id}`}
                  aria-label={`${b.title} 詳情`}
                  className="absolute inset-0"
                />
                <div className="flex items-center justify-between gap-3">
                  <a
                    href={b.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative z-10 truncate font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {b.title}
                  </a>
                  {b.source && <Badge tone="blue">{b.source}</Badge>}
                </div>
                {(b.brief || b.summary) && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {b.brief || b.summary}
                  </p>
                )}
                {b.comment && (
                  <p className="line-clamp-3 border-l-2 border-zinc-200 pl-2 text-xs leading-relaxed text-zinc-500 italic dark:border-zinc-700 dark:text-zinc-400">
                    {b.comment}
                  </p>
                )}
                {b.published && (
                  <p className="text-xs text-zinc-500">
                    {formatWeek(b.published)}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="📦 待處理 Loot" />
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(LOOT_TARGETS) as LootTarget[]).map((target) => (
            <LootSummaryCard key={target} target={target} rows={loot[target]} />
          ))}
        </div>
      </section>
    </div>
  );
}
