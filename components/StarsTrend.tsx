import { formatWeek } from "./ui";

// Weekly stars/wk trajectory as a CSS bar chart. No chart dependency — the stack
// is intentionally just next/react, and a handful of flex divs renders this fine.
// Server-rendered and static; the `title` on each bar gives the per-week value on
// hover and the container carries a text alternative for AT.
export default function StarsTrend({
  points,
}: {
  points: { week: string | null; stars: number | null }[];
}) {
  const max = Math.max(1, ...points.map((p) => p.stars ?? 0));
  const first = points[0]?.week ?? null;
  const last = points[points.length - 1]?.week ?? null;

  return (
    <div>
      <div
        className="flex h-32 items-stretch gap-1"
        role="img"
        aria-label={`每週 stars/週 趨勢，共 ${points.length} 週，最高 ${max.toLocaleString()}`}
      >
        {points.map((p, i) => (
          <div
            key={p.week ?? i}
            className="group flex flex-1 flex-col justify-end"
            title={`${formatWeek(p.week)}：${p.stars?.toLocaleString() ?? "—"}`}
          >
            <div
              className="w-full rounded-t bg-blue-500/70 transition-colors group-hover:bg-blue-500 dark:bg-blue-400/60 dark:group-hover:bg-blue-400"
              style={{ height: `${Math.max(2, ((p.stars ?? 0) / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-zinc-400">
        <span>{formatWeek(first)}</span>
        {points.length > 1 && <span>{formatWeek(last)}</span>}
      </div>
    </div>
  );
}
