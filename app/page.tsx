import { fetchTrending, fetchLoot } from "@/lib/data";
import { TABLES } from "@/lib/config";
import TrendingList from "@/components/TrendingList";
import StatsBar from "@/components/StatsBar";
import { DataError } from "@/components/ui";

export const dynamic = "force-dynamic";

const pendingCount = (
  result: Awaited<ReturnType<typeof fetchLoot>>,
): number | null =>
  result.ok
    ? result.rows.filter((r) => (r.status ?? "new") === "new").length
    : null;

export default async function Page() {
  // Read all three tables in parallel; loot only feeds the stat cards, so a loot
  // failure degrades to "—" rather than failing the whole page — only a trending
  // failure (the main content) shows the error notice.
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
      <TrendingList rows={rows} />
    </div>
  );
}
