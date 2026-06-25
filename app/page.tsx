import { fetchTrending, fetchLoot } from "@/lib/data";
import { TABLES } from "@/lib/config";
import StatsBar from "@/components/StatsBar";
import Dashboard from "@/components/Dashboard";
import { DataError } from "@/components/ui";

export const dynamic = "force-dynamic";

const pendingCount = (
  result: Awaited<ReturnType<typeof fetchLoot>>,
): number | null =>
  result.ok
    ? result.rows.filter((r) => (r.status ?? "new") === "new").length
    : null;

export default async function Page() {
  // All three tables in parallel; loot failures degrade to "—" / null in the
  // cards rather than failing the page. Only a trending failure (the page's
  // backbone — stat counts and the hot list) shows the error notice.
  const [trending, lootClaude, lootCopilot] = await Promise.all([
    fetchTrending(TABLES.trending),
    fetchLoot(TABLES.lootClaude),
    fetchLoot(TABLES.lootCopilot),
  ]);
  if (!trending.ok) return <DataError error={trending.error} />;

  const rows = trending.rows;
  const newOnChart = rows.filter((r) => (r.weeksOnChart ?? 1) <= 1).length;

  return (
    <div className="flex flex-col gap-6">
      <StatsBar
        stats={[
          { label: "追蹤中 repo", value: rows.length },
          { label: "🆕 本週新上榜", value: newOnChart },
          { label: "Claude 待處理", value: pendingCount(lootClaude) },
          { label: "Copilot 待處理", value: pendingCount(lootCopilot) },
        ]}
      />
      <Dashboard
        trending={rows}
        loot={{
          claude: lootClaude.ok ? lootClaude.rows : null,
          copilot: lootCopilot.ok ? lootCopilot.rows : null,
        }}
      />
    </div>
  );
}
