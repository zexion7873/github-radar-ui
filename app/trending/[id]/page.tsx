import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchTrending } from "@/lib/data";
import { TABLES } from "@/lib/config";
import { Badge, CATEGORY_TONE, DataError, cardClass, formatWeek } from "@/components/ui";
import StarsTrend from "@/components/StarsTrend";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await fetchTrending(TABLES.trending);
  if (!result.ok) return <DataError error={result.error} />;

  // id is one weekly row's page id (the list links the latest week). Find it, then
  // gather every week for that repo — the history latestPerRepo() collapses away.
  const target = result.rows.find((r) => r.id === id);
  if (!target) notFound();

  const history = result.rows
    .filter((r) => r.repo === target.repo)
    .sort((a, b) => (a.week ?? "").localeCompare(b.week ?? ""));
  const latest = history[history.length - 1];
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const delta =
    latest.starsPerWeek != null && prev?.starsPerWeek != null
      ? latest.starsPerWeek - prev.starsPerWeek
      : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/trending"
        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Trending
      </Link>

      <header className="flex flex-col gap-2">
        <a
          href={latest.link ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xl font-semibold break-all text-blue-600 hover:underline dark:text-blue-400"
        >
          {latest.repo} ↗
        </a>
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
          {latest.starsPerWeek != null && (
            <span>⭐ {latest.starsPerWeek.toLocaleString()} / 週</span>
          )}
          {latest.language && <span>{latest.language}</span>}
          {latest.category && (
            <Badge tone={CATEGORY_TONE[latest.category] ?? "gray"}>
              {latest.category}
            </Badge>
          )}
          {latest.weeksOnChart != null && <span>🔁 上榜 {latest.weeksOnChart} 週</span>}
          {latest.week && <span>最新 {formatWeek(latest.week)}</span>}
        </div>
      </header>

      <section className={`flex flex-col gap-3 p-4 ${cardClass}`}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">每週 stars / 週</h2>
          {delta != null && (
            <span
              className={`text-sm ${delta >= 0 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}
            >
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toLocaleString()} vs 上週
            </span>
          )}
        </div>
        {history.length > 1 ? (
          <StarsTrend
            points={history.map((r) => ({ week: r.week, stars: r.starsPerWeek }))}
          />
        ) : (
          <p className="text-sm text-zinc-500">本週首次上榜，尚無歷史趨勢。</p>
        )}
      </section>

      {latest.description && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">描述</h2>
          <p className="text-sm leading-relaxed whitespace-pre-line text-zinc-700 dark:text-zinc-300">
            {latest.description}
          </p>
        </section>
      )}
      {latest.comment && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">點評</h2>
          <p className="border-l-2 border-zinc-200 pl-3 text-sm leading-relaxed whitespace-pre-line text-zinc-600 italic dark:border-zinc-700 dark:text-zinc-400">
            {latest.comment}
          </p>
        </section>
      )}
    </div>
  );
}
