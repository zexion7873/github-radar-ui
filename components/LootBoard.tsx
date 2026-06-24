import type { LootRow } from "@/lib/data";
import { Badge, formatWeek } from "./ui";

const STATUS_ORDER = ["new", "adopted", "skipped"];
const STATUS_TONE: Record<string, "blue" | "green" | "gray"> = {
  new: "blue",
  adopted: "green",
  skipped: "gray",
};

export default function LootBoard({ rows }: { rows: LootRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-400">No loot yet.</p>
    );
  }

  const groups = new Map<string, LootRow[]>();
  for (const r of rows) {
    const key = r.status ?? "new";
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }
  const keys = [
    ...STATUS_ORDER.filter((k) => groups.has(k)),
    ...[...groups.keys()].filter((k) => !STATUS_ORDER.includes(k)),
  ];

  return (
    <div className="flex flex-col gap-6">
      {keys.map((status) => (
        <section key={status}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-500">
            <Badge tone={STATUS_TONE[status] ?? "gray"}>{status}</Badge>
            <span>{groups.get(status)!.length}</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.get(status)!.map((r) => (
              <article
                key={r.id}
                className="flex flex-col gap-1.5 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={r.link ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium break-all text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {r.repo}
                  </a>
                  {r.type && <Badge tone="purple">{r.type}</Badge>}
                </div>
                {r.intro && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {r.intro}
                  </p>
                )}
                {r.asset && (
                  <p className="text-sm">
                    <span className="text-zinc-400">偷什麼 </span>
                    {r.asset}
                  </p>
                )}
                {r.why && (
                  <p className="text-sm">
                    <span className="text-zinc-400">為何 </span>
                    {r.why}
                  </p>
                )}
                {r.how && (
                  <p className="text-sm">
                    <span className="text-zinc-400">怎麼搬 </span>
                    {r.how}
                  </p>
                )}
                {r.week && (
                  <p className="mt-1 text-xs text-zinc-400">
                    {formatWeek(r.week)}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
