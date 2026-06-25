import type { BlogRow } from "@/lib/data";
import { Badge, cardInteractive, formatWeek } from "./ui";

// Blog Archive's Type is a closed enum (official / individual); render each as
// its own section, newest first (rows already arrive Published-desc).
const GROUPS: { type: string; label: string }[] = [
  { type: "official", label: "🏛 官方" },
  { type: "individual", label: "🧑‍💻 個人" },
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function BlogList({ rows }: { rows: BlogRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-400">No posts yet.</p>
    );
  }
  // "New" is relative to the latest archived date in the data, not the wall
  // clock — keeps render pure (no Date.now()) and mirrors how TrendingList
  // derives its 🆕 badge from the row data rather than the current time.
  const latestArchived = rows.reduce((max, r) => {
    const t = r.archived ? Date.parse(r.archived) : 0;
    return t > max ? t : max;
  }, 0);
  return (
    <div className="flex flex-col gap-8">
      {GROUPS.map(({ type, label }) => {
        const group = rows.filter((r) => r.type === type);
        if (group.length === 0) return null;
        return (
          <section key={type}>
            <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {label}
              <span className="ml-2 text-sm font-normal text-zinc-400">
                {group.length}
              </span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((r) => {
                const isNew =
                  !!r.archived &&
                  latestArchived - Date.parse(r.archived) < WEEK_MS;
                return (
                  <article
                    key={r.id}
                    className={`flex flex-col gap-2 p-4 ${cardInteractive}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <a
                        href={r.url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {r.title}
                      </a>
                      {isNew && <Badge tone="green">🆕 new</Badge>}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                      <Badge tone="blue">{r.source}</Badge>
                      {r.author && <span>{r.author}</span>}
                    </div>

                    {r.summary && (
                      <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {r.summary}
                      </p>
                    )}
                    {r.comment && (
                      <p className="border-l-2 border-zinc-200 pl-3 text-sm leading-relaxed text-zinc-500 italic dark:border-zinc-700 dark:text-zinc-400">
                        {r.comment}
                      </p>
                    )}
                    {r.published && (
                      <p className="mt-auto text-xs text-zinc-400">
                        {formatWeek(r.published)}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
