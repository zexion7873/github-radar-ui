import { cardClass } from "./ui";

export type Stat = { label: string; value: number | null };

export default function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className={`p-4 ${cardClass}`}>
          <div className="text-2xl font-semibold tabular-nums">
            {s.value ?? "—"}
          </div>
          <div className="mt-1 text-xs text-zinc-500">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
