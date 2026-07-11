import Link from "next/link";

export type Stat = { label: string; value: number | null; href?: string };

export default function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.map((s) => {
        // Every tile is a headline metric, so each gets the accent top rule (the
        // print-masthead cue) — same call as the trending readout: when all cells
        // are the featured data, the scarce accent marks them all.
        const tile =
          "border-x border-b border-t-[3px] border-border border-t-accent bg-surface p-4";
        const body = (
          <>
            <div className="font-serif text-4xl tabular-nums">
              {s.value ?? "—"}
            </div>
            <div className="mt-1 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
              {s.label}
            </div>
          </>
        );
        // Linked tiles darken the side/bottom borders on hover but never the top —
        // the masthead accent rule must survive the hover, so this can't reuse the
        // all-sides cardInteractive treatment.
        return s.href ? (
          <Link
            key={s.label}
            href={s.href}
            className={`${tile} block transition-colors duration-[var(--dur-ink)] ease-[var(--ease-ink)] hover:border-x-ink-2 hover:border-b-ink-2 focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none`}
          >
            {body}
          </Link>
        ) : (
          <div key={s.label} className={tile}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
