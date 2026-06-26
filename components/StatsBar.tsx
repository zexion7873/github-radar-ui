import { BigStat } from "./ui";

export type Stat = { label: string; value: number | null; featured?: boolean };

export default function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((s) => (
        <BigStat
          key={s.label}
          value={s.value ?? "—"}
          label={s.label}
          featured={s.featured}
        />
      ))}
    </div>
  );
}
