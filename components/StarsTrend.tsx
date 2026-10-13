import { formatWeek } from "./ui";

// Flex divs, no chart dependency: the stack is deliberately next/react only.
export default function StarsTrend({
  points,
  compact = false,
}: {
  points: { week: string | null; stars: number | null }[];
  compact?: boolean;
}) {
  const max = Math.max(1, ...points.map((p) => p.stars ?? 0));
  const first = points[0]?.week ?? null;
  const last = points[points.length - 1]?.week ?? null;

  // The trending list's inline sparkline: shape only, no axis.
  if (compact) {
    return (
      <div
        className="flex h-6 w-20 items-stretch gap-px"
        role="img"
        aria-label={`每週趨勢，共 ${points.length} 週，最高 ${max.toLocaleString()}`}
      >
        {points.map((p, i) => {
          const isPeak = (p.stars ?? 0) === max && max > 0;
          return (
            <div key={p.week ?? i} className="flex flex-1 flex-col justify-end">
              <div
                className={isPeak ? "bg-accent" : "bg-foreground/35"}
                style={{ height: `${Math.max(10, ((p.stars ?? 0) / max) * 100)}%` }}
              />
            </div>
          );
        })}
      </div>
    );
  }

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
