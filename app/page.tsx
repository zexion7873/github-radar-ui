import {
  fetchTrending,
  fetchLoot,
  fetchBlog,
  latestPerRepo,
  latestLootPerRepo,
  weeklySeriesByRepo,
  momentumByRepo,
  type LootRow,
} from "@/lib/data";
import { TABLES } from "@/lib/config";
import StatsBar from "@/components/StatsBar";
import Dashboard from "@/components/Dashboard";
import AskRadar from "@/components/AskRadar";
import LastSynced from "@/components/LastSynced";
import { DataError } from "@/components/ui";
import { cookies } from "next/headers";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Distinct repos still 'new'. The caller dedups per repo (latest week) first, so
// a repo shortlisted across multiple weeks counts once — matching the loot board.
const pendingCount = (rows: LootRow[] | null): number | null =>
  rows ? rows.filter((r) => (r.status ?? "new") === "new").length : null;

export default async function Page() {
  const authed = isAuthed((await cookies()).get("gh_radar")?.value);
  // All four tables in parallel; loot and blog failures degrade to "—" / null
  // in their cards rather than failing the page. Only a trending failure (the
  // page's backbone — stat counts and the hot list) shows the error notice.
  const [trending, lootClaude, lootCopilot, blog] = await Promise.all([
    fetchTrending(TABLES.trending),
    fetchLoot(TABLES.lootClaude),
    fetchLoot(TABLES.lootCopilot),
    fetchBlog(TABLES.blog),
  ]);
  if (!trending.ok) return <DataError error={trending.error} />;

  // Dedup loot per repo (latest week) BEFORE any count/summary — a repo
  // shortlisted across multiple weeks must count once, matching the loot board.
  // Without this Copilot (the table with cross-week repeats) over-counts pending.
  const lootClaudeRows = lootClaude.ok ? latestLootPerRepo(lootClaude.rows) : null;
  const lootCopilotRows = lootCopilot.ok
    ? latestLootPerRepo(lootCopilot.rows)
    : null;

  const repos = latestPerRepo(trending.rows);
  const latestWeek = repos.reduce(
    (max, r) => (r.week && r.week > max ? r.week : max),
    "",
  );
  const newThisWeek = repos.filter(
    (r) => r.week === latestWeek && (r.weeksOnChart ?? 1) <= 1,
  ).length;
  // repos whose most recent week IS the latest week = this week's live chart.
  // Distinct from repos.length, which counts every repo ever archived (it only
  // ever grows — a repo that fell off weeks ago still has a row in the dedup).
  const onChart = repos.filter((r) => r.week === latestWeek);
  const onChartThisWeek = onChart.length;

  // This week's category mix, sorted heaviest-first — feeds the dashboard's
  // 本週分類 distribution bar. Built from the on-chart set so it sums to
  // onChartThisWeek; a null category buckets to "other" (the bar's neutral hue).
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
  // same computation the /trending list uses for its 🚀 sort and badge.
  const series = weeklySeriesByRepo(trending.rows);

  // Freshest source date across every table — the dashboard's "is the pipeline
  // still alive" signal. Loot/blog failures just contribute nothing here.
  const lootRows = [...(lootClaudeRows ?? []), ...(lootCopilotRows ?? [])];
  const latestSync = [
    ...repos.map((r) => r.week),
    ...lootRows.map((r) => r.week),
    ...(blog.ok ? blog.rows.flatMap((r) => [r.published, r.archived]) : []),
  ]
    .filter((d): d is string => !!d)
    .reduce((max, d) => (d > max ? d : max), "");

  // The Ask box costs Claude tokens per question, so it's owner-only (authed) and
  // only when the radar-rag service is wired up. Public visitors never see it.
  const askEnabled = authed && !!process.env.RADAR_INTEL_URL;

  return (
    <div className="flex flex-col gap-6">
      {latestSync && <LastSynced iso={latestSync} />}
      {askEnabled && <AskRadar />}
      <StatsBar
        stats={[
          { label: "本週在榜", value: onChartThisWeek, href: "/trending" },
          { label: "本週新上榜", value: newThisWeek, href: "/trending" },
          {
            label: "Claude 待處理",
            value: pendingCount(lootClaudeRows),
            href: "/loot/claude",
          },
          {
            label: "Copilot 待處理",
            value: pendingCount(lootCopilotRows),
            href: "/loot/copilot",
          },
        ]}
      />
      <Dashboard
        authed={authed}
        trending={repos}
        series={series}
        momentum={momentumByRepo(series)}
        categoryMix={categoryMix}
        loot={{
          claude: lootClaudeRows,
          copilot: lootCopilotRows,
        }}
        blog={blog.ok ? blog.rows : null}
      />
    </div>
  );
}
