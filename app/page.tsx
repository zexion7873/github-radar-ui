import {
  fetchTrending,
  fetchLoot,
  fetchBlog,
  latestPerRepo,
  currentChart,
  weeklySeriesByRepo,
  momentumByRepo,
  type LootRow,
} from "@/lib/data";
import { TABLES, LOOT_TARGETS, type LootTarget } from "@/lib/config";
import Dashboard from "@/components/Dashboard";
import LastSynced from "@/components/LastSynced";
import { DataError } from "@/components/ui";
import { cookies } from "next/headers";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const authed = isAuthed((await cookies()).get("gh_radar")?.value);
  // Only a trending failure shows the error notice; loot and blog failures
  // degrade to "—" in their cards.
  const targets = Object.keys(LOOT_TARGETS) as LootTarget[];
  const [trending, blog, lootResults] = await Promise.all([
    fetchTrending(TABLES.trending),
    fetchBlog(TABLES.blog),
    Promise.all(targets.map((t) => fetchLoot(LOOT_TARGETS[t].uuid))),
  ]);
  if (!trending.ok) return <DataError error={trending.error} />;

  // Dedup before any count, or a repo shortlisted in several weeks over-counts pending.
  const loot = Object.fromEntries(
    targets.map((t, i) => {
      const r = lootResults[i];
      return [t, r.ok ? latestPerRepo(r.rows) : null];
    }),
  ) as Record<LootTarget, LootRow[] | null>;

  // Every 本週 surface ranks within onChart: `repos` still holds repos that fell
  // off the chart weeks ago.
  const repos = latestPerRepo(trending.rows);
  const { onChart } = currentChart(repos);

  // From the on-chart set, so the 本週分類 bar sums to the on-chart count.
  const categoryMix = Object.entries(
    onChart.reduce<Record<string, number>>((acc, r) => {
      const c = r.category ?? "other";
      acc[c] = (acc[c] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // The same computation as /trending's 竄升中 sort and badge.
  const series = weeklySeriesByRepo(trending.rows);

  // Freshest source date across every table — the dashboard's "is the pipeline
  // still alive" signal. Loot/blog failures just contribute nothing here.
  const lootRows = Object.values(loot).flatMap((rows) => rows ?? []);
  const latestSync = [
    ...repos.map((r) => r.week),
    ...lootRows.map((r) => r.week),
    ...(blog.ok ? blog.rows.flatMap((r) => [r.published, r.archived]) : []),
  ]
    .filter((d): d is string => !!d)
    .reduce((max, d) => (d > max ? d : max), "");

  return (
    <div className="flex flex-col gap-6">
      {latestSync && <LastSynced iso={latestSync} />}
      <Dashboard
        authed={authed}
        onChart={onChart}
        series={series}
        momentum={momentumByRepo(series)}
        categoryMix={categoryMix}
        loot={loot}
        blog={blog.ok ? blog.rows : null}
      />
    </div>
  );
}
