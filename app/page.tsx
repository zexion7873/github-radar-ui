import {
  fetchTrending,
  fetchLoot,
  fetchBlog,
  latestPerRepo,
  latestLootPerRepo,
  weeklySeriesByRepo,
  type LootRow,
} from "@/lib/data";
import { TABLES } from "@/lib/config";
import StatsBar from "@/components/StatsBar";
import Dashboard from "@/components/Dashboard";
import LastSynced from "@/components/LastSynced";
import { DataError } from "@/components/ui";

export const dynamic = "force-dynamic";

// Distinct repos still 'new'. The caller dedups per repo (latest week) first, so
// a repo shortlisted across multiple weeks counts once — matching the loot board.
const pendingCount = (rows: LootRow[] | null): number | null =>
  rows ? rows.filter((r) => (r.status ?? "new") === "new").length : null;

export default async function Page() {
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
  const onChartThisWeek = repos.filter((r) => r.week === latestWeek).length;

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

  return (
    <div className="flex flex-col gap-6">
      {latestSync && <LastSynced iso={latestSync} />}
      <StatsBar
        stats={[
          { label: "本週在榜", value: onChartThisWeek },
          { label: "本週新上榜", value: newThisWeek },
          { label: "Claude 待處理", value: pendingCount(lootClaudeRows) },
          { label: "Copilot 待處理", value: pendingCount(lootCopilotRows) },
        ]}
      />
      <Dashboard
        trending={repos}
        series={weeklySeriesByRepo(trending.rows)}
        loot={{
          claude: lootClaudeRows,
          copilot: lootCopilotRows,
        }}
        blog={blog.ok ? blog.rows : null}
      />
    </div>
  );
}
