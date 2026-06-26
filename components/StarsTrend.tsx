import { formatWeek } from "./ui";

// Weekly stars/wk trajectory as a CSS bar chart. No chart dependency — the stack
// is intentionally just next/react, and a handful of flex divs renders this fine.
// Server-rendered and static; the `title` on each bar gives the per-week value on
// hover and the container carries a text alternative for AT. Editorial: ink
// rectangles, the peak week in accent, a single baseline rule, zero radius.
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
        className="flex h-32 items-stretch gap-1 border-b border-border"
        role="img"
        aria-label={`每週 stars/週 趨勢，共 ${points.length} 週，最高 ${max.toLocaleString()}`}
      >
        {points.map((p, i) => {
          const isPeak = (p.stars ?? 0) === max && max > 0;
          return (
            <div
              key={p.week ?? i}
              className="group flex flex-1 flex-col justify-end"
              title={`${formatWeek(p.week)}：${p.stars?.toLocaleString() ?? "—"}`}
            >
              <div
                className={`w-full transition-colors duration-[var(--dur-ink)] ease-[var(--ease-ink)] ${
                  isPeak
                    ? "bg-accent"
                    : "bg-foreground/45 group-hover:bg-foreground/70"
                }`}
                style={{ height: `${Math.max(2, ((p.stars ?? 0) / max) * 100)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[11px] text-muted">
        <span>{formatWeek(first)}</span>
        {points.length > 1 && <span>{formatWeek(last)}</span>}
      </div>
    </div>
  );
}
