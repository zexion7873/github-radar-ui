export type Stat = { label: string; value: number | null };

export default function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((s) => (
        // Every tile is a headline metric, so each gets the accent top rule (the
        // print-masthead cue) — same call as the trending readout: when all cells
        // are the featured data, the scarce accent marks them all.
        <div
          key={s.label}
          className="border-x border-b border-t-[3px] border-border border-t-accent bg-surface p-4"
        >
          <div className="font-serif text-4xl tabular-nums">{s.value ?? "—"}</div>
          <div className="mt-1 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
