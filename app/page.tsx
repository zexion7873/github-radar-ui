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
  // Trending, blog, and every LOOT_TARGETS table in parallel; loot and blog
  // failures degrade to "—" / null in their cards rather than failing the page.
  // Only a trending failure (the page's backbone — the hot lists and the
  // category bar) shows the error notice. The inner Promise.all still starts every loot
  // fetch immediately, so nesting costs no round-trip.
  const targets = Object.keys(LOOT_TARGETS) as LootTarget[];
  const [trending, blog, lootResults] = await Promise.all([
    fetchTrending(TABLES.trending),
    fetchBlog(TABLES.blog),
    Promise.all(targets.map((t) => fetchLoot(LOOT_TARGETS[t].uuid))),
  ]);
  if (!trending.ok) return <DataError error={trending.error} />;

  // Dedup loot per repo (latest week) BEFORE any count/summary — a repo
  // shortlisted across multiple weeks must count once, matching the loot board.
  // Without this Copilot (the table with cross-week repeats) over-counts pending.
  // Keyed off LOOT_TARGETS so adding a target needs no edit on this page.
  const loot = Object.fromEntries(
    targets.map((t, i) => {
      const r = lootResults[i];
      return [t, r.ok ? latestPerRepo(r.rows) : null];
    }),
  ) as Record<LootTarget, LootRow[] | null>;

  // repos = every repo ever archived (the dedup only grows); onChart = this
  // week's live chart. Every "本週" surface below MUST rank within onChart —
  // feeding it `repos` lets a repo that fell off weeks ago keep the headline.
  const repos = latestPerRepo(trending.rows);
  const { onChart } = currentChart(repos);

  // This week's category mix, sorted heaviest-first — feeds the dashboard's
  // 本週分類 distribution bar. Built from the on-chart set so it sums to the
  // on-chart count; a null category buckets to "other" (the bar's neutral hue).
  const categoryMix = Object.entries(
    onChart.reduce<Record<string, number>>((acc, r) => {
      const c = r.category ?? "other";
      acc[c] = (acc[c] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // Per-repo relative momentum, shared by the dashboard's 本週竄升 ranking — the
  // same computation the /trending list uses for its 竄升中 sort and badge.
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
