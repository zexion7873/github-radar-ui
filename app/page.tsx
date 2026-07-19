import {
  fetchTrending,
  fetchLoot,
  fetchBlog,
  latestPerRepo,
  latestLootPerRepo,
  currentChart,
  weeklySeriesByRepo,
  momentumByRepo,
  type LootRow,
} from "@/lib/data";
import { TABLES, DEFAULT_LOOT_TARGET } from "@/lib/config";
import StatsBar from "@/components/StatsBar";
import Dashboard from "@/components/Dashboard";
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
  // All five tables in parallel; loot and blog failures degrade to "—" / null
  // in their cards rather than failing the page. Only a trending failure (the
  // page's backbone — stat counts and the hot list) shows the error notice.
  const [trending, lootClaude, lootCopilot, lootOpencode, blog] = await Promise.all([
    fetchTrending(TABLES.trending),
    fetchLoot(TABLES.lootClaude),
    fetchLoot(TABLES.lootCopilot),
    fetchLoot(TABLES.lootOpencode),
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
  const lootOpencodeRows = lootOpencode.ok
    ? latestLootPerRepo(lootOpencode.rows)
    : null;

  // One combined pending count for the stat bar — StatsBar shows totals, not
  // per-target detail (the dashboard's 📦 待處理 Loot footer already covers
  // that), so this tile's count doesn't grow a new column every time a target
  // is added. A target whose fetch failed contributes nothing rather than
  // sinking the whole tile to "—".
  const lootPending = [lootClaudeRows, lootCopilotRows, lootOpencodeRows]
    .map(pendingCount)
    .filter((n): n is number => n !== null);
  const lootPendingTotal =
    lootPending.length > 0 ? lootPending.reduce((a, b) => a + b, 0) : null;

  // repos = every repo ever archived (the dedup only grows); onChart = this
  // week's live chart. Every "本週" surface below MUST rank within onChart —
  // feeding it `repos` lets a repo that fell off weeks ago keep the headline.
  const repos = latestPerRepo(trending.rows);
  const { onChart } = currentChart(repos);
  const newThisWeek = onChart.filter((r) => (r.weeksOnChart ?? 1) <= 1).length;
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
  const lootRows = [
    ...(lootClaudeRows ?? []),
    ...(lootCopilotRows ?? []),
    ...(lootOpencodeRows ?? []),
  ];
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
          { label: "本週在榜", value: onChartThisWeek, href: "/trending" },
          { label: "本週新上榜", value: newThisWeek, href: "/trending" },
          {
            label: "待處理 Loot",
            value: lootPendingTotal,
            href: `/loot/${DEFAULT_LOOT_TARGET}`,
          },
        ]}
      />
      <Dashboard
        authed={authed}
        onChart={onChart}
        series={series}
        momentum={momentumByRepo(series)}
        categoryMix={categoryMix}
        loot={{
          claude: lootClaudeRows,
          copilot: lootCopilotRows,
          opencode: lootOpencodeRows,
        }}
        blog={blog.ok ? blog.rows : null}
      />
    </div>
  );
}
