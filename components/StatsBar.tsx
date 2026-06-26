export type Stat = { label: string; value: number | null; featured?: boolean };

export default function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((s) => (
        // Top-edge rule carries the only colour: the featured stat gets the
        // accent kicker, the rest an ink rule — the print-masthead cue.
        <div
          key={s.label}
          className={`border-x border-b border-border bg-surface p-4 ${
            s.featured ? "border-t-[3px] border-t-accent" : "border-t-[3px] border-t-foreground"
          }`}
        >
          <div className="font-serif text-4xl tabular-nums">{s.value ?? "—"}</div>
          <div className="mt-1 font-mono text-[11px] tracking-wide text-muted uppercase">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
