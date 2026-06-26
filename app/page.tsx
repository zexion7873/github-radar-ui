import { fetchTrending, fetchLoot, fetchBlog, latestPerRepo } from "@/lib/data";
import { TABLES } from "@/lib/config";
import StatsBar from "@/components/StatsBar";
import Dashboard from "@/components/Dashboard";
import LastSynced from "@/components/LastSynced";
import { DataError } from "@/components/ui";

export const dynamic = "force-dynamic";

const pendingCount = (
  result: Awaited<ReturnType<typeof fetchLoot>>,
): number | null =>
  result.ok
    ? result.rows.filter((r) => (r.status ?? "new") === "new").length
    : null;

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
  const lootRows = [
    ...(lootClaude.ok ? lootClaude.rows : []),
    ...(lootCopilot.ok ? lootCopilot.rows : []),
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
          { label: "本週在榜", value: onChartThisWeek },
          { label: "本週新上榜", value: newThisWeek, featured: true },
          { label: "Claude 待處理", value: pendingCount(lootClaude) },
          { label: "Copilot 待處理", value: pendingCount(lootCopilot) },
        ]}
      />
      <Dashboard
        trending={repos}
        loot={{
          claude: lootClaude.ok ? lootClaude.rows : null,
          copilot: lootCopilot.ok ? lootCopilot.rows : null,
        }}
        blog={blog.ok ? blog.rows : null}
      />
    </div>
  );
}
