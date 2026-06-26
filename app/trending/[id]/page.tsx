import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchTrending } from "@/lib/data";
import { TABLES } from "@/lib/config";
import { Badge, CATEGORY_TONE, DataError, formatWeek } from "@/components/ui";
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
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <Link
        href="/trending"
        className="font-mono text-[11px] tracking-wide text-muted uppercase transition-colors hover:text-foreground"
      >
        ← Trending
      </Link>

      <header className="flex flex-col gap-2">
        <a
          href={latest.link ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="font-serif text-2xl break-all text-foreground transition-colors hover:text-accent"
        >
          {latest.repo} ↗
        </a>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-wide text-muted uppercase">
          {latest.language && <span>{latest.language}</span>}
          {latest.category && (
            <Badge tone={CATEGORY_TONE[latest.category] ?? "muted"}>
              {latest.category}
            </Badge>
          )}
          {latest.week && <span>最新 {formatWeek(latest.week)}</span>}
        </div>
      </header>

      {/* Terminal-style readout — the Tape dialect's signature on the detail page:
          the key figures as big mono tabular numerals, the trajectory the hero
          chart below. The ★/週 and 上榜週數 move here from the header meta so each
          figure is stated once. */}
      {/* Accent top on every cell: this readout exists to feature these three
          figures, so each is "hot" metric content that earns the mark — the accent
          still marks meaning (all three ARE the headline data here), unlike
          StatsBar where one featured stat sits among context cells. Delta is a
          ticker reading: green up, danger red down — never on the same surface as
          the write-failure red, so the two never collide. */}
      <div className="grid grid-cols-3 border-b border-border">
        <div className="border-t-[3px] border-t-accent border-r border-border px-3 py-3">
          <div className="font-mono text-2xl tabular-nums text-foreground">
            {latest.starsPerWeek?.toLocaleString() ?? "—"}
          </div>
          <div className="mt-1 font-mono text-[10px] tracking-wide text-muted uppercase">
            ★ / 週
          </div>
        </div>
        <div className="border-t-[3px] border-t-accent border-r border-border px-3 py-3">
          <div
            className={`font-mono text-2xl tabular-nums ${
              delta == null
                ? "text-muted"
                : delta >= 0
                  ? "text-pos"
                  : "text-danger"
            }`}
          >
            {delta == null
              ? "—"
              : `${delta >= 0 ? "▲" : "▼"}${Math.abs(delta).toLocaleString()}`}
          </div>
          <div className="mt-1 font-mono text-[10px] tracking-wide text-muted uppercase">
            vs 上週
          </div>
        </div>
        <div className="border-t-[3px] border-t-accent px-3 py-3">
          <div className="font-mono text-2xl tabular-nums text-foreground">
            {latest.weeksOnChart ?? "—"}
          </div>
          <div className="mt-1 font-mono text-[10px] tracking-wide text-muted uppercase">
            上榜週數
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-xl">每週趨勢</h2>
        {history.length > 1 ? (
          <StarsTrend
            points={history.map((r) => ({ week: r.week, stars: r.starsPerWeek }))}
          />
        ) : (
          <p className="text-sm text-muted">本週首次上榜，尚無歷史趨勢。</p>
        )}
      </section>

      {latest.description && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-xl">描述</h2>
          <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
            {latest.description}
          </p>
        </section>
      )}
      {latest.comment && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-xl">點評</h2>
          <p className="border-l-[3px] border-accent pl-4 font-serif-text italic text-lg leading-relaxed whitespace-pre-line text-foreground">
            {latest.comment}
          </p>
        </section>
      )}
    </div>
  );
}
